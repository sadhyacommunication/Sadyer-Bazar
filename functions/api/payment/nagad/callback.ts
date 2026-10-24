/**
 * GET /api/payment/nagad/callback
 * Zero-Client-Trust Nagad PGW Redirect Callback Handler.
 *
 * Security Invariants:
 *  - NEVER reads `orderCode` or `amount` from query parameters.
 *  - Resolves the order and expected amount strictly from `payment_attempts` via `payment_ref_id`.
 *  - Uses `claim_payment_attempt` (`FOR UPDATE` row lock) to prevent concurrent/duplicate execution.
 *  - Verifies the payment server-to-server via Nagad's `/verify/payment/${paymentRefId}` API.
 *  - Requires a genuine `issuerPaymentRefNo` (never falls back to `paymentRefId`), `status === 'Success'`,
 *    `statusCode === '000'`, exact `amount`, and `orderId === gatewayOrderRef`.
 */
import { loadConfig } from "../../../_lib/env";
import { getClientIp, redirectTo } from "../../../_lib/http";
import { rpc } from "../../../_lib/supabase";
import type { PagesContext } from "../../../_lib/types";
import { getNagadBaseUrl, requireNagadCredentials } from "../_lib/nagadCrypto";

interface ClaimResult {
  state: "claimed" | "already_succeeded" | "in_progress" | "terminal" | "not_found";
  status?: string;
  orderCode?: string;
  attempt?: {
    id: string;
    orderId: string;
    orderCode: string;
    gateway: string;
    purpose: string;
    expectedAmount: number;
    gatewayOrderRef: string;
    gatewayPaymentId: string;
  };
}

interface FinalizeResult {
  ok: boolean;
  idempotent?: boolean;
  reason?: string;
  orderCode?: string;
}

interface NagadVerifyResponse {
  merchantId?: string;
  orderId?: string;
  paymentRefId?: string;
  amount?: string;
  clientMobileNo?: string;
  merchantMobileNo?: string;
  orderDateTime?: string;
  issuerPaymentDateTime?: string;
  issuerPaymentRefNo?: string;
  additionalMerchantInfo?: string;
  status?: string;
  statusCode?: string;
  cancelIssuerDateTime?: string;
  cancelIssuerRefNo?: string;
  message?: string;
  [key: string]: unknown;
}

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  const cfg = loadConfig(ctx.env, ctx.request.url);
  const creds = requireNagadCredentials(cfg, ctx.env);

  const url = new URL(ctx.request.url);
  const paymentRefId = (
    url.searchParams.get("payment_ref_id") ??
    url.searchParams.get("paymentRef") ??
    ""
  ).trim();
  const statusParam = (url.searchParams.get("status") ?? "").trim().toLowerCase();

  if (!paymentRefId || paymentRefId.length > 128 || !/^[A-Za-z0-9._-]+$/.test(paymentRefId)) {
    return redirectTo(cfg.siteUrl, "/track-order", { payment: "failed", gateway: "nagad" });
  }

  const claim = await rpc<ClaimResult>(cfg, "claim_payment_attempt", {
    p_gateway: "nagad",
    p_gateway_payment_id: paymentRefId,
  });

  if (claim.state === "not_found") {
    return redirectTo(cfg.siteUrl, "/track-order", { payment: "failed", gateway: "nagad" });
  }
  if (claim.state === "already_succeeded") {
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: claim.orderCode,
      payment: "success",
      gateway: "nagad",
    });
  }
  if (claim.state === "in_progress") {
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: claim.orderCode,
      payment: "processing",
      gateway: "nagad",
    });
  }
  if (claim.state === "terminal") {
    const pStatus = claim.status === "cancelled" ? "cancelled" : claim.status === "needs_review" ? "review" : "failed";
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: claim.orderCode,
      payment: pStatus,
      gateway: "nagad",
    });
  }

  const attempt = claim.attempt!;

  if (statusParam === "aborted" || statusParam === "cancelled" || statusParam === "cancel") {
    await rpc(cfg, "fail_payment_attempt", {
      p_attempt_id: attempt.id,
      p_status: "cancelled",
      p_reason: `Nagad callback status=${statusParam}`,
      p_payload: { callbackStatus: statusParam },
    });
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: attempt.orderCode,
      payment: "cancelled",
      gateway: "nagad",
    });
  }

  const baseUrl = getNagadBaseUrl(creds.mode);
  const rawIp = getClientIp(ctx.request);
  const clientIp = rawIp !== "unknown" ? rawIp : "103.100.100.1";

  let verifyRes: Response;
  let verifyData: NagadVerifyResponse;
  try {
    verifyRes = await fetch(`${baseUrl}/verify/payment/${encodeURIComponent(paymentRefId)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-KM-Api-Version": "v-0.2.0",
        "X-KM-IP-Add": clientIp,
        "X-KM-Client-Type": "PC_WEB",
      },
      signal: AbortSignal.timeout(12_000),
    });
    verifyData = (await verifyRes.json().catch(() => ({}))) as NagadVerifyResponse;
  } catch (err) {
    console.error("[nagad] verify network error:", err instanceof Error ? err.message : err);
    await rpc(cfg, "release_payment_attempt", { p_attempt_id: attempt.id });
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: attempt.orderCode,
      payment: "processing",
      gateway: "nagad",
    });
  }

  const verifyStatus = (verifyData.status ?? "").trim();
  const verifyCode = (verifyData.statusCode ?? "").trim();

  if (!verifyRes.ok || verifyStatus !== "Success" || (verifyCode && verifyCode !== "000")) {
    const isCancelled = /cancel|abort/i.test(verifyStatus);
    const failStatus = isCancelled ? "cancelled" : "failed";
    await rpc(cfg, "fail_payment_attempt", {
      p_attempt_id: attempt.id,
      p_status: failStatus,
      p_reason: `[${verifyCode || "ERR"}] ${verifyData.message || verifyStatus || "Nagad verification failed"}`,
      p_payload: verifyData,
    });
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: attempt.orderCode,
      payment: failStatus,
      gateway: "nagad",
    });
  }

  // Strictly require issuerPaymentRefNo (never fall back to paymentRefId)
  const issuerTrxId = (verifyData.issuerPaymentRefNo ?? "").trim();
  const paidAmount = Number(verifyData.amount);
  const merchantOrderId = (verifyData.orderId ?? "").trim();

  const finalized = await rpc<FinalizeResult>(cfg, "finalize_payment_attempt", {
    p_attempt_id: attempt.id,
    p_trx_id: issuerTrxId,
    p_amount: Number.isFinite(paidAmount) ? paidAmount : 0,
    p_currency: "BDT",
    p_merchant_ref: merchantOrderId,
    p_payload: verifyData,
    p_sender_phone: verifyData.clientMobileNo ? String(verifyData.clientMobileNo) : null,
  });

  if (!finalized.ok) {
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: attempt.orderCode,
      payment: "review",
      gateway: "nagad",
    });
  }

  return redirectTo(cfg.siteUrl, "/track-order", {
    code: attempt.orderCode,
    payment: "success",
    gateway: "nagad",
  });
};
