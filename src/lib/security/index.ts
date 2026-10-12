import { Coupon, Product, SiteSettings } from "@/types";
import { CreateOrderInput } from "@/lib/validations/schemas";

/**
 * Generates a cryptographically non-guessable, human-readable Order ID.
 * Format: SB-YYMM-XXXXX (e.g., SB-2610-9K4M2)
 * Excludes ambiguous characters like 0/O and 1/I.
 */
export function generateSecureOrderCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const randomBytes = new Uint8Array(5);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 5; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = "";
  for (let i = 0; i < 5; i++) {
    code += alphabet[randomBytes[i] % alphabet.length];
  }

  return `SB-${yy}${mm}-${code}`;
}

/**
 * Sanitizes user input strings to prevent stored XSS or HTML injection.
 */
export function sanitizeText(input: string | undefined): string {
  if (!input) return "";
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}

/**
 * Normalizes Bangladeshi mobile numbers to standard 11-digit format (01XXXXXXXXX).
 */
export function normalizeBdPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Masks phone number for public order tracking (e.g. 01713-****80) to prevent PII harvesting.
 */
export function maskPhoneNumber(phone: string): string {
  const clean = normalizeBdPhone(phone);
  if (clean.length < 11) return "01***-****" + clean.slice(-2);
  return `${clean.slice(0, 5)}-****${clean.slice(-2)}`;
}

/**
 * Masks street address for public tracking unless verified.
 */
export function maskAddress(address: string, district: string): string {
  const words = address.split(" ");
  if (words.length <= 2) {
    return `***, ${district}`;
  }
  return `${words[0]} ***, ${district}`;
}

/**
 * In-Memory / Edge Rate Limiter to block automated fake order floods & brute force tracking.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * ZERO-CLIENT-TRUST COUPON CALCULATOR:
 * Validates coupon eligibility and computes exact discount amount on server.
 */
export function calculateCouponDiscount(
  subtotal: number,
  rawCode: string | undefined,
  coupons: Coupon[]
): { discountAmount: number; appliedCoupon?: Coupon } {
  if (!rawCode || !rawCode.trim()) {
    return { discountAmount: 0 };
  }
  const normalized = rawCode.trim().toUpperCase();
  const coupon = coupons.find(
    (c) => c.isActive && c.code.toUpperCase() === normalized
  );
  if (!coupon || subtotal < coupon.minOrderAmount) {
    return { discountAmount: 0 };
  }

  let discountAmount = 0;
  if (coupon.discountType === "flat") {
    discountAmount = coupon.discountValue;
  } else {
    discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount;
    }
  }

  return {
    discountAmount: Math.min(subtotal, discountAmount),
    appliedCoupon: coupon,
  };
}

/**
 * ZERO-CLIENT-TRUST PRICING ENGINE:
 * Computes exact subtotal, coupon discount, delivery fee, advance required, and due amount strictly
 * using server-side catalog, coupons & admin settings. Ignores any client-side price manipulation.
 */
export function calculateVerifiedOrderPricing(
  input: CreateOrderInput,
  catalog: Product[],
  settings: SiteSettings,
  coupons: Coupon[] = []
) {
  let subtotal = 0;
  let hasPreorderItems = false;

  const verifiedItems = input.items.map((reqItem) => {
    const product = catalog.find(
      (p) => p.id === reqItem.productId && p.isActive
    );
    if (!product) {
      throw new Error(`Product not found or inactive: ${reqItem.productId}`);
    }

    const variant = product.variants.find((v) => v.id === reqItem.variantId);
    if (!variant) {
      throw new Error(`Product variant not found for ${product.title}`);
    }

    const unitPrice = Number(variant.price);
    const lineTotal = unitPrice * reqItem.quantity;
    subtotal += lineTotal;

    if (product.isPreorder) {
      hasPreorderItems = true;
    }

    return {
      productId: product.id,
      variantId: variant.id,
      productTitle: product.title,
      productTitleBn: product.titleBn,
      productImage: product.primaryImage,
      variantLabel: variant.label,
      cuttingPreference: sanitizeText(reqItem.cuttingPreference),
      isPreorder: product.isPreorder,
      quantity: reqItem.quantity,
      unitPrice,
      lineTotal,
    };
  });

  // Server-Side Coupon Validation
  const { discountAmount, appliedCoupon } = calculateCouponDiscount(
    subtotal,
    input.couponCode,
    coupons
  );

  // Delivery charge calculation from dynamic Admin Settings
  const baseDeliveryFee =
    input.deliveryZone === "inside_dhaka"
      ? Number(settings.insideDhakaFee)
      : Number(settings.outsideDhakaFee);

  const qualifiesForFreeDelivery =
    settings.enableFreeDelivery &&
    subtotal >= Number(settings.freeDeliveryThreshold);

  const deliveryCharge = qualifiesForFreeDelivery ? 0 : baseDeliveryFee;
  const totalAmount = Math.max(0, subtotal - discountAmount + deliveryCharge);

  // Calculate payable now (Advance vs Full vs COD)
  let payableNow = 0;
  if (input.paymentMethod === "cod" || input.paymentPlan === "cod") {
    payableNow = 0;
  } else if (input.paymentPlan === "full") {
    payableNow = totalAmount;
  } else if (input.paymentPlan === "advance") {
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const percentAdvance = Math.round(
      (discountedSubtotal * Number(settings.preorderAdvancePercent)) / 100
    );
    payableNow = Math.max(deliveryCharge, percentAdvance);
  }

  return {
    verifiedItems,
    subtotal,
    deliveryCharge,
    discountAmount,
    couponCode: appliedCoupon?.code,
    totalAmount,
    payableNow,
    hasPreorderItems,
  };
}
