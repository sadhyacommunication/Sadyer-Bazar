/**
 * POST /api/admin/action
 * Audited, server-enforced Admin Order & Payment Management Endpoint.
 *
 * Requires:
 *  - Valid Supabase Auth access token (`Authorization: Bearer <jwt>`)
 *  - User ID present in `public.admins`
 *
 * Dispatches to `service_role`-only SQL RPCs in `20261023120004_04_admin_ops.sql`,
 * recording `p_actor = admin.userId` in `admin_audit_log`.
 */
import { z } from "zod";
import { requireAdmin } from "../../_lib/adminAuth";
import { loadConfig } from "../../_lib/env";
import { HttpError, json, readJsonBody } from "../../_lib/http";
import { rpc } from "../../_lib/supabase";
import type { PagesContext } from "../../_lib/types";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_order_status"),
    orderId: z.string().trim().min(1).max(80),
    newStatus: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
  }),
  z.object({
    action: z.literal("mark_order_paid"),
    orderId: z.string().trim().min(1).max(80),
    amount: z.number().positive().max(1_000_000),
    reference: z.string().trim().min(4).max(64),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("verify_cod_phone"),
    orderId: z.string().trim().min(1).max(80),
    method: z.enum(["manual_call", "sms_otp"]).default("manual_call"),
  }),
  z.object({
    action: z.literal("adjust_order_weight"),
    orderId: z.string().trim().min(1).max(80),
    adjustment: z.number().min(-5000).max(5000),
    note: z.string().trim().min(2).max(300),
  }),
  z.object({
    action: z.literal("assign_logistics"),
    orderId: z.string().trim().min(1).max(80),
    courierName: z.string().trim().min(2).max(80),
    trackingReference: z.string().trim().max(80).optional().default(""),
    riderName: z.string().trim().max(80).optional().default(""),
    riderPhone: z.string().trim().max(25).optional().default(""),
  }),
  z.object({
    action: z.literal("resolve_attempt"),
    attemptId: z.string().uuid(),
    resolution: z.enum(["refunded", "dismissed"]),
    note: z.string().trim().max(200).optional().default(""),
  }),
]);

export const onRequestPost = async (ctx: PagesContext): Promise<Response> => {
  const cfg = loadConfig(ctx.env, ctx.request.url);
  const admin = await requireAdmin(ctx.request, cfg);

  const raw = await readJsonBody(ctx.request);
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(422, "validation_failed", parsed.error.issues[0]?.message ?? "Invalid admin action payload");
  }

  const d = parsed.data;
  switch (d.action) {
    case "set_order_status": {
      const result = await rpc(cfg, "admin_set_order_status", {
        p_order_id: d.orderId,
        p_new_status: d.newStatus,
        p_actor: admin.userId,
      });
      return json({ success: true, result });
    }
    case "mark_order_paid": {
      const result = await rpc(cfg, "admin_mark_order_paid", {
        p_order_id: d.orderId,
        p_amount: d.amount,
        p_reference: d.reference,
        p_note: d.note || null,
        p_actor: admin.userId,
      });
      return json({ success: true, result });
    }
    case "verify_cod_phone": {
      const result = await rpc(cfg, "admin_verify_cod_phone", {
        p_order_id: d.orderId,
        p_method: d.method,
        p_actor: admin.userId,
      });
      return json({ success: true, result });
    }
    case "adjust_order_weight": {
      const result = await rpc(cfg, "admin_adjust_order_weight", {
        p_order_id: d.orderId,
        p_adjustment: d.adjustment,
        p_note: d.note,
        p_actor: admin.userId,
      });
      return json({ success: true, result });
    }
    case "assign_logistics": {
      const result = await rpc(cfg, "admin_assign_logistics", {
        p_order_id: d.orderId,
        p_courier: d.courierName,
        p_tracking_ref: d.trackingReference,
        p_rider_name: d.riderName,
        p_rider_phone: d.riderPhone,
        p_actor: admin.userId,
      });
      return json({ success: true, result });
    }
    case "resolve_attempt": {
      await rpc(cfg, "admin_resolve_attempt", {
        p_attempt_id: d.attemptId,
        p_resolution: d.resolution,
        p_note: d.note,
        p_actor: admin.userId,
      });
      return json({ success: true });
    }
  }
};
