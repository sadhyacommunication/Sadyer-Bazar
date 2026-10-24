/**
 * GET /api/payment/bkash/callback
 * Zero-Client-Trust bKash PGW Redirect Callback Handler.
 *
 * Security Invariants:
 *  - NEVER reads `orderCode` or `amount` from query parameters.
 *  - Resolves the order and expected amount strictly from `payment_attempts` via `paymentID`.
 *  - Uses `claim_payment_attempt` (`FOR UPDATE` row lock) so concurrent/replayed callbacks
 *    cannot execute or settle the same payment twice.
 *  - Calls `settleBkashPayment` (Execute Payment + Query Payment fallback).
 *  - Calls `finalize_payment_attempt`, which verifies `trxID` uniqueness, exact `amount`,
 *    `currency === 'BDT'`, and `merchantInvoiceNumber === gatewayOrderRef` before crediting the order.
 */
import { loadConfig } from "../../../_lib/env";
import { redirectTo } from "../../../_lib/http";
import { rpc } from "../../../_lib/supabase";
import type { PagesContext } from "../../../_lib/types";
import { requireBkashCredentials, settleBkashPayment } from "../_lib/bkashClient";

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

export const onRequestGet = async (ctx: PagesContext): Promise<Response> => {
  const cfg = loadConfig(ctx.env, ctx.request.url);
  requireBkashCredentials(cfg, ctx.env);

  const url = new URL(ctx.request.url);
  const paymentID = (url.searchParams.get("paymentID") ?? "").trim();
  const status = (url.searchParams.get("status") ?? "").trim().toLowerCase();

  if (!paymentID || paymentID.length > 128 || !/^[A-Za-z0-9._-]+$/.test(paymentID)) {
    return redirectTo(cfg.siteUrl, "/track-order", { payment: "failed", gateway: "bkash" });
  }

  const claim = await rpc<ClaimResult>(cfg, "claim_payment_attempt", {
    p_gateway: "bkash",
    p_gateway_payment_id: paymentID,
  });

  if (claim.state === "not_found") {
    return redirectTo(cfg.siteUrl, "/track-order", { payment: "failed", gateway: "bkash" });
  }
  if (claim.state === "already_succeeded") {
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: claim.orderCode,
      payment: "success",
      gateway: "bkash",
    });
  }
  if (claim.state === "in_progress") {
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: claim.orderCode,
      payment: "processing",
      gateway: "bkash",
    });
  }
  if (claim.state === "terminal") {
    const pStatus = claim.status === "cancelled" ? "cancelled" : claim.status === "needs_review" ? "review" : "failed";
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: claim.orderCode,
      payment: pStatus,
      gateway: "bkash",
    });
  }

  const attempt = claim.attempt!;

  // Customer cancelled or gateway reported failure before execution
  if (status === "cancel" || status === "failure") {
    const failStatus = status === "cancel" ? "cancelled" : "failed";
    await rpc(cfg, "fail_payment_attempt", {
      p_attempt_id: attempt.id,
      p_status: failStatus,
      p_reason: `bKash callback status=${status}`,
      p_payload: { callbackStatus: status },
    });
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: attempt.orderCode,
      payment: failStatus,
      gateway: "bkash",
    });
  }

  // Execute Payment (with automatic Query Payment fallback on network timeout / 2062)
  const settled = await settleBkashPayment(cfg, ctx.env, paymentID);

  if (settled.pending) {
    await rpc(cfg, "release_payment_attempt", { p_attempt_id: attempt.id });
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: attempt.orderCode,
      payment: "processing",
      gateway: "bkash",
    });
  }

  if (!settled.ok || !settled.trxID) {
    await rpc(cfg, "fail_payment_attempt", {
      p_attempt_id: attempt.id,
      p_status: "failed",
      p_reason: `[${settled.statusCode}] ${settled.statusMessage}`,
      p_payload: settled.raw,
    });
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: attempt.orderCode,
      payment: "failed",
      gateway: "bkash",
    });
  }

  const finalized = await rpc<FinalizeResult>(cfg, "finalize_payment_attempt", {
    p_attempt_id: attempt.id,
    p_trx_id: settled.trxID,
    p_amount: settled.amount ?? 0,
    p_currency: settled.currency || "BDT",
    p_merchant_ref: settled.merchantInvoiceNumber || "",
    p_payload: settled.raw,
    p_sender_phone: settled.customerMsisdn || null,
  });

  if (!finalized.ok) {
    return redirectTo(cfg.siteUrl, "/track-order", {
      code: attempt.orderCode,
      payment: "review",
      gateway: "bkash",
    });
  }

  return redirectTo(cfg.siteUrl, "/track-order", {
    code: attempt.orderCode,
    payment: "success",
    gateway: "bkash",
  });
};
