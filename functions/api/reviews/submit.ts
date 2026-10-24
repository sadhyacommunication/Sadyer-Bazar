/**
 * POST /api/reviews/submit
 * Verified-purchase review endpoint (`submit_review_server`).
 * Requires a delivered order matching (orderCode, phoneLast4) that contains the reviewed product.
 */
import { z } from "zod";
import { loadConfig } from "../../_lib/env";
import { HttpError, json, readJsonBody } from "../../_lib/http";
import { rpc } from "../../_lib/supabase";
import type { PagesContext } from "../../_lib/types";

const reviewSchema = z.object({
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^SB-\d{4}-[A-Z0-9]{5,10}$/, "Invalid Order ID format"),
  phoneLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Please enter the last 4 digits of the mobile number used for this order"),
  productId: z.string().trim().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5, "Review must be at least 5 characters").max(1000, "Review is too long"),
});

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  const cfg = loadConfig(ctx.env, ctx.request.url);
  const raw = await readJsonBody(ctx.request);
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid review details");
  }

  const d = parsed.data;
  const result = await rpc(cfg, "submit_review_server", {
    p_order_code: d.orderCode,
    p_phone_last4: d.phoneLast4,
    p_product_id: d.productId,
    p_rating: d.rating,
    p_comment: d.comment,
  });

  return json({ success: true, result }, 201);
};
