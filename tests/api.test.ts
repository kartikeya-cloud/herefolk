import { test } from "node:test";
import assert from "node:assert/strict";
import { createApi, type Database } from "../supabase/functions/api/app";
const venue = "11111111-1111-4111-8111-111111111111",
  person = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function fixture({
  valid = true,
  error = null,
}: { valid?: boolean; error?: { message: string } | null } = {}) {
  const calls: { name: string; args?: Record<string, unknown> }[] = [];
  const tokens: string[] = [];
  const db: Database = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { id: "result" }, error };
    },
  };
  const app = createApi(async (token) => {
    tokens.push(token);
    return valid ? db : null;
  });
  const request = (
    path: string,
    payload: unknown,
    header = "Bearer test-token",
  ) =>
    app.request("/api" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(header ? { Authorization: header } : {}),
      },
      body: JSON.stringify(payload),
    });
  return { app, calls, tokens, request };
}
test("API rejects missing or invalid sessions without database calls", async () => {
  const f = fixture({ valid: false });
  assert.equal(
    (await f.request("/check-in", { venue_id: venue }, "")).status,
    401,
  );
  assert.equal(f.tokens.length, 0);
  assert.equal((await f.request("/check-in", { venue_id: venue })).status, 401);
  assert.deepEqual(f.tokens, ["test-token"]);
  assert.equal(f.calls.length, 0);
});
test("API CORS preflight does not require authentication", async () => {
  const f = fixture();
  const r = await f.app.request("/api/posts", {
    method: "OPTIONS",
    headers: {
      Origin: "https://herefolk.test",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.equal(f.tokens.length, 0);
});
test("API handles malformed JSON and non-object bodies as client errors", async () => {
  const f = fixture();
  for (const payload of [null, [], 4, "text"])
    assert.equal((await f.request("/posts", payload)).status, 400);
  const r = await f.app.request("/api/posts", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: "{invalid",
  });
  assert.equal(r.status, 400);
  assert.equal(f.calls.length, 0);
});
test("API rejects empty, oversized, and wrong-type posts", async () => {
  const f = fixture();
  for (const content of ["", "  ", 123, "x".repeat(501)])
    assert.equal(
      (await f.request("/posts", { venue_id: venue, content })).status,
      400,
    );
  assert.equal(
    (await f.request("/posts", { venue_id: "invalid", content: "hello" }))
      .status,
    400,
  );
  assert.equal(f.calls.length, 0);
});
test("API routes valid post to the authenticated database RPC", async () => {
  const f = fixture();
  const r = await f.request("/posts", {
    venue_id: venue,
    content: "  Hello venue!  ",
  });
  assert.equal(r.status, 201);
  assert.deepEqual(f.calls, [
    {
      name: "create_post",
      args: { p_venue_id: venue, p_content: "Hello venue!" },
    },
  ]);
  assert.deepEqual(await r.json(), { id: "result" });
});
test("API maps venue and invitation workflows to correct RPC arguments", async () => {
  const f = fixture();
  assert.equal((await f.request("/check-in", { venue_id: venue })).status, 200);
  assert.equal((await f.request("/check-out", {})).status, 200);
  assert.equal(
    (await f.request("/requests", { venue_id: venue, receiver_id: person }))
      .status,
    201,
  );
  assert.equal(
    (await f.request("/requests/" + person, { status: "accepted" })).status,
    200,
  );
  assert.deepEqual(f.calls, [
    { name: "check_in", args: { p_venue_id: venue } },
    { name: "check_out", args: undefined },
    {
      name: "send_request",
      args: { p_receiver_id: person, p_venue_id: venue },
    },
    {
      name: "respond_request",
      args: { p_request_id: person, p_status: "accepted" },
    },
  ]);
});
test("API rejects invalid invitation IDs and response states", async () => {
  const f = fixture();
  assert.equal(
    (await f.request("/requests", { receiver_id: "bad", venue_id: venue }))
      .status,
    400,
  );
  assert.equal(
    (await f.request("/requests/" + person, { status: "pending" })).status,
    400,
  );
  assert.equal(
    (await f.request("/requests/not-an-id", { status: "accepted" })).status,
    400,
  );
  assert.equal(f.calls.length, 0);
});
test("API returns database rejection to the caller", async () => {
  const f = fixture({
    error: { message: "Both people must be checked in at the same venue" },
  });
  const r = await f.request("/requests", {
    receiver_id: person,
    venue_id: venue,
  });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /same venue/);
});
test("API caps request size and gives JSON for unknown routes", async () => {
  const f = fixture();
  assert.equal(
    (await f.request("/posts", { venue_id: venue, content: "x".repeat(5000) }))
      .status,
    413,
  );
  const r = await f.request("/missing", {});
  assert.equal(r.status, 404);
  assert.match((await r.json()).error, /endpoint/);
  assert.equal(f.calls.length, 0);
});
