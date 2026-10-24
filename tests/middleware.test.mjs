import assert from "node:assert/strict";

const { onRequest } = await import(new URL("../functions/api/_middleware.ts", import.meta.url).href);
const { loadConfig, requirePaymentMode, ConfigError } = await import(new URL("../functions/_lib/env.ts", import.meta.url).href);

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); pass++; console.log("PASS ", name); }
  catch (e) { fail++; console.log("FAIL ", name, "->", e.message); }
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role) => `${b64({ alg: "HS256" })}.${b64({ role })}.sig`;
const baseEnv = () => ({
  APP_ENV: "production", PAYMENT_MODE: "live",
  NEXT_PUBLIC_SITE_URL: "https://sadhyerbazar.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
  IP_HASH_SALT: "0123456789abcdef0123",
});

let limiter = () => ({ allowed: true, retryAfter: 0 });
globalThis.fetch = async (url) => {
  if (String(url).includes("/rpc/rate_limit_hit")) {
    const r = limiter();
    if (r instanceof Error) throw r;
    return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new Error("unexpected fetch " + url);
};

const call = (env, req, next = async () => new Response("ok")) =>
  onRequest({ request: req, env, params: {}, data: {}, waitUntil() {}, next });
const post = (path, headers = {}, body = "{}") =>
  new Request("https://sadhyerbazar.com" + path, { method: "POST", body, headers: { "content-length": String(body.length), ...headers } });
const goodHeaders = { Origin: "https://sadhyerbazar.com", "content-type": "application/json" };

await t("legacy webhook is hard-disabled (410) -> closes C1 at the edge", async () => {
  const r = await call(baseEnv(), new Request("https://sadhyerbazar.com/api/payment/webhook", { method: "POST" }));
  assert.equal(r.status, 410);
});
await t("legacy bkash/init, nagad/init, sslcommerz/* -> 410", async () => {
  for (const p of ["/api/payment/bkash/init", "/api/payment/nagad/init", "/api/payment/sslcommerz/success", "/api/payment/verify", "/api/payment/bkash/query", "/api/payment/nagad/verify"]) {
    assert.equal((await call(baseEnv(), new Request("https://sadhyerbazar.com" + p))).status, 410, p);
  }
});
await t("PUT/DELETE rejected (405)", async () => {
  assert.equal((await call(baseEnv(), new Request("https://sadhyerbazar.com/api/x", { method: "DELETE" }))).status, 405);
});
await t("CORS preflight: allowed origin 204 w/ exact ACAO, evil origin 403", async () => {
  const ok = await call(baseEnv(), new Request("https://sadhyerbazar.com/api/orders/create", { method: "OPTIONS", headers: { Origin: "https://sadhyerbazar.com" } }));
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://sadhyerbazar.com");
  const bad = await call(baseEnv(), new Request("https://sadhyerbazar.com/api/orders/create", { method: "OPTIONS", headers: { Origin: "https://evil.example" } }));
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
});
await t("CSRF: POST with evil Origin -> 403", async () => {
  const r = await call(baseEnv(), post("/api/orders/create", { ...goodHeaders, Origin: "https://evil.example" }));
  assert.equal(r.status, 403);
});
await t("CSRF: POST with no Origin and no Sec-Fetch-Site -> 403 (server-to-server forgery)", async () => {
  const r = await call(baseEnv(), post("/api/orders/create", { "content-type": "application/json" }));
  assert.equal(r.status, 403);
});
await t("same-origin browser fetch (Sec-Fetch-Site) without Origin is allowed", async () => {
  const r = await call(baseEnv(), post("/api/orders/create", { "content-type": "application/json", "sec-fetch-site": "same-origin" }));
  assert.equal(r.status, 200);
});
await t("POST must be application/json (415) and have Content-Length (411) and be <=32KB (413)", async () => {
  assert.equal((await call(baseEnv(), post("/api/orders/create", { ...goodHeaders, "content-type": "text/plain" }))).status, 415);
  const noLen = new Request("https://sadhyerbazar.com/api/orders/create", { method: "POST", body: "{}", headers: goodHeaders });
  assert.equal((await call(baseEnv(), noLen)).status, 411);
  assert.equal((await call(baseEnv(), post("/api/orders/create", goodHeaders, "x".repeat(40_000)))).status, 413);
});
await t("rate limit exceeded -> 429 + Retry-After", async () => {
  limiter = () => ({ allowed: false, retryAfter: 42 });
  const r = await call(baseEnv(), post("/api/orders/create", goodHeaders));
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("retry-after"), "42");
  limiter = () => ({ allowed: true, retryAfter: 0 });
});
await t("limiter DOWN: abuse-sensitive route fails CLOSED (503), non-critical route (quote) fails OPEN", async () => {
  limiter = () => new Error("db down");
  assert.equal((await call(baseEnv(), post("/api/orders/create", goodHeaders))).status, 503);
  const cb = await call(baseEnv(), new Request("https://sadhyerbazar.com/api/orders/quote"));
  assert.equal(cb.status, 200);
  limiter = () => ({ allowed: true, retryAfter: 0 });
});
await t("handler redirect (immutable headers) + handler's own 'ACAO:*' are normalised", async () => {
  const r = await call(baseEnv(), new Request("https://sadhyerbazar.com/api/ping"),
    async () => { const x = Response.redirect("https://sadhyerbazar.com/track-order", 302); return x; });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const w = await call(baseEnv(), new Request("https://sadhyerbazar.com/api/ping", { headers: { Origin: "https://evil.example" } }),
    async () => new Response("x", { headers: { "Access-Control-Allow-Origin": "*" } }));
  assert.equal(w.headers.get("access-control-allow-origin"), null);
});
await t("unhandled handler error -> generic 500, no stack/message leak", async () => {
  const r = await call(baseEnv(), new Request("https://sadhyerbazar.com/api/ping"), async () => { throw new Error("SECRET internal detail"); });
  const body = await r.text();
  assert.equal(r.status, 500);
  assert.ok(!body.includes("SECRET"));
  assert.ok(r.headers.get("x-request-id"));
});
await t("anon/publishable key in SUPABASE_SERVICE_ROLE_KEY is rejected -> 503, no leak", async () => {
  const env = { ...baseEnv(), SUPABASE_SERVICE_ROLE_KEY: jwt("anon") };
  const r = await call(env, new Request("https://sadhyerbazar.com/api/ping"));
  const body = await r.text();
  assert.equal(r.status, 503);
  assert.ok(!/anon|service_role/.test(body));
  const env2 = { ...baseEnv(), SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_abc" };
  assert.equal((await call(env2, new Request("https://sadhyerbazar.com/api/ping"))).status, 503);
});
await t("production without SITE_URL / weak salt / http site -> ConfigError (fail closed)", async () => {
  for (const patch of [{ NEXT_PUBLIC_SITE_URL: "" }, { IP_HASH_SALT: "short" }, { NEXT_PUBLIC_SITE_URL: "http://sadhyerbazar.com" }]) {
    assert.throws(() => loadConfig({ ...baseEnv(), ...patch }, "https://x.test/api"), ConfigError);
  }
});
await t("unset APP_ENV is treated as PRODUCTION; unknown APP_ENV rejected", async () => {
  const { APP_ENV, ...rest } = baseEnv();
  assert.equal(loadConfig(rest, "https://x.test/").isProduction, true);
  assert.throws(() => loadConfig({ ...baseEnv(), APP_ENV: "staging" }, "https://x.test/"), ConfigError);
});
await t("payment mode invariant: production=>live, non-production=>sandbox, unset=>error", async () => {
  assert.equal(requirePaymentMode(loadConfig(baseEnv(), "https://x.test/")), "live");
  assert.throws(() => requirePaymentMode(loadConfig({ ...baseEnv(), PAYMENT_MODE: "sandbox" }, "https://x.test/")), ConfigError);
  assert.throws(() => requirePaymentMode(loadConfig({ ...baseEnv(), PAYMENT_MODE: undefined }, "https://x.test/")), ConfigError);
  const dev = { ...baseEnv(), APP_ENV: "development", PAYMENT_MODE: "sandbox", NEXT_PUBLIC_SITE_URL: undefined };
  assert.equal(requirePaymentMode(loadConfig(dev, "http://localhost:8788/api")), "sandbox");
  assert.throws(() => requirePaymentMode(loadConfig({ ...dev, PAYMENT_MODE: "live" }, "http://localhost:8788/api")), ConfigError);
});
await t("preview derives callback origin from request; production never does", async () => {
  const prev = loadConfig({ ...baseEnv(), APP_ENV: "preview", PAYMENT_MODE: "sandbox", NEXT_PUBLIC_SITE_URL: undefined }, "https://abc.sadyer-bazar.pages.dev/api/x");
  assert.equal(prev.siteUrl, "https://abc.sadyer-bazar.pages.dev");
  assert.equal(loadConfig(baseEnv(), "https://evil.example/api/x").siteUrl, "https://sadhyerbazar.com");
});

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);


