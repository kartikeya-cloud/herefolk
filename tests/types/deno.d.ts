// Minimal runtime declarations for Node-based static checking only.
// Supabase's Deno runtime provides the real implementation.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(
    handler: (request: Request, ...args: any[]) => Response | Promise<Response>,
  ): unknown;
};
