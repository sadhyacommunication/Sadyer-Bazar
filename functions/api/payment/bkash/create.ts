/**
 * POST /api/payment/bkash/create
 * Zero-Client-Trust bKash Tokenized Checkout Session Creator.
 *
 * Flow:
 *  1. Validates `orderCode` (no amount or paymentType is accepted from the browser).
 *  2. Enforces `requirePaymentMode(cfg)` ("live" in production, "sandbox" in non-prod) and
 *     verifies bKash credentials are configured.
 *  3. Calls `begin_payment_attempt(orderCode, 'bkash', ipHash)` in Postgres, which locks the
 *     order row, computes the exact payable amount (`payable_now` or `due_amount`), and issues
 *     a unique `gatewayOrderRef` (`SBP...`).
 *  4. Calls bKash `tokenized/checkout/create` with `merchantInvoiceNumber = gatewayOrderRef`.
 *  5. Calls `attach_gateway_payment(attemptId, paymentID)` and returns `{ bkashURL, paymentID, amount }`.
 */
import { z } from "zod";
import { loadConfig } from "../../../_lib/env";
import { HttpError, json, readJsonBody } from "../../../_lib/http";
import { rpc } from "../../../_lib/supabase";
import type { PagesContext } from "../../../_lib/types";
import { createBkashPayment, requireBkashCredentials } from "../_lib/bkashClient";

const bodySchema = z.object({
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^SB-\d{4}-[A-Z0-9]{5,10}$/, "Invalid Order ID format"),
});

interface BeginAttemptResult {
  attemptId: string;
  orderCode: string;
  purpose: "initial" | "due";
  amount: number;
  gatewayOrderRef: string;
  customerPhone: string;
}

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  const cfg = loadConfig(ctx.env, ctx.request.url);
  const creds = requireBkashCredentials(cfg, ctx.env);

  const raw = await readJsonBody(ctx.request);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid Order ID");
  }

  const attempt = await rpc<BeginAttemptResult>(cfg, "begin_payment_attempt", {
    p_order_code: parsed.data.orderCode,
    p_gateway: "bkash",
    p_client_ip_hash: ctx.data.ipHash ?? null,
  });

  const amount = Number(attempt.amount);
  const callbackUrl = `${cfg.siteUrl}/api/payment/bkash/callback`;

  let bkashRes: { paymentID: string; bkashURL: string };
  try {
    bkashRes = await createBkashPayment(cfg, ctx.env, {
      merchantInvoiceNumber: attempt.gatewayOrderRef,
      amount,
      customerPhone: attempt.customerPhone,
      callbackUrl,
    });
  } catch (err) {
    await rpc(cfg, "fail_payment_attempt", {
      p_attempt_id: attempt.attemptId,
      p_status: "failed",
      p_reason: err instanceof Error ? err.message : "bkash_create_failed",
      p_payload: {},
    }).catch(() => {});
    throw err;
  }

  await rpc(cfg, "attach_gateway_payment", {
    p_attempt_id: attempt.attemptId,
    p_gateway_payment_id: bkashRes.paymentID,
    p_meta: { mode: creds.mode, purpose: attempt.purpose },
  });

  return json({
    success: true,
    ok: true,
    gateway: "bkash",
    orderCode: attempt.orderCode,
    purpose: attempt.purpose,
    amount,
    paymentID: bkashRes.paymentID,
    bkashURL: bkashRes.bkashURL,
  });
};
