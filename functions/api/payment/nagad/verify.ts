/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/nagad/verify
 * Server-Side Verification Endpoint for Nagad transactions.
 */

import { getNagadBaseUrl, isNagadConfigured, NagadEnv } from "../_lib/nagadCrypto";

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
    const { paymentRefId, orderCode } = body as {
      paymentRefId?: string;
      orderCode?: string;
    };

    if (!paymentRefId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required paymentRefId" }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    if (!isNagadConfigured(env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nagad Merchant credentials are not configured",
        }),
        { status: 503, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const isLive = env.NAGAD_IS_LIVE === "true";
    const baseUrl = getNagadBaseUrl(isLive);

    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      "103.100.100.1";

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

    const verifyData = await verifyRes.json();

    return new Response(
      JSON.stringify({ success: verifyRes.ok, data: verifyData }),
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
