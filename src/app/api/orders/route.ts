import { NextRequest, NextResponse } from "next/server";
import {
  createOrderSchema,
  trackOrderQuerySchema,
} from "@/lib/validations/schemas";
import {
  calculateVerifiedOrderPricing,
  checkRateLimit,
  generateSecureOrderCode,
  maskAddress,
  maskPhoneNumber,
  normalizeBdPhone,
  sanitizeText,
} from "@/lib/security";
import {
  findServerOrderByCode,
  getServerCoupons,
  getServerProducts,
  getServerSettings,
  saveServerOrder,
} from "@/services/serverStore";
import { Order } from "@/types";

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "anon-client";

  const rate = checkRateLimit(`track:${ip}`, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many tracking requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawCode = searchParams.get("code") || "";
  const phoneLast4 = searchParams.get("phoneLast4") || "";

  const parsed = trackOrderQuerySchema.safeParse({
    orderCode: rawCode,
    phoneLast4: phoneLast4 || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ||
          "Invalid Order ID format (Example: SB-2610-8K4M2)",
      },
      { status: 400 }
    );
  }

  const order = await findServerOrderByCode(parsed.data.orderCode);
  if (!order) {
    return NextResponse.json(
      { error: "No order found with this Order ID. Please double-check your code." },
      { status: 404 }
    );
  }

  // Mask sensitive PII unless customer verifies last 4 digits of their phone number
  const isPhoneVerified =
    phoneLast4.length === 4 && order.customerPhone.endsWith(phoneLast4);

  const safeOrder: Order = {
    ...order,
    customerPhone: isPhoneVerified
      ? order.customerPhone
      : maskPhoneNumber(order.customerPhone),
    customerAddress: isPhoneVerified
      ? order.customerAddress
      : maskAddress(order.customerAddress, order.customerDistrict),
  };

  return NextResponse.json({
    order: safeOrder,
    isPhoneVerified,
  });
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "anon-client";

    const rate = checkRateLimit(`checkout:${ip}`, 8, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded to prevent automated spam orders. Please wait 1 minute.",
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || "Invalid checkout information",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Honeypot bot check
    if (input.websiteHoneypot && input.websiteHoneypot.length > 0) {
      return NextResponse.json(
        { error: "Bot submission blocked" },
        { status: 403 }
      );
    }

    const [catalog, settings, coupons] = await Promise.all([
      getServerProducts(),
      getServerSettings(),
      getServerCoupons(),
    ]);

    // Zero-Client-Trust Pricing & Coupon Calculation
    const pricing = calculateVerifiedOrderPricing(
      input,
      catalog,
      settings,
      coupons
    );
    const orderCode = generateSecureOrderCode();
    const orderId = `ord-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const newOrder: Order = {
      id: orderId,
      orderCode,
      customerName: sanitizeText(input.customerName),
      customerPhone: normalizeBdPhone(input.customerPhone),
      deliveryZone: input.deliveryZone,
      customerDistrict: sanitizeText(input.customerDistrict),
      customerAddress: sanitizeText(input.customerAddress),
      customerNote: sanitizeText(input.customerNote),
      subtotal: pricing.subtotal,
      deliveryCharge: pricing.deliveryCharge,
      discountAmount: pricing.discountAmount,
      couponCode: pricing.couponCode,
      weightAdjustmentAmount: 0,
      totalAmount: pricing.totalAmount,
      advancePaid: 0,
      dueAmount: pricing.totalAmount,
      paymentMethod: input.paymentMethod,
      paymentPlan: input.paymentMethod === "cod" ? "cod" : input.paymentPlan,
      paymentStatus: "pending",
      orderStatus: "pending",
      hasPreorderItems: pricing.hasPreorderItems,
      items: pricing.verifiedItems.map((item, idx) => ({
        id: `oi-${Date.now()}-${idx}`,
        orderId,
        ...item,
      })),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const savedOrder = await saveServerOrder(newOrder);

    return NextResponse.json(
      {
        success: true,
        order: savedOrder,
        payableNow: pricing.payableNow,
        gatewayRequired:
          input.paymentMethod !== "cod" &&
          input.paymentPlan !== "cod" &&
          pricing.payableNow > 0,
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
