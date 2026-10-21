/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/nagad/callback
 * Handles Nagad PGW Redirect Callback, Verifies via Nagad Verification API,
 * and Atomically Records in Supabase.
 */

import { getNagadBaseUrl, NagadEnv } from "../_lib/nagadCrypto";

export async function onRequestGet(context: {
  request: Request;
  env: NagadEnv;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  // Nagad can return either payment_ref_id or paymentRef in query
  const paymentRefId =
    url.searchParams.get("payment_ref_id") ||
    url.searchParams.get("paymentRef") ||
    "";
  const statusParam = url.searchParams.get("status") || "";
  const orderCode = url.searchParams.get("orderCode") || "";

  const siteUrl = (
    env.NEXT_PUBLIC_SITE_URL || url.origin
  ).replace(/\/$/, "");

  if (statusParam && statusParam.toLowerCase() !== "success") {
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(
        orderCode
      )}&payment=failed&gateway=nagad&reason=${encodeURIComponent(statusParam)}`,
      302
    );
  }

  if (!paymentRefId) {
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(
        orderCode
      )}&payment=failed&gateway=nagad&reason=missing_payment_ref`,
      302
    );
  }

  try {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return Response.redirect(
        `${siteUrl}/track-order?code=${encodeURIComponent(
          orderCode
        )}&payment=failed&reason=server_config`,
        302
      );
    }

    const isLive = env.NAGAD_IS_LIVE === "true";
    const baseUrl = getNagadBaseUrl(isLive);

    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      "103.100.100.1";

    // 1. Direct Server-to-Server Verification with Nagad Gateway
    const verifyUrl = `${baseUrl}/verify/payment/${paymentRefId}`;
    const verifyRes = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-KM-Api-Version": "v-0.2.0",
        "X-KM-IP-Add": clientIp,
        "X-KM-Client-Type": "PC_WEB",
      },
    });

    const verifyData = (await verifyRes.json()) as {
      status?: string;
      statusCode?: string;
      amount?: string;
      orderId?: string;
      clientMobileNo?: string;
      issuerPaymentRefNo?: string;
      message?: string;
    };

    if (!verifyRes.ok || verifyData.status !== "Success") {
      return Response.redirect(
        `${siteUrl}/track-order?code=${encodeURIComponent(
          orderCode
        )}&payment=failed&gateway=nagad&reason=${encodeURIComponent(
          verifyData.message || verifyData.status || "Nagad Verification Failed"
        )}`,
        302
      );
    }

    const paidAmount = Number(verifyData.amount);
    const trxID = String(
      verifyData.issuerPaymentRefNo || paymentRefId
    ).trim();

    // 2. Atomically Record & Verify in Supabase via SECURITY DEFINER procedure
    const rpcRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/verify_and_record_payment`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_order_code: orderCode,
          p_gateway: "nagad",
          p_transaction_id: trxID,
          p_validation_id: paymentRefId,
          p_amount: paidAmount,
          p_currency: "BDT",
          p_sender_phone: verifyData.clientMobileNo || null,
          p_raw_payload: verifyData,
        }),
      }
    );

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      console.error("Supabase payment recording error:", errText);
    }

    // 3. Redirect customer to order tracking page with verified receipt
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(
        orderCode
      )}&payment=success&gateway=nagad&trx=${encodeURIComponent(trxID)}`,
      302
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification exception";
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(
        orderCode
      )}&payment=failed&reason=${encodeURIComponent(message)}`,
      302
    );
  }
}
