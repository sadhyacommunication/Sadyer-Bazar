/**
 * Rate-limit policy for /api/*.
 *
 * Authoritative limiter: Postgres fixed-window counters (rpc rate_limit_hit), shared by every
 * Cloudflare isolate. A tiny in-isolate burst filter in front of it saves database round-trips
 * under flood. IPs are salted+hashed before they leave the isolate.
 */
import type { Config } from "./env";
import { rpc } from "./supabase";

export interface RateRule {
  id: string;
  test: RegExp;
  limit: number;
  windowSec: number;
  /**
   * true  => if the limiter cannot be reached, REJECT (abuse-sensitive routes).
   * false => allow (routes where blocking would harm a customer who already paid).
   */
  failClosed: boolean;
}

export const RATE_RULES: readonly RateRule[] = [
  { id: "orders-create", test: /^\/api\/orders\/create\/?$/, limit: 6, windowSec: 600, failClosed: true },
  { id: "orders-quote", test: /^\/api\/orders\/quote\/?$/, limit: 60, windowSec: 60, failClosed: false },
  { id: "orders-track", test: /^\/api\/orders\/track\/?$/, limit: 20, windowSec: 600, failClosed: true },
  { id: "coupons", test: /^\/api\/coupons\//, limit: 20, windowSec: 600, failClosed: true },
  { id: "reviews", test: /^\/api\/reviews\//, limit: 10, windowSec: 600, failClosed: true },
  { id: "pay-create", test: /^\/api\/payment\/(bkash|nagad)\/create\/?$/, limit: 10, windowSec: 600, failClosed: true },
  { id: "pay-callback", test: /^\/api\/payment\/(bkash|nagad)\/callback\/?$/, limit: 60, windowSec: 60, failClosed: false },
  { id: "admin", test: /^\/api\/admin\//, limit: 120, windowSec: 60, failClosed: true },
  { id: "api-default", test: /^\/api\//, limit: 120, windowSec: 60, failClosed: false },
];

export function matchRule(pathname: string): RateRule | undefined {
  return RATE_RULES.find((r) => r.test.test(pathname));
}

// ---- in-isolate burst filter (best effort, per isolate) ---------------------
const BURST_LIMIT = 40; // requests
const BURST_WINDOW_MS = 10_000;
const bursts = new Map<string, { n: number; resetAt: number }>();

export function burstAllowed(ipHash: string): boolean {
  const now = Date.now();
  if (bursts.size > 5_000) {
    for (const [k, v] of bursts) if (v.resetAt < now) bursts.delete(k);
  }
  const e = bursts.get(ipHash);
  if (!e || e.resetAt < now) {
    bursts.set(ipHash, { n: 1, resetAt: now + BURST_WINDOW_MS });
    return true;
  }
  e.n += 1;
  return e.n <= BURST_LIMIT;
}

export interface RateDecision {
  allowed: boolean;
  retryAfter: number;
  /** true when the limiter itself was unreachable and the rule is fail-closed */
  unavailable?: boolean;
}

export async function consume(cfg: Config, rule: RateRule, ipHash: string): Promise<RateDecision> {
  try {
    const r = await rpc<{ allowed: boolean; retryAfter: number }>(cfg, "rate_limit_hit", {
      p_bucket: `${rule.id}:${ipHash}`,
      p_window_seconds: rule.windowSec,
      p_max: rule.limit,
    });
    return { allowed: r.allowed, retryAfter: r.retryAfter };
  } catch (err) {
    console.error(`[ratelimit] limiter unavailable for rule ${rule.id}:`, err instanceof Error ? err.message : err);
    if (rule.failClosed) return { allowed: false, retryAfter: 30, unavailable: true };
    return { allowed: true, retryAfter: 0 };
  }
}
