/**
 * Cloudflare Pages Functions middleware for EVERY /api/* request.
 *
 * Enforces, in order:
 *   1. Method allow-list
 *   2. Hard-disabled legacy routes (insecure pre-hardening endpoints) -> 410
 *   3. Fail-closed configuration validation (see _lib/env.ts) -> 503
 *   4. CORS: explicit origin allow-list (never "*"), strict preflight
 *   5. CSRF / origin check for state-changing requests (POST)
 *   6. Content-Type: application/json and a hard body-size cap
 *   7. Per-IP rate limiting (Postgres-backed, shared across isolates)
 *   8. Uniform response hardening + sanitized errors (details only in server logs)
 *
 * Handlers can read `ctx.data.requestId` and `ctx.data.ipHash`.
 */
import { ConfigError, loadConfig, type Config } from "../_lib/env";
import { errorResponse, getClientIp, hashIp, HttpError } from "../_lib/http";
import { burstAllowed, consume, matchRule } from "../_lib/ratelimit";
import type { PagesContext } from "../_lib/types";

const MAX_BODY_BYTES = 32_768;
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "OPTIONS"]);

/**
 * Legacy routes written before the security audit (C1-C4, H1, H3). They trusted client input or
 * skipped gateway verification, so they are switched off at the edge. Phase 3 replaces the payment
 * ones with `create` / `callback` handlers and removes the matching entries from this list.
 */
const DISABLED_ROUTES: readonly RegExp[] = [
  /^\/api\/payment\/webhook\/?$/,
  /^\/api\/payment\/verify\/?$/,
  /^\/api\/payment\/sslcommerz(\/|$)/,
  /^\/api\/payment\/bkash\/(init|query)\/?$/,
  /^\/api\/payment\/nagad\/(init|verify)\/?$/,
];

function applyHeaders(resp: Response, requestId: string, corsOrigin: string | null): Response {
  // Re-wrap so headers are mutable (Response.redirect() responses are immutable).
  const out = new Response(resp.body, resp);
  // Handlers must not set their own CORS policy: remove, then apply ours.
  for (const name of [...out.headers.keys()]) {
    if (name.toLowerCase().startsWith("access-control-")) out.headers.delete(name);
  }
  if (corsOrigin) {
    out.headers.set("Access-Control-Allow-Origin", corsOrigin);
    out.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    out.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    out.headers.set("Access-Control-Max-Age", "600");
    out.headers.append("Vary", "Origin");
  }
  out.headers.set("Cache-Control", "no-store");
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("Referrer-Policy", "no-referrer");
  out.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  out.headers.set("X-Robots-Tag", "noindex, nofollow");
  out.headers.set("X-Request-Id", requestId);
  return out;
}

function checkUnsafeRequest(request: Request, cfg: Config): void {
  const origin = request.headers.get("Origin");
  if (origin) {
    if (!cfg.allowedOrigins.has(origin)) throw new HttpError(403, "forbidden_origin", "Origin not allowed");
  } else if (request.headers.get("Sec-Fetch-Site") !== "same-origin") {
    // No Origin and not a same-origin browser fetch: not one of our pages.
    throw new HttpError(403, "forbidden_origin", "Origin not allowed");
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json");
  }
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader === null) throw new HttpError(411, "length_required", "Content-Length is required");
  const length = Number(lengthHeader);
  if (!Number.isFinite(length) || length < 0) throw new HttpError(400, "bad_request", "Invalid Content-Length");
  if (length > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large", "Request body is too large");
}

export const onRequest = async (ctx: PagesContext): Promise<Response> => {
  const requestId = crypto.randomUUID();
  let corsOrigin: string | null = null;
  let response: Response;

  try {
    const { request } = ctx;
    const url = new URL(request.url);

    if (!ALLOWED_METHODS.has(request.method)) {
      response = errorResponse(405, "method_not_allowed", "Method not allowed", { Allow: "GET, HEAD, POST, OPTIONS" });
    } else if (DISABLED_ROUTES.some((r) => r.test(url.pathname))) {
      response = errorResponse(410, "gone", "This endpoint has been retired");
    } else {
      const cfg = loadConfig(ctx.env, request.url);
      const origin = request.headers.get("Origin");
      corsOrigin = origin && cfg.allowedOrigins.has(origin) ? origin : null;

      if (request.method === "OPTIONS") {
        response = corsOrigin ? new Response(null, { status: 204 }) : errorResponse(403, "forbidden_origin", "Origin not allowed");
      } else {
        if (request.method === "POST") checkUnsafeRequest(request, cfg);

        const rule = matchRule(url.pathname);
        const ipHash = await hashIp(getClientIp(request), cfg.ipHashSalt);
        ctx.data.requestId = requestId;
        ctx.data.ipHash = ipHash;

        if (!burstAllowed(ipHash)) {
          throw new HttpError(429, "rate_limited", "Too many requests. Please slow down.");
        }
        if (rule) {
          const decision = await consume(cfg, rule, ipHash);
          if (!decision.allowed) {
            if (decision.unavailable) throw new HttpError(503, "service_unavailable", "Service temporarily unavailable");
            response = errorResponse(429, "rate_limited", "Too many requests. Please try again later.", {
              "Retry-After": String(decision.retryAfter),
            });
            return applyHeaders(response, requestId, corsOrigin);
          }
        }
        response = await ctx.next();
      }
    }
  } catch (err) {
    if (err instanceof HttpError) {
      response = errorResponse(err.status, err.code, err.message);
    } else if (err instanceof ConfigError) {
      console.error(`[config] request=${requestId} ${err.message}`);
      response = errorResponse(503, "service_unavailable", "Service temporarily unavailable");
    } else {
      console.error(`[api] request=${requestId} unhandled:`, err instanceof Error ? err.stack ?? err.message : err);
      response = errorResponse(500, "internal_error", "Something went wrong. Please try again.");
    }
  }

  return applyHeaders(response, requestId, corsOrigin);
};
