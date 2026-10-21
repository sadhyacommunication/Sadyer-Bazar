/**
 * bKash Tokenized Checkout (PGW v1.2.0-beta) Enterprise Client
 * Implements Zero-Client-Trust, Auto Token Caching (Edge + Supabase),
 * Rate-Limit Guarding, Create Payment, and Execute Payment.
 */

export interface BkashEnv {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  BKASH_APP_KEY?: string;
  BKASH_APP_SECRET?: string;
  BKASH_USERNAME?: string;
  BKASH_PASSWORD?: string;
  BKASH_IS_LIVE?: string;
}

// In-memory token cache fallback for hot Cloudflare isolate
let memTokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

export function getBkashBaseUrl(isLive: boolean): string {
  return isLive
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
}

export function isBkashConfigured(env: BkashEnv): boolean {
  return Boolean(
    env.BKASH_APP_KEY &&
    env.BKASH_APP_SECRET &&
    env.BKASH_USERNAME &&
    env.BKASH_PASSWORD
  );
}

/**
 * Retrieves valid bKash id_token, using cached token if not expired.
 * Prevents bKash rate-limit bans caused by requesting tokens on every transaction.
 */
export async function getValidBkashToken(env: BkashEnv): Promise<string> {
  const now = Date.now();

  // 1. Check in-memory isolate cache (valid with 2-minute safety buffer)
  if (memTokenCache && memTokenCache.expiresAt > now + 120_000) {
    return memTokenCache.token;
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  // 2. Check Supabase DB token cache (shared across all edge instances)
  if (supabaseUrl && serviceKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/payment_gateway_tokens?gateway=eq.bkash&select=*`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          token: string;
          expires_at: string;
        }>;
        if (rows.length > 0) {
          const exp = new Date(rows[0].expires_at).getTime();
          if (exp > now + 120_000) {
            memTokenCache = { token: rows[0].token, expiresAt: exp };
            return rows[0].token;
          }
        }
      }
    } catch {
      // Continue to fresh grant if database cache lookup fails
    }
  }

  // 3. Grant a fresh token from bKash PGW
  const isLive = env.BKASH_IS_LIVE === "true";
  const baseUrl = getBkashBaseUrl(isLive);

  const grantRes = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: env.BKASH_USERNAME || "",
      password: env.BKASH_PASSWORD || "",
    },
    body: JSON.stringify({
      app_key: env.BKASH_APP_KEY,
      app_secret: env.BKASH_APP_SECRET,
    }),
  });

  const grantData = (await grantRes.json()) as {
    statusCode?: string;
    statusMessage?: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!grantRes.ok || grantData.statusCode !== "0000" || !grantData.id_token) {
    throw new Error(
      `bKash Token Grant Failed: [${grantData.statusCode || "ERR"}] ${
        grantData.statusMessage || "Unknown bKash auth error"
      }`
    );
  }

  const idToken = grantData.id_token;
  const expiresInMs = (grantData.expires_in || 3600) * 1000;
  const expiresAtMs = now + expiresInMs;

  memTokenCache = { token: idToken, expiresAt: expiresAtMs };

  // Persist to Supabase cache table for other workers
  if (supabaseUrl && serviceKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/payment_gateway_tokens`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          gateway: "bkash",
          token: idToken,
          refresh_token: grantData.refresh_token || null,
          expires_at: new Date(expiresAtMs).toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    } catch {}
  }

  return idToken;
}

/**
 * Creates bKash payment session and returns gateway payment URL
 */
export async function createBkashPayment(
  env: BkashEnv,
  params: {
    orderCode: string;
    amount: number;
    customerPhone: string;
    callbackUrl: string;
  }
): Promise<{ paymentID: string; bkashURL: string }> {
  const isLive = env.BKASH_IS_LIVE === "true";
  const baseUrl = getBkashBaseUrl(isLive);
  const token = await getValidBkashToken(env);

  const res = await fetch(`${baseUrl}/tokenized/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-APP-Key": env.BKASH_APP_KEY || "",
    },
    body: JSON.stringify({
      mode: "0011",
      payerReference: params.customerPhone,
      callbackURL: params.callbackUrl,
      amount: params.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.orderCode,
    }),
  });

  const data = (await res.json()) as {
    statusCode?: string;
    statusMessage?: string;
    paymentID?: string;
    bkashURL?: string;
  };

  if (!res.ok || data.statusCode !== "0000" || !data.bkashURL || !data.paymentID) {
    throw new Error(
      `bKash Payment Creation Failed: [${data.statusCode || "ERR"}] ${
        data.statusMessage || "Invalid response from bKash"
      }`
    );
  }

  return { paymentID: data.paymentID, bkashURL: data.bkashURL };
}

/**
 * Executes confirmed bKash payment
 */
export async function executeBkashPayment(
  env: BkashEnv,
  paymentID: string
): Promise<{
  statusCode: string;
  statusMessage?: string;
  trxID?: string;
  amount?: string;
  currency?: string;
  customerMsisdn?: string;
  merchantInvoiceNumber?: string;
  transactionStatus?: string;
}> {
  const isLive = env.BKASH_IS_LIVE === "true";
  const baseUrl = getBkashBaseUrl(isLive);
  const token = await getValidBkashToken(env);

  const res = await fetch(`${baseUrl}/tokenized/checkout/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-APP-Key": env.BKASH_APP_KEY || "",
    },
    body: JSON.stringify({ paymentID }),
  });

  const data = await res.json();
  return data;
}

/**
 * Queries payment status if callback was missed or network failed
 */
export async function queryBkashPayment(
  env: BkashEnv,
  paymentID: string
): Promise<Record<string, any>> {
  const isLive = env.BKASH_IS_LIVE === "true";
  const baseUrl = getBkashBaseUrl(isLive);
  const token = await getValidBkashToken(env);

  const res = await fetch(`${baseUrl}/tokenized/checkout/payment/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-APP-Key": env.BKASH_APP_KEY || "",
    },
    body: JSON.stringify({ paymentID }),
  });

  return await res.json();
}
