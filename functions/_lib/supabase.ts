/**
 * Minimal Supabase (PostgREST) client for Pages Functions using the SERVICE-ROLE key.
 *
 * - Only RPC calls are exposed: all privileged logic lives in SQL functions that are
 *   EXECUTE-granted to service_role only (see supabase/migrations).
 * - Domain errors raised by those functions use SQLSTATE 'SB001' and carry a message that is
 *   safe to show users. Every other upstream error is logged server-side and masked.
 */
import type { Config } from "./env";
import { HttpError } from "./http";

interface PgError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const FN_NAME = /^[a-z_][a-z0-9_]*$/;

export async function rpc<T = unknown>(
  cfg: Pick<Config, "supabaseUrl" | "serviceRoleKey">,
  fn: string,
  args: Record<string, unknown> = {},
  opts: { timeoutMs?: number } = {}
): Promise<T> {
  if (!FN_NAME.test(fn)) throw new Error(`rpc: illegal function name "${fn}"`);

  let res: Response;
  try {
    res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8_000),
    });
  } catch (err) {
    console.error(`[supabase] rpc ${fn} network error:`, err instanceof Error ? err.message : err);
    throw new HttpError(503, "service_unavailable", "Service temporarily unavailable");
  }

  if (!res.ok) {
    let body: PgError = {};
    try {
      body = (await res.json()) as PgError;
    } catch {
      /* non-JSON error body */
    }
    if (body.code === "SB001" && body.message) {
      throw new HttpError(422, "validation_failed", body.message);
    }
    console.error(`[supabase] rpc ${fn} failed: status=${res.status} code=${body.code ?? "?"} msg=${body.message ?? "?"}`);
    throw new HttpError(502, "upstream_error", "Service temporarily unavailable");
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
