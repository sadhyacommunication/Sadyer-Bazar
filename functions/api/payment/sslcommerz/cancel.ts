/**
 * Cloudflare Edge Worker / Pages Function: /api/payment/sslcommerz/cancel
 * Handles SSLCommerz payment cancellation callback.
 * Redirects user back to order tracking page with cancelled status notice.
 */

interface Env {
  NEXT_PUBLIC_SITE_URL?: string;
}

async function handleCancel(request: Request, env: Env): Promise<Response> {
  const siteUrl = (
    env.NEXT_PUBLIC_SITE_URL ||
    new URL(request.url).origin ||
    "https://sadhyerbazar.com"
  ).replace(/\/$/, "");

  let tranId = "";

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await request.json().catch(() => ({}));
      tranId = data.tran_id || data.orderCode || "";
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData();
      tranId = formData.get("tran_id")?.toString() || "";
    } else {
      const url = new URL(request.url);
      tranId = url.searchParams.get("tran_id") || "";
    }
  } catch (err) {
    console.error("Error parsing SSLCommerz cancel payload:", err);
  }

  const cleanTranId = tranId.trim().toUpperCase();
  const targetUrl = cleanTranId
    ? `${siteUrl}/track-order?code=${encodeURIComponent(cleanTranId)}&payment=cancelled&gateway=sslcommerz`
    : `${siteUrl}/track-order?payment=cancelled&gateway=sslcommerz`;

  return Response.redirect(targetUrl, 303);
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return handleCancel(context.request, context.env);
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  return handleCancel(context.request, context.env);
}
