import { createClient } from "@supabase/supabase-js";
import { backendConfig } from "./backend-config";
import type { Database } from "./database.types";
const env = import.meta.env;
const demoRequested =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("demo") === "1";
const url =
  env && !demoRequested ? env.VITE_SUPABASE_URL || backendConfig.url : "";
const key =
  env && !demoRequested
    ? env.VITE_SUPABASE_ANON_KEY || backendConfig.publishableKey
    : "";
export const supabase = url && key ? createClient<Database>(url, key) : null;
export async function api(path: string, body?: unknown) {
  if (!supabase)
    throw new Error(
      "Live accounts are not connected yet. You can explore the demo.",
    );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in to continue.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${url}/functions/v1/api${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: key,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        "The server sent an unexpected response. Please try again.",
      );
    }
    if (!response.ok)
      throw new Error(
        result.error || "We could not complete this action. Please try again.",
      );
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("This is taking longer than expected. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
