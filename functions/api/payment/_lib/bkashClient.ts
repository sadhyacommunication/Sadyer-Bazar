/**
 * bKash Tokenized Checkout (PGW v1.2.0-beta) Enterprise Client
 *
 * Security & Reliability Features:
 *  - Enforces requirePaymentMode(cfg) ("live" vs "sandbox") — never falls back to sandbox in production.
 *  - Single-flight token grant + isolate memory cache + Supabase `payment_gateway_tokens` cache
 *    to prevent bKash rate-limit bans under burst traffic.
 *  - Automatic 1-time token invalidation & retry if bKash reports an expired/invalid id_token.
 *  - Execute Payment with automatic Query Payment fallback when Execute times out or returns
 *    an ambiguous/already-completed status code.
 */
import { requirePaymentMode, type Config, type Env, type PaymentMode } from "../../../_lib/env";
import { HttpError } from "../../../_lib/http";

export interface BkashCredentials {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  mode: PaymentMode;
}

interface CachedToken {
  token: string;
  refreshToken: string | null;
  expiresAt: number;
  mode: PaymentMode;
}

let memTokenCache: CachedToken | null = null;
let inFlightTokenPromise: Promise<string> | null = null;

export function getBkashBaseUrl(mode: PaymentMode): string {
  return mode === "live"
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
}

function isPlaceholder(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  return !trimmed || /your-|placeholder|changeme/i.test(trimmed);
}

export function isBkashConfigured(env: Env): boolean {
  return (
    !isPlaceholder(env.BKASH_APP_KEY) &&
    !isPlaceholder(env.BKASH_APP_SECRET) &&
    !isPlaceholder(env.BKASH_USERNAME) &&
    !isPlaceholder(env.BKASH_PASSWORD)
  );
}

export function requireBkashCredentials(cfg: Config, env: Env): BkashCredentials {
  const mode = requirePaymentMode(cfg);
  if (!isBkashConfigured(env)) {
    throw new HttpError(
      503,
      "gateway_unconfigured",
      "bKash Merchant payment is temporarily unavailable. Please try Nagad or Cash on Delivery."
    );
  }
  return {
    appKey: env.BKASH_APP_KEY!.trim(),
    appSecret: env.BKASH_APP_SECRET!.trim(),
    username: env.BKASH_USERNAME!.trim(),
    password: env.BKASH_PASSWORD!.trim(),
    mode,
  };
}

export function clearBkashMemoryCache(): void {
  memTokenCache = null;
  inFlightTokenPromise = null;
}

async function fetchCachedTokenFromDb(
  cfg: Pick<Config, "supabaseUrl" | "serviceRoleKey">,
  gatewayKey: string
): Promise<{ token: string; refresh_token: string | null; expires_at: string } | null> {
  try {
    const res = await fetch(
      `${cfg.supabaseUrl}/rest/v1/payment_gateway_tokens?gateway=eq.${encodeURIComponent(gatewayKey)}&select=token,refresh_token,expires_at`,
      {
        headers: {
          apikey: cfg.serviceRoleKey,
          Authorization: `Bearer ${cfg.serviceRoleKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(4_000),
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      token: string;
      refresh_token: string | null;
      expires_at: string;
    }>;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function persistTokenToDb(
  cfg: Pick<Config, "supabaseUrl" | "serviceRoleKey">,
  gatewayKey: string,
  token: string,
  refreshToken: string | null,
  expiresAtMs: number
): Promise<void> {
  try {
    await fetch(`${cfg.supabaseUrl}/rest/v1/payment_gateway_tokens`, {
      method: "POST",
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        gateway: gatewayKey,
        token,
        refresh_token: refreshToken,
        expires_at: new Date(expiresAtMs).toISOString(),
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    // Non-fatal: in-memory cache still holds the token for this isolate
  }
}

/**
 * Retrieves a valid bKash `id_token` using:
 *  1. Isolate memory cache (with 2-minute buffer)
 *  2. Supabase `payment_gateway_tokens` table (shared across edge isolates)
 *  3. Token Refresh API (if `refresh_token` is available)
 *  4. Token Grant API (single-flight guarded)
 */
export async function getValidBkashToken(
  cfg: Config,
  env: Env,
  forceRefresh = false
): Promise<string> {
  const creds = requireBkashCredentials(cfg, env);
  const now = Date.now();
  const safetyBufferMs = 120_000; // 2 minutes
  const gatewayKey = creds.mode === "live" ? "bkash" : "bkash_sandbox";

  if (!forceRefresh && memTokenCache && memTokenCache.mode === creds.mode && memTokenCache.expiresAt > now + safetyBufferMs) {
    return memTokenCache.token;
  }

  if (inFlightTokenPromise && !forceRefresh) {
    return inFlightTokenPromise;
  }

  const acquire = async (): Promise<string> => {
    let existingRefreshToken: string | null = memTokenCache?.mode === creds.mode ? memTokenCache.refreshToken : null;

    if (!forceRefresh) {
      const dbRow = await fetchCachedTokenFromDb(cfg, gatewayKey);
      if (dbRow) {
        const expMs = new Date(dbRow.expires_at).getTime();
        if (Number.isFinite(expMs) && expMs > now + safetyBufferMs && dbRow.token) {
          memTokenCache = {
            token: dbRow.token,
            refreshToken: dbRow.refresh_token,
            expiresAt: expMs,
            mode: creds.mode,
          };
          return dbRow.token;
        }
        if (dbRow.refresh_token) {
          existingRefreshToken = dbRow.refresh_token;
        }
      }
    }

    const baseUrl = getBkashBaseUrl(creds.mode);

    // Try token/refresh first if we have a refresh_token
    if (existingRefreshToken) {
      try {
        const refreshRes = await fetch(`${baseUrl}/tokenized/checkout/token/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: creds.username,
            password: creds.password,
          },
          body: JSON.stringify({
            app_key: creds.appKey,
            app_secret: creds.appSecret,
            refresh_token: existingRefreshToken,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (refreshRes.ok) {
          const refreshData = (await refreshRes.json()) as {
            statusCode?: string;
            id_token?: string;
            refresh_token?: string;
            expires_in?: number;
          };
          if (refreshData.statusCode === "0000" && refreshData.id_token) {
            const expiresAtMs = Date.now() + (refreshData.expires_in || 3600) * 1000;
            const nextRefresh = refreshData.refresh_token || existingRefreshToken;
            memTokenCache = {
              token: refreshData.id_token,
              refreshToken: nextRefresh,
              expiresAt: expiresAtMs,
              mode: creds.mode,
            };
            await persistTokenToDb(cfg, gatewayKey, refreshData.id_token, nextRefresh, expiresAtMs);
            return refreshData.id_token;
          }
        }
      } catch {
        // Fall through to full token/grant
      }
    }

    // Full token/grant
    let grantRes: Response;
    try {
      grantRes = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: creds.username,
          password: creds.password,
        },
        body: JSON.stringify({
          app_key: creds.appKey,
          app_secret: creds.appSecret,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.error("[bkash] token/grant network error:", err instanceof Error ? err.message : err);
      throw new HttpError(502, "gateway_unreachable", "Could not connect to bKash gateway. Please try again.");
    }

    const grantData = (await grantRes.json().catch(() => ({}))) as {
      statusCode?: string;
      statusMessage?: string;
      id_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!grantRes.ok || grantData.statusCode !== "0000" || !grantData.id_token) {
      console.error(
        `[bkash] token/grant failed: http=${grantRes.status} code=${grantData.statusCode ?? "?"} msg=${grantData.statusMessage ?? "?"}`
      );
      throw new HttpError(502, "gateway_auth_failed", "bKash payment service could not be initialized. Please try again.");
    }

    const idToken = grantData.id_token;
    const expiresAtMs = Date.now() + (grantData.expires_in || 3600) * 1000;
    const refreshToken = grantData.refresh_token || null;

    memTokenCache = {
      token: idToken,
      refreshToken,
      expiresAt: expiresAtMs,
      mode: creds.mode,
    };

    await persistTokenToDb(cfg, gatewayKey, idToken, refreshToken, expiresAtMs);
    return idToken;
  };

  inFlightTokenPromise = acquire().finally(() => {
    inFlightTokenPromise = null;
  });

  return inFlightTokenPromise;
}

function isTokenExpiredResponse(httpStatus: number, statusCode?: string, message?: string): boolean {
  if (httpStatus === 401 || httpStatus === 403) return true;
  if (statusCode === "2001" || statusCode === "9999") return true;
  if (message && /token|unauthorized|expired/i.test(message)) return true;
  return false;
}

/**
 * Creates a bKash Tokenized Checkout session (`mode: "0011"`).
 * `merchantInvoiceNumber` is set to our server-generated `gatewayOrderRef` (`SBP...`).
 */
export async function createBkashPayment(
  cfg: Config,
  env: Env,
  params: {
    merchantInvoiceNumber: string;
    amount: number;
    customerPhone: string;
    callbackUrl: string;
  }
): Promise<{ paymentID: string; bkashURL: string }> {
  const creds = requireBkashCredentials(cfg, env);
  const baseUrl = getBkashBaseUrl(creds.mode);

  const attemptCreate = async (forceRefreshToken: boolean) => {
    const token = await getValidBkashToken(cfg, env, forceRefreshToken);
    const res = await fetch(`${baseUrl}/tokenized/checkout/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-APP-Key": creds.appKey,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: params.customerPhone,
        callbackURL: params.callbackUrl,
        amount: params.amount.toFixed(2),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: params.merchantInvoiceNumber,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      statusCode?: string;
      statusMessage?: string;
      paymentID?: string;
      bkashURL?: string;
    };
    return { res, data };
  };

  let { res, data } = await attemptCreate(false);
  if (isTokenExpiredResponse(res.status, data.statusCode, data.statusMessage)) {
    ({ res, data } = await attemptCreate(true));
  }

  if (!res.ok || data.statusCode !== "0000" || !data.bkashURL || !data.paymentID) {
    console.error(
      `[bkash] create failed: http=${res.status} code=${data.statusCode ?? "?"} msg=${data.statusMessage ?? "?"}`
    );
    throw new HttpError(
      502,
      "gateway_create_failed",
      data.statusMessage || "Could not create bKash payment session. Please try again."
    );
  }

  return { paymentID: data.paymentID, bkashURL: data.bkashURL };
}

export interface BkashGatewayPayload {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  trxID?: string;
  amount?: string;
  currency?: string;
  customerMsisdn?: string;
  merchantInvoiceNumber?: string;
  transactionStatus?: string;
  [key: string]: unknown;
}

/**
 * Calls bKash `tokenized/checkout/execute`.
 */
export async function executeBkashPayment(
  cfg: Config,
  env: Env,
  paymentID: string
): Promise<{ httpOk: boolean; httpStatus: number; data: BkashGatewayPayload }> {
  const creds = requireBkashCredentials(cfg, env);
  const baseUrl = getBkashBaseUrl(creds.mode);

  const attemptExec = async (forceRefreshToken: boolean) => {
    const token = await getValidBkashToken(cfg, env, forceRefreshToken);
    const res = await fetch(`${baseUrl}/tokenized/checkout/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-APP-Key": creds.appKey,
      },
      body: JSON.stringify({ paymentID }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as BkashGatewayPayload;
    return { res, data };
  };

  let { res, data } = await attemptExec(false);
  if (isTokenExpiredResponse(res.status, data.statusCode, data.statusMessage)) {
    ({ res, data } = await attemptExec(true));
  }

  return { httpOk: res.ok, httpStatus: res.status, data };
}

/**
 * Calls bKash `tokenized/checkout/payment/status` (Query Payment fallback).
 */
export async function queryBkashPayment(
  cfg: Config,
  env: Env,
  paymentID: string
): Promise<{ httpOk: boolean; httpStatus: number; data: BkashGatewayPayload }> {
  const creds = requireBkashCredentials(cfg, env);
  const baseUrl = getBkashBaseUrl(creds.mode);

  const attemptQuery = async (forceRefreshToken: boolean) => {
    const token = await getValidBkashToken(cfg, env, forceRefreshToken);
    const res = await fetch(`${baseUrl}/tokenized/checkout/payment/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-APP-Key": creds.appKey,
      },
      body: JSON.stringify({ paymentID }),
      signal: AbortSignal.timeout(12_000),
    });
    const data = (await res.json().catch(() => ({}))) as BkashGatewayPayload;
    return { res, data };
  };

  let { res, data } = await attemptQuery(false);
  if (isTokenExpiredResponse(res.status, data.statusCode, data.statusMessage)) {
    ({ res, data } = await attemptQuery(true));
  }

  return { httpOk: res.ok, httpStatus: res.status, data };
}

export interface BkashSettlementOutcome {
  ok: boolean;
  pending: boolean;
  statusCode: string;
  statusMessage: string;
  trxID?: string;
  amount?: number;
  currency?: string;
  customerMsisdn?: string;
  merchantInvoiceNumber?: string;
  transactionStatus?: string;
  raw: Record<string, unknown>;
}

/**
 * Executes a bKash payment and automatically falls back to Query Payment if:
 *  - Execute throws a network/timeout error (per bKash PGW spec), OR
 *  - Execute returns statusCode "2062" (already completed) or "2029" / "9999" (system busy/ambiguous)
 *    or non-Completed transactionStatus.
 */
export async function settleBkashPayment(
  cfg: Config,
  env: Env,
  paymentID: string
): Promise<BkashSettlementOutcome> {
  let execData: BkashGatewayPayload | null = null;
  let execErr: string | null = null;

  try {
    const execRes = await executeBkashPayment(cfg, env, paymentID);
    execData = execRes.data;
  } catch (err) {
    execErr = err instanceof Error ? err.message : String(err);
  }

  const isCompleted = (d: BkashGatewayPayload | null): boolean =>
    Boolean(
      d &&
        d.statusCode === "0000" &&
        d.transactionStatus === "Completed" &&
        typeof d.trxID === "string" &&
        d.trxID.trim() !== ""
    );

  if (isCompleted(execData)) {
    return {
      ok: true,
      pending: false,
      statusCode: "0000",
      statusMessage: execData!.statusMessage || "Successful",
      trxID: execData!.trxID!.trim(),
      amount: Number(execData!.amount),
      currency: String(execData!.currency || "BDT"),
      customerMsisdn: execData!.customerMsisdn ? String(execData!.customerMsisdn) : undefined,
      merchantInvoiceNumber: execData!.merchantInvoiceNumber
        ? String(execData!.merchantInvoiceNumber)
        : undefined,
      transactionStatus: execData!.transactionStatus,
      raw: { source: "execute", execute: execData },
    };
  }

  // Decide whether to consult Query Payment fallback
  const ambiguousCodes = new Set(["2062", "2029", "9999", "2023"]);
  const shouldQuery =
    execErr !== null ||
    !execData ||
    !execData.statusCode ||
    ambiguousCodes.has(execData.statusCode) ||
    (execData.statusCode === "0000" && execData.transactionStatus !== "Completed");

  if (shouldQuery) {
    try {
      const queryRes = await queryBkashPayment(cfg, env, paymentID);
      const qData = queryRes.data;
      if (isCompleted(qData)) {
        return {
          ok: true,
          pending: false,
          statusCode: "0000",
          statusMessage: qData.statusMessage || "Verified via Query Payment",
          trxID: qData.trxID!.trim(),
          amount: Number(qData.amount),
          currency: String(qData.currency || "BDT"),
          customerMsisdn: qData.customerMsisdn ? String(qData.customerMsisdn) : undefined,
          merchantInvoiceNumber: qData.merchantInvoiceNumber
            ? String(qData.merchantInvoiceNumber)
            : undefined,
          transactionStatus: qData.transactionStatus,
          raw: { source: "query_fallback", executeError: execErr, execute: execData, query: qData },
        };
      }

      if (qData.transactionStatus === "Initiated" || qData.transactionStatus === "Authorized") {
        return {
          ok: false,
          pending: true,
          statusCode: qData.statusCode || "PENDING",
          statusMessage: qData.statusMessage || "Payment is still in progress",
          raw: { source: "query_fallback", executeError: execErr, execute: execData, query: qData },
        };
      }

      return {
        ok: false,
        pending: false,
        statusCode: qData.statusCode || execData?.statusCode || "ERR",
        statusMessage: qData.statusMessage || execData?.statusMessage || execErr || "bKash payment failed",
        raw: { source: "query_fallback", executeError: execErr, execute: execData, query: qData },
      };
    } catch (qErr) {
      return {
        ok: false,
        pending: true,
        statusCode: "NETWORK_TIMEOUT",
        statusMessage: qErr instanceof Error ? qErr.message : "bKash verification timed out",
        raw: { executeError: execErr, execute: execData },
      };
    }
  }

  return {
    ok: false,
    pending: false,
    statusCode: execData?.statusCode || "ERR",
    statusMessage: execData?.statusMessage || "bKash execution declined",
    raw: { source: "execute", execute: execData },
  };
}
