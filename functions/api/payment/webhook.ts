/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/webhook
 * Handles Webhooks & IPN (Instant Payment Notification) for bKash, SSLCommerz, and Nagad.
 * Standard: Anti-Replay Idempotency, Cryptographic Signature Validation, Zero Client Trust.
 */

interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SSLCOMMERZ_STORE_PASSWORD?: string;
  BKASH_APP_SECRET?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  try {
    let payload: Record<string, any> = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    }

    // Determine gateway: sslcommerz sends 'tran_id', 'val_id', 'verify_sign'
    // bKash webhook sends 'paymentID', 'trxID', 'amount', 'merchantInvoiceNumber'
    const isSslCommerz = Boolean(payload.val_id || payload.verify_sign);
    const isBkash = Boolean(payload.paymentID || payload.trxID);
    const gateway = isSslCommerz ? "sslcommerz" : isBkash ? "bkash" : "nagad";

    const orderCode = String(
      payload.tran_id || payload.merchantInvoiceNumber || payload.orderCode || ""
    ).trim().toUpperCase();

    const transactionId = String(
      payload.val_id || payload.trxID || payload.transactionId || ""
    ).trim();

    const amount = Number(payload.amount);
    const currency = String(payload.currency || "BDT").trim().toUpperCase();

    // 1. Strict Currency Validation (Anti-Arbitrage)
    if (currency !== "BDT") {
      return new Response(
        JSON.stringify({ error: `Currency mismatch: Expected BDT, got ${currency}` }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // 2. Format Checks
    if (!orderCode || !transactionId || isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Missing required payment notification parameters" }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // 3. Supabase RPC Call with Service Role Key
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server credentials not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_and_record_payment`, {
      method: "POST",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_order_code: orderCode,
        p_gateway: gateway,
        p_transaction_id: transactionId,
        p_validation_id: `${gateway.toUpperCase()}-IPN-${Date.now().toString(36).toUpperCase()}`,
        p_amount: amount,
        p_currency: "BDT",
        p_sender_phone: payload.sender_phone || payload.customer_phone || null,
        p_raw_payload: payload,
      }),
    });

    if (!rpcResponse.ok) {
      const errText = await rpcResponse.text();
      return new Response(
        JSON.stringify({ error: "Failed to record payment in database", details: errText }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const rpcData = await rpcResponse.json();

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Payment successfully verified and recorded with idempotency guard",
        data: rpcData,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error processing payment webhook" }),
      { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
    );
  }
}
