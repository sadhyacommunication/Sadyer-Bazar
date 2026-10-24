/**
 * Typed, fail-closed runtime configuration for Cloudflare Pages Functions.
 *
 * Design rules
 *  - Unknown / missing APP_ENV is treated as PRODUCTION (strictest), never as dev.
 *  - Invariant: production => PAYMENT_MODE "live"; non-production => "sandbox".
 *    A silent fall-back to sandbox gateways in production (anyone can make a free
 *    sandbox payment) is therefore impossible.
 *  - The Supabase key used server-side must really be a service-role key; an anon /
 *    publishable key is rejected instead of silently downgrading.
 *  - Callback URLs are built from NEXT_PUBLIC_SITE_URL in production, never from the
 *    (attacker-influenced) Host header.
 */

export interface Env {
  APP_ENV?: string;
  PAYMENT_MODE?: string;
  ALLOW_DEV_LIVE_PAYMENT?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  ALLOWED_ORIGINS?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  IP_HASH_SALT?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_DEV_BYPASS?: string;
  BKASH_APP_KEY?: string;
  BKASH_APP_SECRET?: string;
  BKASH_USERNAME?: string;
  BKASH_PASSWORD?: string;
  NAGAD_MERCHANT_ID?: string;
  NAGAD_PUBLIC_KEY?: string;
  NAGAD_PRIVATE_KEY?: string;
}

export type AppEnv = "production" | "preview" | "development";
export type PaymentMode = "live" | "sandbox";

export interface Config {
  appEnv: AppEnv;
  isProduction: boolean;
  isDevelopment: boolean;
  /** null when PAYMENT_MODE is unset; use requirePaymentMode() in payment routes. */
  paymentMode: PaymentMode | null;
  allowDevLivePayment: boolean;
  /** Absolute site origin, no trailing slash. */
  siteUrl: string;
  supabaseUrl: string;
  serviceRoleKey: string;
  ipHashSalt: string;
  allowedOrigins: ReadonlySet<string>;
}

/** Misconfiguration. Message is for server logs only, never sent to clients. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const cache = new WeakMap<object, Config>();

function parseUrl(raw: string, label: string): URL {
  try {
    return new URL(raw);
  } catch {
    throw new ConfigError(`${label} is not a valid URL`);
  }
}

function b64urlDecode(segment: string): string {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
}

/** Rejects anon/publishable/placeholder keys so the server never runs with the wrong power level. */
function assertServiceRoleKey(key: string): void {
  if (!key || /your-|placeholder|changeme/i.test(key)) {
    throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY is missing or still a placeholder");
  }
  if (key.startsWith("sb_publishable_")) {
    throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY holds a publishable key; a secret/service_role key is required");
  }
  if (key.startsWith("sb_secret_")) return;
  const parts = key.split(".");
  if (parts.length !== 3) {
    throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY is not a recognised Supabase key format");
  }
  let role: unknown;
  try {
    role = (JSON.parse(b64urlDecode(parts[1])) as { role?: unknown }).role;
  } catch {
    throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY payload cannot be decoded");
  }
  if (role !== "service_role") {
    throw new ConfigError(`SUPABASE_SERVICE_ROLE_KEY has role "${String(role)}"; expected "service_role"`);
  }
}

export function loadConfig(env: Env, requestUrl: string): Config {
  const hit = cache.get(env);
  if (hit) return hit;

  const rawEnv = (env.APP_ENV ?? "").trim().toLowerCase();
  if (rawEnv && rawEnv !== "production" && rawEnv !== "preview" && rawEnv !== "development") {
    throw new ConfigError(`Unknown APP_ENV "${rawEnv}"`);
  }
  const appEnv: AppEnv = rawEnv === "preview" || rawEnv === "development" ? rawEnv : "production";
  const isProduction = appEnv === "production";
  const isDevelopment = appEnv === "development";

  // Site URL (used to build gateway callback URLs)
  const rawSite = (env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  let siteOrigin: string;
  if (rawSite) {
    const u = parseUrl(rawSite, "NEXT_PUBLIC_SITE_URL");
    if (isProduction && u.protocol !== "https:") {
      throw new ConfigError("NEXT_PUBLIC_SITE_URL must be https in production");
    }
    siteOrigin = u.origin;
  } else if (!isProduction) {
    siteOrigin = new URL(requestUrl).origin;
  } else {
    throw new ConfigError("NEXT_PUBLIC_SITE_URL is required in production");
  }

  // Supabase
  const supabase = parseUrl((env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(), "NEXT_PUBLIC_SUPABASE_URL");
  const localSupabase = isDevelopment && (supabase.hostname === "localhost" || supabase.hostname === "127.0.0.1");
  if (supabase.protocol !== "https:" && !localSupabase) {
    throw new ConfigError("NEXT_PUBLIC_SUPABASE_URL must be https");
  }
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  assertServiceRoleKey(serviceRoleKey);

  // IP hashing salt (so raw IPs are never stored in rate-limit buckets)
  const salt = (env.IP_HASH_SALT ?? "").trim();
  if (isProduction && salt.length < 16) {
    throw new ConfigError("IP_HASH_SALT must be set (>= 16 chars) in production");
  }

  // Browser origins allowed to call the API
  const origins = new Set<string>([siteOrigin]);
  for (const raw of (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const u = parseUrl(raw, "ALLOWED_ORIGINS entry");
    if (isProduction && u.protocol !== "https:") {
      throw new ConfigError("ALLOWED_ORIGINS entries must be https in production");
    }
    origins.add(u.origin);
  }
  if (isDevelopment) {
    for (const o of ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8788", "http://127.0.0.1:8788"]) {
      origins.add(o);
    }
  }

  const rawMode = (env.PAYMENT_MODE ?? "").trim().toLowerCase();
  const paymentMode: PaymentMode | null = rawMode === "live" || rawMode === "sandbox" ? rawMode : null;
  if (rawMode && paymentMode === null) {
    throw new ConfigError(`PAYMENT_MODE must be "live" or "sandbox" (got "${rawMode}")`);
  }

  const cfg: Config = {
    appEnv,
    isProduction,
    isDevelopment,
    paymentMode,
    allowDevLivePayment: isDevelopment && (env.ALLOW_DEV_LIVE_PAYMENT ?? "").trim().toLowerCase() === "true",
    siteUrl: siteOrigin,
    supabaseUrl: supabase.origin,
    serviceRoleKey,
    ipHashSalt: salt || "dev-only-salt",
    allowedOrigins: origins,
  };
  cache.set(env, cfg);
  return cfg;
}

/**
 * Payment routes must call this. Enforces: production <=> live, everything else <=> sandbox
 * (unless ALLOW_DEV_LIVE_PAYMENT=true is explicitly set in local development).
 */
export function requirePaymentMode(cfg: Config): PaymentMode {
  if (cfg.paymentMode === null) {
    throw new ConfigError("PAYMENT_MODE is not set (must be explicitly \"live\" or \"sandbox\")");
  }
  if (cfg.isProduction && cfg.paymentMode !== "live") {
    throw new ConfigError("Refusing sandbox payment gateways in production (APP_ENV=production requires PAYMENT_MODE=live)");
  }
  if (!cfg.isProduction && cfg.paymentMode !== "sandbox" && !cfg.allowDevLivePayment) {
    throw new ConfigError("Refusing LIVE payment gateways outside production (use PAYMENT_MODE=sandbox)");
  }
  return cfg.paymentMode;
}
