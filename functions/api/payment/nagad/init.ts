/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/nagad/init
 * Automated Nagad Hosted Session Initiation using Asymmetric Cryptography
 */

import {
  decryptWithPrivateKey,
  encryptAes128,
  encryptWithPublicKey,
  generateRandomString,
  getNagadBaseUrl,
  getNagadDateTime,
  isNagadConfigured,
  NagadEnv,
  signWithPrivateKey,
} from "../_lib/nagadCrypto";

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
  env: NagadEnv;
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

    if (!isNagadConfigured(env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nagad Merchant credentials or RSA keys are not configured on the server",
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
      const advancePercent = 25;
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

    const isLive = env.NAGAD_IS_LIVE === "true";
    const baseUrl = getNagadBaseUrl(isLive);
    const merchantId = env.NAGAD_MERCHANT_ID || "";
    const privateKey = env.NAGAD_PRIVATE_KEY || "";
    const nagadPublicKey = env.NAGAD_PUBLIC_KEY || "";

    const siteUrl = (
      env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    ).replace(/\/$/, "");

    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      "103.100.100.1";

    const commonHeaders = {
      "Content-Type": "application/json",
      "X-KM-Api-Version": "v-0.2.0",
      "X-KM-IP-Add": clientIp,
      "X-KM-Client-Type": "PC_WEB",
    };

    // ------------------------------------------------------------------------
    // STEP 1: INITIALIZE CHECKOUT (Challenge Exchange)
    // ------------------------------------------------------------------------
    const challenge = generateRandomString(20);
    const orderId = `${order.order_code}-${Date.now().toString(36).slice(-4)}`;
    const dateTime = getNagadDateTime();

    const initSensitive = {
      merchantId,
      datetime: dateTime,
      orderId,
      challenge,
    };

    const initSensitiveStr = JSON.stringify(initSensitive);
    const encryptedSensitive = encryptWithPublicKey(initSensitiveStr, nagadPublicKey);
    const signature = signWithPrivateKey(initSensitiveStr, privateKey);

    const initUrl = `${baseUrl}/check-out/initialize/${merchantId}/${orderId}`;
    const initRes = await fetch(initUrl, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        dateTime,
        sensitiveData: encryptedSensitive,
        signature,
      }),
    });

    const initData = (await initRes.json()) as {
      sensitiveData?: string;
      signature?: string;
      reason?: string;
      message?: string;
    };

    if (!initRes.ok || !initData.sensitiveData) {
      throw new Error(
        `Nagad Initialization Failed: ${initData.message || initData.reason || "Invalid response from Nagad"}`
      );
    }

    // Decrypt Nagad's response with our Private Key
    const decryptedInit = decryptWithPrivateKey(initData.sensitiveData, privateKey);
    const parsedInit = JSON.parse(decryptedInit) as {
      paymentReferenceId?: string;
      challenge?: string;
    };

    if (!parsedInit.paymentReferenceId || !parsedInit.challenge) {
      throw new Error("Nagad challenge decryption yielded invalid response");
    }

    const paymentReferenceId = parsedInit.paymentReferenceId;

    // ------------------------------------------------------------------------
    // STEP 2: COMPLETE CHECKOUT & RECEIVE REDIRECT URL
    // ------------------------------------------------------------------------
    const callbackUrl = `${siteUrl}/api/payment/nagad/callback?orderCode=${encodeURIComponent(
      order.order_code
    )}&paymentRef=${encodeURIComponent(paymentReferenceId)}`;

    const completeSensitive = {
      merchantId,
      orderId,
      currencyCode: "050", // ISO 4217 for BDT
      amount: payableAmount.toFixed(2),
      challenge: parsedInit.challenge,
    };

    const completeSensitiveStr = JSON.stringify(completeSensitive);
    const encryptedComplete = encryptWithPublicKey(completeSensitiveStr, nagadPublicKey);
    const completeSignature = signWithPrivateKey(completeSensitiveStr, privateKey);

    const completeUrl = `${baseUrl}/check-out/complete/${paymentReferenceId}`;
    const completeRes = await fetch(completeUrl, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        sensitiveData: encryptedComplete,
        signature: completeSignature,
        merchantCallbackURL: callbackUrl,
      }),
    });

    const completeData = (await completeRes.json()) as {
      status?: string;
      callBackUrl?: string;
      message?: string;
    };

    if (!completeRes.ok || completeData.status !== "Success" || !completeData.callBackUrl) {
      throw new Error(
        `Nagad Checkout Complete Failed: ${completeData.message || "Failed to generate redirect URL"}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        callBackUrl: completeData.callBackUrl,
        paymentReferenceId,
        amount: payableAmount,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
    );
  }
}
