import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let db;
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  c = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const v = "11111111-1111-4111-8111-111111111111",
  w = "22222222-2222-4222-8222-222222222222";
async function asUser(id, query, args = []) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    return await db.query(query, args);
  } finally {
    await db.exec("reset role");
  }
}
before(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  const folder = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(folder))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(file, folder), "utf8");
    await db.exec(
      sql.replace(
        "alter publication supabase_realtime add table public.posts,public.connection_requests;",
        "",
      ),
    );
  }
  for (const [id, name] of [
    [a, "Alice"],
    [b, "Bob"],
    [c, "Cara"],
  ])
    await db.query("insert into auth.users values($1,$2)", [
      id,
      JSON.stringify({ display_name: name }),
    ]);
});
after(async () => {
  await db.close();
});
test("unauthenticated callers cannot check in", async () => {
  await db.exec("set role anon");
  try {
    await assert.rejects(
      db.query("select public.check_in($1)", [v]),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
});
test("switching venues preserves exactly one active check-in", async () => {
  await asUser(a, "select public.check_in($1)", [v]);
  await asUser(a, "select public.check_in($1)", [w]);
  const r = await db.query("select * from public.check_ins where user_id=$1", [
    a,
  ]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].venue_id, w);
  await asUser(a, "select public.check_in($1)", [v]);
  await asUser(b, "select public.check_in($1)", [v]);
});
test("self invites and duplicate reverse invites are rejected", async () => {
  await assert.rejects(
    asUser(a, "select public.send_request($1,$2)", [a, v]),
    /yourself/,
  );
  await asUser(a, "select public.send_request($1,$2)", [b, v]);
  await assert.rejects(
    asUser(b, "select public.send_request($1,$2)", [a, v]),
    /already exists/,
  );
});
test("only the recipient can accept and a request can be answered once", async () => {
  const { rows } = await db.query("select id from public.connection_requests");
  await assert.rejects(
    asUser(a, "select public.respond_request($1,$2)", [rows[0].id, "accepted"]),
    /unavailable/,
  );
  await asUser(b, "select public.respond_request($1,$2)", [
    rows[0].id,
    "accepted",
  ]);
  await assert.rejects(
    asUser(b, "select public.respond_request($1,$2)", [rows[0].id, "declined"]),
    /unavailable/,
  );
});
test("invite requires both people at the same venue", async () => {
  await assert.rejects(
    asUser(a, "select public.send_request($1,$2)", [c, v]),
    /Both people/,
  );
});
test("feed is private, post length is validated, and only owner can delete", async () => {
  await assert.rejects(
    asUser(c, "select public.create_post($1,$2)", [v, "hello"]),
    /Check in/,
  );
  await assert.rejects(
    asUser(a, "select public.create_post($1,$2)", [v, "  "]),
    /check constraint/,
  );
  await assert.rejects(
    asUser(a, "select public.create_post($1,$2)", [v, "x".repeat(501)]),
    /check constraint/,
  );
  const r = await asUser(a, "select * from public.create_post($1,$2)", [
    v,
    "Hello, world!",
  ]);
  const id = r.rows[0].id;
  assert.equal((await asUser(c, "select * from public.posts")).rows.length, 0);
  assert.equal((await asUser(b, "select * from public.posts")).rows.length, 1);
  await asUser(b, "delete from public.posts where id=$1", [id]);
  assert.equal((await db.query("select * from public.posts")).rows.length, 1);
  await asUser(a, "delete from public.posts where id=$1", [id]);
  assert.equal((await db.query("select * from public.posts")).rows.length, 0);
});
test("expired check-ins lose feed access and cannot create posts", async () => {
  await db.query(
    "update public.check_ins set checked_in_at=now()-interval '3 hours',expires_at=now()-interval '1 hour' where user_id=$1",
    [a],
  );
  await assert.rejects(
    asUser(a, "select public.create_post($1,$2)", [v, "Not allowed"]),
    /Check in/,
  );
  assert.equal((await asUser(a, "select * from public.posts")).rows.length, 0);
});
test("profiles can only be edited by their owner and direct check-in writes are denied", async () => {
  await asUser(b, "update public.profiles set bio=$1 where id=$2", [
    "tampered",
    a,
  ]);
  assert.equal(
    (await db.query("select bio from public.profiles where id=$1", [a])).rows[0]
      .bio,
    "",
  );
  await asUser(a, "update public.profiles set bio=$1 where id=$2", [
    "Builder",
    a,
  ]);
  assert.equal(
    (await db.query("select bio from public.profiles where id=$1", [a])).rows[0]
      .bio,
    "Builder",
  );
  await assert.rejects(
    asUser(
      a,
      "insert into public.check_ins(user_id,venue_id,expires_at) values($1,$2,now()+interval '1 hour')",
      [a, v],
    ),
    /permission denied/,
  );
});
