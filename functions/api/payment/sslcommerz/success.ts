/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/sslcommerz/success
 * SSLCommerz Callback Handler: Server-to-Server Validation & Database Sync
 * 
 * Rules:
 * - Never trust client POST data alone. Always verify with SSLCommerz validationserverAPI.php.
 * - Enforce BDT currency and matching tran_id.
 * - Call Supabase RPC `verify_and_record_payment` with service_role key to update order atomically.
 * - Idempotency is enforced by `processed_webhook_events` in the database.
 * - Redirect customer to `/track-order?code=<TRAN_ID>&payment=success&gateway=sslcommerz`.
 */

interface Env {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SSLCOMMERZ_STORE_ID?: string;
  SSLCOMMERZ_STORE_PASSWORD?: string;
  SSLCOMMERZ_IS_LIVE?: string;
}

async function handleSuccess(request: Request, env: Env): Promise<Response> {
  const siteUrl = (
    env.NEXT_PUBLIC_SITE_URL ||
    new URL(request.url).origin ||
    "https://sadhyerbazar.com"
  ).replace(/\/$/, "");

  let payload: Record<string, any> = {};

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await request.json().catch(() => ({}));
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    } else {
      // Fallback: check URL search params for GET callbacks or redirects
      const url = new URL(request.url);
      url.searchParams.forEach((value, key) => {
        payload[key] = value;
      });
    }
  } catch (parseErr) {
    console.error("Error parsing SSLCommerz success payload:", parseErr);
  }

  const tranId = String(payload.tran_id || payload.orderCode || "").trim().toUpperCase();
  const valId = String(payload.val_id || payload.validation_id || "").trim();

  if (!tranId) {
    return Response.redirect(`${siteUrl}/track-order?payment=failed&reason=missing_tran_id`, 303);
  }

  if (!valId) {
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(tranId)}&payment=failed&reason=missing_val_id`,
      303
    );
  }

  // 1. SSLCommerz Server-Side Gateway Validation API (Zero Client Trust)
  const isLive = env.SSLCOMMERZ_IS_LIVE === "true";
  let storeId = env.SSLCOMMERZ_STORE_ID?.trim() || "";
  let storePasswd = env.SSLCOMMERZ_STORE_PASSWORD?.trim() || "";

  if (!storeId || !storePasswd) {
    if (!isLive) {
      storeId = "testbox";
      storePasswd = "qwerty";
    } else {
      return Response.redirect(
        `${siteUrl}/track-order?code=${encodeURIComponent(tranId)}&payment=failed&reason=gateway_credentials_missing`,
        303
      );
    }
  }

  const sslHost = isLive
    ? "https://securepay.sslcommerz.com"
    : "https://sandbox.sslcommerz.com";

  const validationUrl = `${sslHost}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
    valId
  )}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(
    storePasswd
  )}&v=1&format=json`;

  try {
    const valRes = await fetch(validationUrl);
    if (!valRes.ok) {
      return Response.redirect(
        `${siteUrl}/track-order?code=${encodeURIComponent(tranId)}&payment=failed&reason=validation_network_error`,
        303
      );
    }

    const valData = (await valRes.json()) as {
      status: string;
      tran_id: string;
      amount: string | number;
      currency: string;
      bank_tran_id?: string;
      card_type?: string;
      card_brand?: string;
      card_issuer?: string;
      card_no?: string;
      [key: string]: any;
    };

    if (valData.status !== "VALID" && valData.status !== "VALIDATED") {
      return Response.redirect(
        `${siteUrl}/track-order?code=${encodeURIComponent(tranId)}&payment=failed&reason=${encodeURIComponent(
          valData.status || "invalid_status"
        )}`,
        303
      );
    }

    // Currency verification: Anti-currency-arbitrage
    const reportedCurrency = String(valData.currency || "BDT").trim().toUpperCase();
    if (reportedCurrency !== "BDT") {
      return Response.redirect(
        `${siteUrl}/track-order?code=${encodeURIComponent(tranId)}&payment=failed&reason=currency_mismatch`,
        303
      );
    }

    // Order reference verification
    if (valData.tran_id.trim().toUpperCase() !== tranId) {
      return Response.redirect(
        `${siteUrl}/track-order?code=${encodeURIComponent(tranId)}&payment=failed&reason=order_mismatch`,
        303
      );
    }

    // 2. Record Verified Payment in Supabase via RPC (Service Role)
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const paidAmount = Number(valData.amount);
      const cardPhone =
        valData.card_issuer ||
        valData.card_brand ||
        valData.card_type ||
        valData.card_no ||
        null;

      await fetch(`${supabaseUrl}/rest/v1/rpc/verify_and_record_payment`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_order_code: tranId,
          p_gateway: "sslcommerz",
          p_transaction_id: valId,
          p_validation_id: valData.bank_tran_id || valId,
          p_amount: paidAmount,
          p_currency: "BDT",
          p_sender_phone: cardPhone,
          p_raw_payload: valData,
        }),
      });
    }

    // 3. Clean Redirect to Track Order Confirmation
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(tranId)}&payment=success&gateway=sslcommerz`,
      303
    );
  } catch (err) {
    console.error("SSLCommerz verification exception:", err);
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(tranId)}&payment=failed&reason=internal_error`,
      303
    );
  }
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return handleSuccess(context.request, context.env);
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return handleSuccess(context.request, context.env);
}
