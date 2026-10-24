/**
 * POST /api/orders/quote
 * Zero-Client-Trust live price preview from Postgres (`quote_order_server`).
 */
import { z } from "zod";
import { loadConfig } from "../../_lib/env";
import { HttpError, json, readJsonBody } from "../../_lib/http";
import { rpc } from "../../_lib/supabase";
import type { PagesContext } from "../../_lib/types";

const quoteSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(80),
        variantId: z.string().trim().min(1).max(80),
        quantity: z.number().int().min(1).max(50),
        cuttingPreference: z.string().trim().max(100).optional(),
      })
    )
    .min(1)
    .max(30),
  deliveryZone: z.enum(["inside_dhaka", "outside_dhaka"]),
  couponCode: z.string().trim().max(40).optional().nullable(),
  paymentMethod: z.enum(["bkash", "nagad", "cod"]),
  paymentPlan: z.enum(["full", "advance", "cod"]),
});

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  const cfg = loadConfig(ctx.env, ctx.request.url);
  const raw = await readJsonBody(ctx.request);
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid quote request");
  }

  const d = parsed.data;
  const quote = await rpc(cfg, "quote_order_server", {
    p_items: d.items,
    p_delivery_zone: d.deliveryZone,
    p_coupon_code: d.couponCode || null,
    p_payment_method: d.paymentMethod,
    p_payment_plan: d.paymentPlan,
  });

  return json({ success: true, quote });
};
