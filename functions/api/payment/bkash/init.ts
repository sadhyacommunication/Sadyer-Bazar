/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/bkash/init
 * Automated bKash Hosted Session Initiation (Zero-Client-Trust)
 */

import {
  BkashEnv,
  createBkashPayment,
  isBkashConfigured,
} from "../_lib/bkashClient";

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
  env: BkashEnv;
}): Promise<Response> {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { orderCode, paymentType = "full" } = body as {
      orderCode?: string;
      paymentType?: "full" | "advance" | "due";
    };

    if (!orderCode) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required orderCode" }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    if (!isBkashConfigured(env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "bKash Merchant credentials are not configured on the server",
          unconfigured: true,
        }),
        { status: 503, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Fetch genuine order record from database (Zero Client Trust)
    const orderRes = await fetch(
      `${supabaseUrl}/rest/v1/orders?order_code=eq.${encodeURIComponent(
        orderCode.trim().toUpperCase()
      )}&select=*`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (!orderRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Database error fetching order" }),
        { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const orders = await orderRes.json();
    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: `Order ${orderCode} not found` }),
        { status: 404, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const order = orders[0];

    // Check if order is already paid
    if (order.payment_status === "paid" && Number(order.due_amount) <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "This order is already fully paid.",
        }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // 2. Strict Amount Calculation on Server
    let payableAmount = 0;
    if (paymentType === "due") {
      payableAmount = Number(order.due_amount);
    } else if (paymentType === "advance") {
      const advancePercent = 25; // default 25% advance
      const discountedSubtotal = Math.max(
        0,
        Number(order.subtotal) - Number(order.discount_amount || 0)
      );
      const calculatedAdvance = Math.round(
        (discountedSubtotal * advancePercent) / 100
      );
      payableAmount = Math.max(Number(order.delivery_charge), calculatedAdvance);
    } else {
      payableAmount = Number(order.total_amount);
    }

    if (payableAmount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid payment amount calculated" }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    // 3. Construct Callback URL
    const siteUrl = (
      env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    ).replace(/\/$/, "");

    const callbackUrl = `${siteUrl}/api/payment/bkash/callback?orderCode=${encodeURIComponent(
      order.order_code
    )}&paymentType=${encodeURIComponent(paymentType)}`;

    // 4. Create bKash Payment Session
    const bkashRes = await createBkashPayment(env, {
      orderCode: order.order_code,
      amount: payableAmount,
      customerPhone: order.customer_phone,
      callbackUrl,
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentID: bkashRes.paymentID,
        bkashURL: bkashRes.bkashURL,
        amount: payableAmount,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
    );
  }
}
