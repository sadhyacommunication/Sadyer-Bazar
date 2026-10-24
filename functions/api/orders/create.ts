/**
 * POST /api/orders/create
 * Zero-Client-Trust order creation (`create_order_server`).
 *
 * - Never reads prices, delivery fees, or discount amounts from the client.
 * - Verifies Cloudflare Turnstile before touching the database.
 * - Atomically reserves stock/batch capacity, validates coupons, enforces velocity limits,
 *   computes anti-fraud risk score, and generates a 10-character non-guessable Order ID.
 */
import { z } from "zod";
import { loadConfig } from "../../_lib/env";
import { getClientIp, HttpError, json, readJsonBody } from "../../_lib/http";
import { rpc } from "../../_lib/supabase";
import { verifyTurnstile } from "../../_lib/turnstile";
import type { PagesContext } from "../../_lib/types";

const createOrderBodySchema = z.object({
  customerName: z.string().trim().min(2, "Please enter your full name").max(80, "Name is too long"),
  customerPhone: z
    .string()
    .trim()
    .regex(/^(?:\+?88)?(01[3-9]\d{8})$/, "Please enter a valid 11-digit Bangladeshi mobile number"),
  deliveryZone: z.enum(["inside_dhaka", "outside_dhaka"]),
  customerDistrict: z.string().trim().min(2, "Please enter your district or area").max(80),
  customerAddress: z.string().trim().min(8, "Please provide your full delivery address").max(350),
  customerNote: z.string().trim().max(300).optional().nullable(),
  couponCode: z.string().trim().max(40).optional().nullable(),
  paymentMethod: z.enum(["bkash", "nagad", "cod"]),
  paymentPlan: z.enum(["full", "advance", "cod"]),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(80),
        variantId: z.string().trim().min(1).max(80),
        quantity: z.number().int().min(1).max(50),
        cuttingPreference: z.string().trim().max(100).optional(),
      })
    )
    .min(1, "Your basket is empty")
    .max(30, "Too many items in your basket"),
  idempotencyKey: z.string().trim().min(8).max(100).optional().nullable(),
  turnstileToken: z.string().trim().max(2048).optional().nullable(),
  websiteHoneypot: z.string().max(0, "Bot detected").optional(),
});

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  const cfg = loadConfig(ctx.env, ctx.request.url);
  const raw = await readJsonBody(ctx.request);
  const parsed = createOrderBodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Please check your order details");
  }

  const d = parsed.data;
  await verifyTurnstile(cfg, ctx.env, d.turnstileToken, getClientIp(ctx.request));

  const order = await rpc(cfg, "create_order_server", {
    p_customer_name: d.customerName,
    p_customer_phone: d.customerPhone,
    p_delivery_zone: d.deliveryZone,
    p_customer_district: d.customerDistrict,
    p_customer_address: d.customerAddress,
    p_customer_note: d.customerNote || null,
    p_coupon_code: d.couponCode || null,
    p_payment_method: d.paymentMethod,
    p_payment_plan: d.paymentMethod === "cod" ? "cod" : d.paymentPlan,
    p_items: d.items,
    p_idempotency_key: d.idempotencyKey || null,
    p_client_ip_hash: ctx.data.ipHash ?? null,
  });

  return json({ success: true, order }, 201);
};
