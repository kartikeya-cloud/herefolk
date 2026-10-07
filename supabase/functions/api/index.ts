import { createClient } from "@supabase/supabase-js";
import { createApi } from "./app.ts";
const app = createApi(async (token) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("Backend environment is not configured.");
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.auth.getUser(token);
  return error || !data.user ? null : db;
});
Deno.serve(app.fetch);
