-- Cache the caller's identity once per query rather than per policy row.
alter policy profile_edit on public.profiles using (id=(select auth.uid())) with check (id=(select auth.uid()));
alter policy checkin_read on public.check_ins using (user_id=(select auth.uid()) or (expires_at>now() and private.at_venue(venue_id)));
alter policy post_delete on public.posts using (user_id=(select auth.uid()));
alter policy request_read on public.connection_requests using ((select auth.uid()) in (sender_id,receiver_id));
