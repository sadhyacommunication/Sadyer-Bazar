/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/bkash/callback
 * Handles bKash PGW Redirect Callback, Executes Payment, and Validates via Supabase.
 */

import { BkashEnv, executeBkashPayment } from "../_lib/bkashClient";

export async function onRequestGet(context: {
  request: Request;
  env: BkashEnv;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const paymentID = url.searchParams.get("paymentID") || "";
  const status = url.searchParams.get("status") || "";
  const orderCode = url.searchParams.get("orderCode") || "";

  const siteUrl = (
    env.NEXT_PUBLIC_SITE_URL || url.origin
  ).replace(/\/$/, "");

  // 1. Handle user cancellation or gateway failure
  if (status !== "success" || !paymentID) {
    const errorParam = status === "cancel" ? "cancelled" : "failed";
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(
        orderCode
      )}&payment=${errorParam}&gateway=bkash`,
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

    // 2. Execute Payment on bKash PGW (Zero Client Trust)
    const execRes = await executeBkashPayment(env, paymentID);

    if (execRes.statusCode !== "0000" || !execRes.trxID) {
      return Response.redirect(
        `${siteUrl}/track-order?code=${encodeURIComponent(
          orderCode
        )}&payment=failed&reason=${encodeURIComponent(
          execRes.statusMessage || "Execution failed"
        )}`,
        302
      );
    }

    const paidAmount = Number(execRes.amount);
    const trxID = String(execRes.trxID).trim();
    const customerMsisdn = execRes.customerMsisdn || null;

    // 3. Atomically Record & Verify in Supabase via SECURITY DEFINER procedure
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
          p_gateway: "bkash",
          p_transaction_id: trxID,
          p_validation_id: paymentID,
          p_amount: paidAmount,
          p_currency: "BDT",
          p_sender_phone: customerMsisdn,
          p_raw_payload: execRes,
        }),
      }
    );

    if (!rpcRes.ok) {
      const errText = await rpcRes.text();
      console.error("Supabase payment recording error:", errText);
    }

    // 4. Redirect customer to order tracking page with verified receipt
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(
        orderCode
      )}&payment=success&gateway=bkash&trx=${encodeURIComponent(trxID)}`,
      302
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution exception";
    return Response.redirect(
      `${siteUrl}/track-order?code=${encodeURIComponent(
        orderCode
      )}&payment=failed&reason=${encodeURIComponent(message)}`,
      302
    );
  }
}
