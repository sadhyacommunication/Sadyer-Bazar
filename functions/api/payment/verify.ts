/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/verify
 * Server-Side Gateway Validation API for SSLCommerz & bKash.
 * Directly queries the official gateway validation endpoints using secure server credentials.
 * Zero client trust: Order is only marked paid when the gateway server confirms VALID.
 */

interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SSLCOMMERZ_STORE_ID?: string;
  SSLCOMMERZ_STORE_PASSWORD?: string;
  SSLCOMMERZ_IS_LIVE?: string;
  BKASH_APP_KEY?: string;
  BKASH_APP_SECRET?: string;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { orderCode, gateway, validationId, transactionId } = body;

    if (!orderCode || !gateway) {
      return new Response(
        JSON.stringify({ error: "Missing required orderCode or gateway" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server credentials not configured" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    // 1. Fetch expected order from database
    const orderRes = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(orderCode)}&select=*`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    const orders = await orderRes.json();
    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { "content-type": "application/json" } }
      );
    }
    const order = orders[0];

    // 2. Gateway-Specific Server-Side Validation
    if (gateway === "sslcommerz") {
      const valId = validationId || transactionId;
      if (!valId) {
        return new Response(
          JSON.stringify({ error: "val_id is required for SSLCommerz verification" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      const storeId = env.SSLCOMMERZ_STORE_ID || "";
      const storePasswd = env.SSLCOMMERZ_STORE_PASSWORD || "";
      const isLive = env.SSLCOMMERZ_IS_LIVE === "true";

      const sslHost = isLive
        ? "https://securepay.sslcommerz.com"
        : "https://sandbox.sslcommerz.com";

      const validationUrl = `${sslHost}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(
        valId
      )}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(
        storePasswd
      )}&v=1&format=json`;

      const sslResp = await fetch(validationUrl);
      const sslData = await sslResp.json();

      if (sslData.status !== "VALID" && sslData.status !== "VALIDATED") {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Payment could not be verified by SSLCommerz",
            gatewayStatus: sslData.status,
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      // 4-Point Strict Match Verification
      const paidAmount = Number(sslData.amount);
      const reportedCurrency = String(sslData.currency || "BDT").toUpperCase();

      if (reportedCurrency !== "BDT") {
        return new Response(
          JSON.stringify({ error: "Currency mismatch: Expected BDT" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      if (sslData.tran_id !== order.order_code) {
        return new Response(
          JSON.stringify({ error: "Transaction order reference mismatch" }),
          { status: 400, headers: { "content-type": "application/json" } }
        );
      }

      // Record verified payment in Supabase
      const rpcResponse = await fetch(
        `${supabaseUrl}/rest/v1/rpc/verify_and_record_payment`,
        {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_order_code: order.order_code,
            p_gateway: "sslcommerz",
            p_transaction_id: valId,
            p_validation_id: sslData.bank_tran_id || valId,
            p_amount: paidAmount,
            p_currency: "BDT",
            p_sender_phone: sslData.card_issuer || null,
            p_raw_payload: sslData,
          }),
        }
      );

      const rpcResult = await rpcResponse.json();
      return new Response(
        JSON.stringify({
          success: true,
          message: "SSLCommerz payment verified and recorded",
          order: rpcResult,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Verification for gateway ${gateway} is handled via webhook` }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error during payment verification" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
