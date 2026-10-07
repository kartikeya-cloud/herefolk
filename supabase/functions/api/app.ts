import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
export type Database = {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
};
export type Authenticate = (token: string) => Promise<Database | null>;
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function createApi(authenticate: Authenticate) {
  const app = new Hono<{ Variables: { db: Database } }>().basePath("/api");
  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["Authorization", "Content-Type", "apikey"],
      allowMethods: ["POST", "OPTIONS"],
    }),
  );
  app.use(
    "*",
    bodyLimit({
      maxSize: 4096,
      onError: (c) => c.json({ error: "This request is too large." }, 413),
    }),
  );
  app.use("*", async (c, next) => {
    const header = c.req.header("Authorization") || "";
    const match = /^Bearer ([^\s]+)$/i.exec(header);
    if (!match) return c.json({ error: "Please sign in to continue." }, 401);
    const db = await authenticate(match[1]);
    if (!db)
      return c.json(
        { error: "Invalid or expired session. Please sign in again." },
        401,
      );
    c.set("db", db);
    await next();
  });
  const body = async (request: { json: () => Promise<unknown> }) => {
    let value: unknown;
    try {
      value = await request.json();
    } catch (error) {
      if (
        error instanceof HTTPException ||
        (error instanceof Error && error.name === "BodyLimitError")
      )
        throw error;
      throw new HTTPException(400, { message: "Please send valid JSON." });
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new HTTPException(400, { message: "Please send a JSON object." });
    return value as Record<string, unknown>;
  };
  app.post("/check-in", async (c) => {
    const data = await body(c.req);
    if (!uuid(data.venue_id))
      return c.json({ error: "Choose a valid venue." }, 400);
    const result = await c
      .get("db")
      .rpc("check_in", { p_venue_id: data.venue_id });
    return result.error
      ? c.json({ error: result.error.message }, 400)
      : Response.json(result.data);
  });
  app.post("/check-out", async (c) => {
    const result = await c.get("db").rpc("check_out");
    return result.error
      ? c.json({ error: result.error.message }, 400)
      : c.json({ ok: true });
  });
  app.post("/posts", async (c) => {
    const data = await body(c.req);
    if (
      !uuid(data.venue_id) ||
      typeof data.content !== "string" ||
      !data.content.trim() ||
      data.content.trim().length > 500
    )
      return c.json(
        { error: "Posts must have 1–500 characters and a valid venue." },
        400,
      );
    const result = await c.get("db").rpc("create_post", {
      p_venue_id: data.venue_id,
      p_content: data.content.trim(),
    });
    return result.error
      ? c.json({ error: result.error.message }, 400)
      : Response.json(result.data, { status: 201 });
  });
  app.post("/requests", async (c) => {
    const data = await body(c.req);
    if (!uuid(data.receiver_id) || !uuid(data.venue_id))
      return c.json({ error: "Invalid invitation." }, 400);
    const result = await c.get("db").rpc("send_request", {
      p_receiver_id: data.receiver_id,
      p_venue_id: data.venue_id,
    });
    return result.error
      ? c.json({ error: result.error.message }, 400)
      : Response.json(result.data, { status: 201 });
  });
  app.post("/requests/:id", async (c) => {
    const data = await body(c.req);
    if (
      !uuid(c.req.param("id")) ||
      typeof data.status !== "string" ||
      !["accepted", "declined"].includes(data.status)
    )
      return c.json({ error: "Invalid response." }, 400);
    const result = await c.get("db").rpc("respond_request", {
      p_request_id: c.req.param("id"),
      p_status: data.status,
    });
    return result.error
      ? c.json({ error: result.error.message }, 400)
      : Response.json(result.data);
  });
  app.notFound((c) => c.json({ error: "This endpoint does not exist." }, 404));
  app.onError((error, c) => {
    if (error.name === "BodyLimitError")
      return c.json({ error: "This request is too large." }, 413);
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status);
    console.error("Herefolk API:", error.message);
    return c.json(
      { error: "Unable to process the request. Please try again." },
      500,
    );
  });
  return app;
}
