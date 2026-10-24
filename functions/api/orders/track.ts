/**
 * POST /api/orders/track
 * Anti-enumeration order tracking (`track_order_server`).
 * Requires BOTH the non-guessable Order ID AND the last 4 digits of the recipient's phone.
 * Returns masked PII so an order receipt cannot be used to harvest full phone/address.
 */
import { z } from "zod";
import { loadConfig } from "../../_lib/env";
import { HttpError, json, readJsonBody } from "../../_lib/http";
import { rpc } from "../../_lib/supabase";
import type { PagesContext } from "../../_lib/types";

const trackSchema = z.object({
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^SB-\d{4}-[A-Z0-9]{5,10}$/, "Invalid Order ID format (Expected: SB-YYMM-XXXXXXXXXX)"),
  phoneLast4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Please enter the last 4 digits of your mobile number"),
});

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  const cfg = loadConfig(ctx.env, ctx.request.url);
  const raw = await readJsonBody(ctx.request);
  const parsed = trackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid tracking details");
  }

  const order = await rpc<Record<string, unknown> | null>(cfg, "track_order_server", {
    p_order_code: parsed.data.orderCode,
    p_phone_last4: parsed.data.phoneLast4,
  });

  if (!order) {
    throw new HttpError(
      404,
      "order_not_found",
      "No order found matching that Order ID and mobile number (last 4 digits)."
    );
  }

  return json({ success: true, order });
};
