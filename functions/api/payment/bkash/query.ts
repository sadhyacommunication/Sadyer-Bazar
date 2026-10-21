/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/bkash/query
 * Queries bKash Payment Status for dropped or unconfirmed sessions.
 */

import {
  BkashEnv,
  isBkashConfigured,
  queryBkashPayment,
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
    const { paymentID } = body as { paymentID?: string };

    if (!paymentID) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required paymentID" }),
        { status: 400, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    if (!isBkashConfigured(env)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "bKash Merchant credentials are not configured",
        }),
        { status: 503, headers: { ...CORS_HEADERS, "content-type": "application/json" } }
      );
    }

    const queryData = await queryBkashPayment(env, paymentID);

    return new Response(
      JSON.stringify({ success: true, data: queryData }),
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
