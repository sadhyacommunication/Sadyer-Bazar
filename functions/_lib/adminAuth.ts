/**
 * Server-side Admin Authentication Verifier for /api/admin/*.
 *
 * Verifies:
 *  1. The caller provided a valid `Authorization: Bearer <jwt>` header.
 *  2. Supabase Auth (`/auth/v1/user`) confirms the JWT is active and returns the user ID.
 *  3. The user ID exists in `public.admins` (checked with the service_role key).
 */
import type { Config } from "./env";
import { HttpError } from "./http";

export interface VerifiedAdmin {
  userId: string;
  email: string;
  role: string;
}

export async function requireAdmin(request: Request, cfg: Config): Promise<VerifiedAdmin> {
  const authHeader = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9._~+/-]+=*)$/i.exec(authHeader.trim());
  if (!match) {
    throw new HttpError(401, "unauthorized", "Admin sign-in is required");
  }
  const accessToken = match[1];

  // 1. Validate JWT against Supabase Auth server
  let userRes: Response;
  try {
    userRes = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6_000),
    });
  } catch (err) {
    console.error("[adminAuth] auth/v1/user network error:", err instanceof Error ? err.message : err);
    throw new HttpError(503, "service_unavailable", "Authentication service unavailable");
  }

  if (!userRes.ok) {
    throw new HttpError(401, "unauthorized", "Your admin session has expired. Please sign in again.");
  }

  const user = (await userRes.json()) as { id?: string; email?: string };
  if (!user.id || !/^[0-9a-f-]{36}$/i.test(user.id)) {
    throw new HttpError(401, "unauthorized", "Invalid admin user identity");
  }

  // 2. Verify user is listed in public.admins allow-list table
  let adminRes: Response;
  try {
    adminRes = await fetch(
      `${cfg.supabaseUrl}/rest/v1/admins?user_id=eq.${encodeURIComponent(user.id)}&select=user_id,email,role`,
      {
        method: "GET",
        headers: {
          apikey: cfg.serviceRoleKey,
          Authorization: `Bearer ${cfg.serviceRoleKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(6_000),
      }
    );
  } catch (err) {
    console.error("[adminAuth] admins lookup error:", err instanceof Error ? err.message : err);
    throw new HttpError(503, "service_unavailable", "Authorization service unavailable");
  }

  if (!adminRes.ok) {
    throw new HttpError(502, "upstream_error", "Failed to verify admin membership");
  }

  const rows = (await adminRes.json()) as Array<{ user_id: string; email: string; role: string }>;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(403, "forbidden", "This account is not authorized in public.admins");
  }

  return {
    userId: rows[0].user_id,
    email: rows[0].email || user.email || "",
    role: rows[0].role || "admin",
  };
}
