-- Herefolk: database-enforced rules. All mutations except profile edit and
-- deleting your own posts go through atomic, authenticated RPCs.
create schema if not exists private;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(trim(display_name)) between 2 and 40),
 bio text not null default '' check (char_length(bio)<=180),
 created_at timestamptz not null default now()
);
create table public.venues (
 id uuid primary key default gen_random_uuid(), name text not null, category text not null,
 address text not null, description text not null, cover text not null, tags text[] not null default '{}'
);
create table public.check_ins (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.profiles(id) on delete cascade,
 venue_id uuid not null references public.venues(id), checked_in_at timestamptz not null default now(),
 expires_at timestamptz not null, check (expires_at>checked_in_at)
);
create index check_ins_venue_expiry on public.check_ins(venue_id,expires_at);
create table public.posts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 venue_id uuid not null references public.venues(id), content text not null check (char_length(trim(content)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index posts_venue_created on public.posts(venue_id,created_at desc);
create table public.connection_requests (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade,
 receiver_id uuid not null references public.profiles(id) on delete cascade, venue_id uuid not null references public.venues(id),
 status text not null default 'pending' check (status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(), check (sender_id<>receiver_id)
);
-- A single pair models both invitation and accepted connection. It avoids a
-- second table and makes acceptance one atomic update.
create unique index connection_pair on public.connection_requests(least(sender_id,receiver_id),greatest(sender_id,receiver_id));
create index requests_receiver on public.connection_requests(receiver_id,status);
create index requests_sender on public.connection_requests(sender_id,status);
create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'New member'),40));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
create function private.at_venue(v uuid) returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.check_ins where user_id=auth.uid() and venue_id=v and expires_at>now());
$$;
create function private.visible_profile(p uuid) returns boolean language sql stable security definer set search_path = public as $$
 select p=auth.uid() or exists(select 1 from public.check_ins a join public.check_ins b on a.venue_id=b.venue_id where a.user_id=auth.uid() and b.user_id=p and a.expires_at>now() and b.expires_at>now())
 or exists(select 1 from public.connection_requests where (sender_id=auth.uid() and receiver_id=p) or (receiver_id=auth.uid() and sender_id=p))
 or exists(select 1 from public.posts where user_id=p and private.at_venue(venue_id));
$$;
revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.at_venue(uuid),private.visible_profile(uuid) from public;
grant execute on function private.at_venue(uuid),private.visible_profile(uuid) to authenticated;
alter table public.profiles enable row level security;
alter table public.venues enable row level security;
alter table public.check_ins enable row level security;
alter table public.posts enable row level security;
alter table public.connection_requests enable row level security;
create policy profile_read on public.profiles for select to authenticated using(private.visible_profile(id));
create policy profile_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy venue_read on public.venues for select to authenticated using(true);
create policy checkin_read on public.check_ins for select to authenticated using(user_id=auth.uid() or (expires_at>now() and private.at_venue(venue_id)));
create policy post_read on public.posts for select to authenticated using(private.at_venue(venue_id));
create policy post_delete on public.posts for delete to authenticated using(user_id=auth.uid());
create policy request_read on public.connection_requests for select to authenticated using(auth.uid() in (sender_id,receiver_id));
revoke all on public.profiles,public.venues,public.check_ins,public.posts,public.connection_requests from anon,authenticated;
grant select on public.profiles,public.venues,public.check_ins,public.posts,public.connection_requests to authenticated;
grant update(display_name,bio) on public.profiles to authenticated;
grant delete on public.posts to authenticated;
create function private.check_in(p_venue_id uuid) returns public.check_ins language plpgsql security definer set search_path = public as $$
declare result public.check_ins;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 insert into public.check_ins(user_id,venue_id,checked_in_at,expires_at) values(auth.uid(),p_venue_id,now(),now()+interval '2 hours')
 on conflict(user_id) do update set venue_id=excluded.venue_id,checked_in_at=excluded.checked_in_at,expires_at=excluded.expires_at returning * into result;
 return result;
end $$;
create function private.check_out() returns void language plpgsql security definer set search_path = public as $$
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 delete from public.check_ins where user_id=auth.uid();
end $$;
create function private.create_post(p_venue_id uuid,p_content text) returns public.posts language plpgsql security definer set search_path = public as $$
declare result public.posts;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not private.at_venue(p_venue_id) then raise exception 'Check in to this venue first'; end if;
 if exists(select 1 from public.posts where user_id=auth.uid() and created_at>now()-interval '5 seconds') then raise exception 'Please wait a few seconds before posting again'; end if;
 insert into public.posts(user_id,venue_id,content) values(auth.uid(),p_venue_id,trim(p_content)) returning * into result;
 return result;
end $$;
create function private.send_request(p_receiver_id uuid,p_venue_id uuid) returns public.connection_requests language plpgsql security definer set search_path = public as $$
declare result public.connection_requests;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_receiver_id=auth.uid() then raise exception 'You cannot invite yourself'; end if;
 -- Lock both users in a fixed order. Venue changes and invitation checks cannot race.
 perform 1 from public.profiles where id in(auth.uid(),p_receiver_id) order by id for update;
 if not private.at_venue(p_venue_id) or not exists(select 1 from public.check_ins where user_id=p_receiver_id and venue_id=p_venue_id and expires_at>now()) then raise exception 'Both people must be checked in at the same venue'; end if;
 insert into public.connection_requests(sender_id,receiver_id,venue_id) values(auth.uid(),p_receiver_id,p_venue_id) returning * into result;
 return result;
exception when unique_violation then raise exception 'An invitation or connection already exists for these people';
end $$;
create function private.respond_request(p_request_id uuid,p_status text) returns public.connection_requests language plpgsql security definer set search_path = public as $$
declare result public.connection_requests;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_status not in ('accepted','declined') then raise exception 'Invalid response'; end if;
 update public.connection_requests set status=p_status where id=p_request_id and receiver_id=auth.uid() and status='pending' returning * into result;
 if result.id is null then raise exception 'Invitation unavailable or already answered'; end if;
 return result;
end $$;
-- Public RPCs are security-invoker wrappers. Privileged code stays in the
-- unexposed private schema; each mutation authenticates and authorizes its caller.
create function public.check_in(p_venue_id uuid) returns public.check_ins language sql security invoker set search_path = public as $$ select private.check_in(p_venue_id); $$;
create function public.check_out() returns void language sql security invoker set search_path = public as $$ select private.check_out(); $$;
create function public.create_post(p_venue_id uuid,p_content text) returns public.posts language sql security invoker set search_path = public as $$ select private.create_post(p_venue_id,p_content); $$;
create function public.send_request(p_receiver_id uuid,p_venue_id uuid) returns public.connection_requests language sql security invoker set search_path = public as $$ select private.send_request(p_receiver_id,p_venue_id); $$;
create function public.respond_request(p_request_id uuid,p_status text) returns public.connection_requests language sql security invoker set search_path = public as $$ select private.respond_request(p_request_id,p_status); $$;
revoke execute on function private.handle_new_user(),private.check_in(uuid),private.check_out(),private.create_post(uuid,text),private.send_request(uuid,uuid),private.respond_request(uuid,text) from public,anon;
grant execute on function private.check_in(uuid),private.check_out(),private.create_post(uuid,text),private.send_request(uuid,uuid),private.respond_request(uuid,text) to authenticated;
revoke execute on function public.check_in(uuid),public.check_out(),public.create_post(uuid,text),public.send_request(uuid,uuid),public.respond_request(uuid,text) from public,anon;
grant execute on function public.check_in(uuid),public.check_out(),public.create_post(uuid,text),public.send_request(uuid,uuid),public.respond_request(uuid,text) to authenticated;
create index posts_author on public.posts(user_id);
create index requests_venue on public.connection_requests(venue_id);
alter publication supabase_realtime add table public.posts,public.connection_requests;
insert into public.venues(id,name,category,address,description,cover,tags) values
('11111111-1111-4111-8111-111111111111','The Reading Room','Café','Civil Lines, Delhi','Good coffee. Quiet corners. A little room for a new conversation.','cafe',array['Coffee & conversation','Work-friendly']),
('22222222-2222-4222-8222-222222222222','Common Ground','Coworking','Connaught Place, Delhi','A welcoming space for makers, independent thinkers, and your next big idea.','work',array['Build together','Community']),
('33333333-3333-4333-8333-333333333333','The Green Corner','Outdoors','Lodhi Garden, Delhi','Slow down, step outside, and share a little fresh air.','park',array['Fresh air','Weekend walks']),
('44444444-4444-4444-8444-444444444444','Studio Twenty','Events','Hauz Khas, Delhi','Small gatherings, creative workshops, and people with stories to share.','studio',array['Creative people','Meetups']);
