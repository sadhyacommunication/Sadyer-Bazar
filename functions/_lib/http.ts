/**
 * Small, dependency-free HTTP helpers shared by all Pages Functions.
 */

/** Error whose message is SAFE to show to the client. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function errorResponse(status: number, code: string, message?: string, headers: HeadersInit = {}): Response {
  return json({ success: false, error: { code, message: message ?? code } }, status, headers);
}

/**
 * Reads a JSON body with a hard byte cap (also protects against missing/lying Content-Length).
 */
export async function readJsonBody(request: Request, maxBytes = 32_768): Promise<unknown> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json");
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, "payload_too_large", "Request body is too large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "empty_body", "Request body is required");

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "payload_too_large", "Request body is too large");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(merged));
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON");
  }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  ).trim();
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Salted, truncated hash: stable per client for rate limiting, useless for identifying the person. */
export async function hashIp(ip: string, salt: string): Promise<string> {
  return (await sha256Hex(`${salt}|${ip}`)).slice(0, 32);
}

/**
 * Redirect to a path on OUR site only. Host comes from validated config, never from the request,
 * and only primitive, caller-controlled query values are accepted.
 */
export function redirectTo(
  siteUrl: string,
  path: string,
  params: Record<string, string | undefined> = {}
): Response {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("redirectTo: path must be site-relative");
  }
  const url = new URL(path, siteUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), "Cache-Control": "no-store" },
  });
}
