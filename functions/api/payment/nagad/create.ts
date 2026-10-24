/**
 * POST /api/payment/nagad/create
 * Zero-Client-Trust Nagad DFS Asymmetric RSA Checkout Session Creator.
 *
 * Flow:
 *  1. Validates `orderCode` (no amount or paymentType is accepted from the browser).
 *  2. Enforces `requirePaymentMode(cfg)` ("live" vs "sandbox") and loads RSA keys.
 *  3. Calls `begin_payment_attempt(orderCode, 'nagad', ipHash)` in Postgres, locking the order row
 *     and obtaining the authoritative `amount` and `gatewayOrderRef` (`SBP...`).
 *  4. Executes Nagad Step 1 (`check-out/initialize/${merchantId}/${gatewayOrderRef}`):
 *     - Encrypts challenge with Nagad Public Key & signs with Merchant Private Key.
 *     - Decrypts Nagad's `sensitiveData` with Merchant Private Key.
 *     - Verifies Nagad's RSA signature (`initData.signature`) with Nagad Public Key.
 *  5. Executes Nagad Step 2 (`check-out/complete/${paymentReferenceId}`):
 *     - Encrypts `{ merchantId, orderId: gatewayOrderRef, currencyCode: "050", amount, challenge }`
 *       and signs with Merchant Private Key.
 *  6. Calls `attach_gateway_payment(attemptId, paymentReferenceId)` and returns `{ callBackUrl, paymentReferenceId, amount }`.
 */
import { z } from "zod";
import { loadConfig } from "../../../_lib/env";
import { getClientIp, HttpError, json, readJsonBody } from "../../../_lib/http";
import { rpc } from "../../../_lib/supabase";
import type { PagesContext } from "../../../_lib/types";
import {
  decryptWithPrivateKey,
  encryptWithPublicKey,
  generateRandomString,
  getNagadBaseUrl,
  getNagadDateTime,
  requireNagadCredentials,
  signWithPrivateKey,
  verifyWithPublicKey,
} from "../_lib/nagadCrypto";

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
  const creds = requireNagadCredentials(cfg, ctx.env);

  const raw = await readJsonBody(ctx.request);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid Order ID");
  }

  const attempt = await rpc<BeginAttemptResult>(cfg, "begin_payment_attempt", {
    p_order_code: parsed.data.orderCode,
    p_gateway: "nagad",
    p_client_ip_hash: ctx.data.ipHash ?? null,
  });

  const amount = Number(attempt.amount);
  const baseUrl = getNagadBaseUrl(creds.mode);
  const rawIp = getClientIp(ctx.request);
  const clientIp = rawIp !== "unknown" ? rawIp : "103.100.100.1";

  const commonHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-KM-Api-Version": "v-0.2.0",
    "X-KM-IP-Add": clientIp,
    "X-KM-Client-Type": "PC_WEB",
  };

  try {
    // -------------------------------------------------------------------------
    // STEP 1: INITIALIZE CHECKOUT (RSA Challenge Exchange)
    // -------------------------------------------------------------------------
    const challenge = generateRandomString(20);
    const orderId = attempt.gatewayOrderRef;
    const dateTime = getNagadDateTime();

    const initSensitive = {
      merchantId: creds.merchantId,
      datetime: dateTime,
      orderId,
      challenge,
    };

    const initSensitiveStr = JSON.stringify(initSensitive);
    const encryptedSensitive = encryptWithPublicKey(initSensitiveStr, creds.publicKeyPem);
    const signature = signWithPrivateKey(initSensitiveStr, creds.privateKeyPem);

    const initUrl = `${baseUrl}/check-out/initialize/${encodeURIComponent(creds.merchantId)}/${encodeURIComponent(orderId)}`;
    const initRes = await fetch(initUrl, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        dateTime,
        sensitiveData: encryptedSensitive,
        signature,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const initData = (await initRes.json().catch(() => ({}))) as {
      sensitiveData?: string;
      signature?: string;
      reason?: string;
      message?: string;
    };

    if (!initRes.ok || !initData.sensitiveData) {
      throw new HttpError(
        502,
        "gateway_init_failed",
        initData.message || initData.reason || "Could not initialize Nagad payment session"
      );
    }

    const decryptedInit = decryptWithPrivateKey(initData.sensitiveData, creds.privateKeyPem);

    // Verify Nagad's RSA signature on the decrypted challenge response
    if (!initData.signature || !verifyWithPublicKey(decryptedInit, initData.signature, creds.publicKeyPem)) {
      console.error("[nagad] signature verification failed on initialize response");
      throw new HttpError(502, "gateway_signature_invalid", "Nagad gateway response signature could not be verified");
    }

    const parsedInit = JSON.parse(decryptedInit) as {
      paymentReferenceId?: string;
      challenge?: string;
    };

    if (!parsedInit.paymentReferenceId || !parsedInit.challenge) {
      throw new HttpError(502, "gateway_challenge_invalid", "Nagad challenge exchange returned an incomplete response");
    }

    const paymentReferenceId = parsedInit.paymentReferenceId.trim();

    // -------------------------------------------------------------------------
    // STEP 2: COMPLETE CHECKOUT & OBTAIN REDIRECT URL
    // -------------------------------------------------------------------------
    const callbackUrl = `${cfg.siteUrl}/api/payment/nagad/callback`;
    const completeSensitive = {
      merchantId: creds.merchantId,
      orderId,
      currencyCode: "050", // ISO 4217 numeric code for BDT
      amount: amount.toFixed(2),
      challenge: parsedInit.challenge,
    };

    const completeSensitiveStr = JSON.stringify(completeSensitive);
    const encryptedComplete = encryptWithPublicKey(completeSensitiveStr, creds.publicKeyPem);
    const completeSignature = signWithPrivateKey(completeSensitiveStr, creds.privateKeyPem);

    const completeUrl = `${baseUrl}/check-out/complete/${encodeURIComponent(paymentReferenceId)}`;
    const completeRes = await fetch(completeUrl, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        sensitiveData: encryptedComplete,
        signature: completeSignature,
        merchantCallbackURL: callbackUrl,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const completeData = (await completeRes.json().catch(() => ({}))) as {
      status?: string;
      callBackUrl?: string;
      message?: string;
      reason?: string;
    };

    if (!completeRes.ok || completeData.status !== "Success" || !completeData.callBackUrl) {
      throw new HttpError(
        502,
        "gateway_complete_failed",
        completeData.message || completeData.reason || "Could not generate Nagad checkout redirect URL"
      );
    }

    await rpc(cfg, "attach_gateway_payment", {
      p_attempt_id: attempt.attemptId,
      p_gateway_payment_id: paymentReferenceId,
      p_meta: { mode: creds.mode, purpose: attempt.purpose },
    });

    return json({
      success: true,
      ok: true,
      gateway: "nagad",
      orderCode: attempt.orderCode,
      purpose: attempt.purpose,
      amount,
      paymentReferenceId,
      callBackUrl: completeData.callBackUrl,
    });
  } catch (err) {
    await rpc(cfg, "fail_payment_attempt", {
      p_attempt_id: attempt.attemptId,
      p_status: "failed",
      p_reason: err instanceof Error ? err.message : "nagad_create_failed",
      p_payload: {},
    }).catch(() => {});
    if (err instanceof HttpError) throw err;
    console.error("[nagad] create error:", err instanceof Error ? err.message : err);
    throw new HttpError(502, "gateway_error", "Could not start Nagad payment session. Please try again.");
  }
};
