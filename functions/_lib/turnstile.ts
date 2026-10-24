/**
 * Cloudflare Turnstile server-side verification.
 *
 * Rules:
 *  - In production (APP_ENV=production): FAILS CLOSED if TURNSTILE_SECRET_KEY or the client
 *    token is missing or rejected by Cloudflare's siteverify endpoint.
 *  - In local development (APP_ENV=development): allows bypass ONLY when TURNSTILE_DEV_BYPASS="true"
 *    or when TURNSTILE_SECRET_KEY is not configured yet.
 */
import { ConfigError, type Config, type Env } from "./env";
import { HttpError } from "./http";

interface TurnstileVerifyResponse {
  success?: boolean;
  "error-codes"?: string[];
  hostname?: string;
}

export async function verifyTurnstile(
  cfg: Config,
  env: Env,
  token: string | undefined | null,
  clientIp: string
): Promise<void> {
  const secret = (env.TURNSTILE_SECRET_KEY ?? "").trim();
  const devBypass = (env.TURNSTILE_DEV_BYPASS ?? "").trim().toLowerCase() === "true";

  if (cfg.isDevelopment && (devBypass || !secret || secret.startsWith("1x0000000000000000000000000000000AA"))) {
    return;
  }

  if (!secret) {
    throw new ConfigError("TURNSTILE_SECRET_KEY is required when Turnstile bypass is not enabled");
  }

  const cleanToken = (token ?? "").trim();
  if (!cleanToken || cleanToken.length > 2048) {
    throw new HttpError(400, "captcha_required", "Please complete the security verification check");
  }

  let res: Response;
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", cleanToken);
    if (clientIp && clientIp !== "unknown") {
      form.set("remoteip", clientIp);
    }

    res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(6_000),
    });
  } catch (err) {
    console.error("[turnstile] network error:", err instanceof Error ? err.message : err);
    throw new HttpError(503, "service_unavailable", "Security verification service unavailable. Please try again.");
  }

  if (!res.ok) {
    throw new HttpError(503, "service_unavailable", "Security verification service unavailable. Please try again.");
  }

  const data = (await res.json()) as TurnstileVerifyResponse;
  if (!data.success) {
    throw new HttpError(403, "captcha_failed", "Security verification failed. Please refresh and try again.");
  }
}
