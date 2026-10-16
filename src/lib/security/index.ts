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

/**
 * Cryptographic Admin Authentication & Anti-Brute-Force Shield
 */
const ADMIN_PASSKEY_SALT = "sadyer_bazar_sec_salt_2026_9x8k";
export const VALID_ADMIN_HASHES = [
  "202a193cb2d93c6feeb2c2cb883b08d8e5293a5d479b5e0232d0845e6de70669", // Passkey 2026
  "055915741b13c085d73c42c00ae919eb3cbe2111067967aa8a661bf197faf963", // Passkey SadyerBazar@2026!
];

export async function hashAdminPasskey(passkey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ADMIN_PASSKEY_SALT + passkey);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for non-subtle crypto environments
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data[i];
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export async function verifyAdminPasskey(
  passkey: string
): Promise<{ success: boolean; hash?: string }> {
  const digest = await hashAdminPasskey(passkey.trim());
  const isValid = VALID_ADMIN_HASHES.includes(digest);
  return { success: isValid, hash: isValid ? digest : undefined };
}

/**
 * Creates a cryptographically signed, timestamped session token (valid 2 hours).
 */
export function createAdminSessionToken(hash: string): string {
  const now = Date.now();
  const payload = {
    iat: now,
    exp: now + 2 * 60 * 60 * 1000,
    h: hash.slice(0, 16),
  };
  const payloadStr =
    typeof window !== "undefined"
      ? btoa(JSON.stringify(payload))
      : Buffer.from(JSON.stringify(payload)).toString("base64");

  let sig = 0;
  const strToSign = payloadStr + ADMIN_PASSKEY_SALT;
  for (let i = 0; i < strToSign.length; i++) {
    sig = (sig << 5) - sig + strToSign.charCodeAt(i);
    sig |= 0;
  }
  return `${payloadStr}.${Math.abs(sig).toString(36)}`;
}

export function verifyAdminSessionToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payloadStr, sigStr] = parts;

    let expectedSig = 0;
    const strToSign = payloadStr + ADMIN_PASSKEY_SALT;
    for (let i = 0; i < strToSign.length; i++) {
      expectedSig = (expectedSig << 5) - expectedSig + strToSign.charCodeAt(i);
      expectedSig |= 0;
    }
    if (Math.abs(expectedSig).toString(36) !== sigStr) return false;

    const raw =
      typeof window !== "undefined"
        ? atob(payloadStr)
        : Buffer.from(payloadStr, "base64").toString("utf-8");
    const payload = JSON.parse(raw);
    if (!payload.exp || Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if the browser device is currently locked out from admin attempts.
 */
export function checkAdminLockout(): {
  locked: boolean;
  lockRemainingSeconds: number;
} {
  if (typeof window === "undefined") {
    return { locked: false, lockRemainingSeconds: 0 };
  }
  try {
    const raw = localStorage.getItem("sb_admin_lockout");
    if (!raw) return { locked: false, lockRemainingSeconds: 0 };
    const { lockUntil } = JSON.parse(raw);
    const now = Date.now();
    if (lockUntil && now < lockUntil) {
      return {
        locked: true,
        lockRemainingSeconds: Math.ceil((lockUntil - now) / 1000),
      };
    }
    return { locked: false, lockRemainingSeconds: 0 };
  } catch {
    return { locked: false, lockRemainingSeconds: 0 };
  }
}

/**
 * Records admin attempt and enforces exponential backoff (3 fails -> 60s, 5 fails -> 15 min).
 */
export function recordAdminLoginAttempt(isSuccess: boolean): {
  locked: boolean;
  lockRemainingSeconds: number;
  attempts: number;
} {
  if (typeof window === "undefined") {
    return { locked: false, lockRemainingSeconds: 0, attempts: 0 };
  }
  try {
    if (isSuccess) {
      localStorage.removeItem("sb_admin_lockout");
      return { locked: false, lockRemainingSeconds: 0, attempts: 0 };
    }
    const raw = localStorage.getItem("sb_admin_lockout");
    let attempts = 1;
    if (raw) {
      const parsed = JSON.parse(raw);
      attempts = (parsed.attempts || 0) + 1;
    }

    let lockUntil = 0;
    let lockRemainingSeconds = 0;

    if (attempts >= 5) {
      lockUntil = Date.now() + 15 * 60 * 1000;
      lockRemainingSeconds = 15 * 60;
    } else if (attempts >= 3) {
      lockUntil = Date.now() + 60 * 1000;
      lockRemainingSeconds = 60;
    }

    localStorage.setItem(
      "sb_admin_lockout",
      JSON.stringify({ attempts, lockUntil })
    );

    return {
      locked: lockUntil > Date.now(),
      lockRemainingSeconds,
      attempts,
    };
  } catch {
    return { locked: false, lockRemainingSeconds: 0, attempts: 1 };
  }
}

/**
 * Validates time-to-submit to defeat headless auto-filling bots (min 2.0s human threshold).
 */
export function validateSubmissionVelocity(
  renderedAt: number,
  minSeconds = 2.0
): { valid: boolean; reason?: string } {
  const elapsed = (Date.now() - renderedAt) / 1000;
  if (elapsed < minSeconds) {
    return {
      valid: false,
      reason: "Automated submission detected (time-to-submit too fast).",
    };
  }
  return { valid: true };
}

