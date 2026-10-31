export type DeliveryZone = "inside_dhaka" | "outside_dhaka";

export type PaymentMethod = "bkash" | "nagad" | "sslcommerz" | "cod";

export type ActiveCheckoutPaymentMethod = "bkash" | "nagad" | "cod";

export type PaymentPlan = "full" | "advance" | "cod";

export type PaymentStatus =
  | "pending"
  | "advance_paid"
  | "paid"
  | "failed"
  | "refunded";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface SiteSettings {
  id: number;
  insideDhakaFee: number;
  outsideDhakaFee: number;
  freeDeliveryThreshold: number;
  enableFreeDelivery: boolean;
  preorderAdvancePercent: number;
  supportPhone: string;
  whatsappNumber: string;
  bkashMerchantNumber: string;
  bkashAccountType: "merchant" | "personal" | "agent";
  nagadNumber: string;
  nagadAccountType: "merchant" | "personal";
  nagadEnabled: boolean;
  announcementEn: string;
  announcementBn: string;
  sslcommerzEnabled: boolean;
  sslcommerzStoreId?: string;
  sslcommerzIsLive?: boolean;
  bkashEnabled: boolean;
  bkashAppKey?: string;
  codEnabled: boolean;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  nameBn: string;
  slug: string;
  description: string;
  imageUrl: string;
  badgeText?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  label: string; // e.g., "500g Jar", "1kg Jar", "12 Pcs (1 Dozen)"
  weightGrams: number;
  price: number;
  compareAtPrice?: number;
  stockQty: number;
  isDefault: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  title: string;
  titleBn: string;
  slug: string;
  shortDescription: string;
  description: string;
  originSource: string;
  primaryImage: string;
  galleryImages: string[];
  isPreorder: boolean;
  preorderCutoffAt?: string;
  expectedDeliveryDate?: string;
  batchTargetQty: number;
  batchBookedQty: number;
  unitType: "kg" | "jar" | "dozen" | "pot" | "pack";
  cuttingOptions: string[]; // e.g., ["Whole Uncut", "Standard Curry Cut", "Small Family Cut"]
  nutritionHighlights: string[];
  seoTitle: string;
  seoDescription: string;
  searchKeywords: string[];
  isFeatured: boolean;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  variants: ProductVariant[];
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string; // e.g. "SADHYER100", "JAMUNA10"
  title: string;
  discountType: "flat" | "percentage";
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  usageCount: number;
}

export interface ProductReview {
  id: string;
  productId: string;
  orderCode: string;
  customerName: string;
  customerDistrict: string;
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface CartItem {
  cartItemId: string; // composite of productId + variantId + cuttingPreference
  productId: string;
  variantId: string;
  slug: string;
  title: string;
  titleBn: string;
  image: string;
  variantLabel: string;
  cuttingPreference?: string;
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  isPreorder: boolean;
  expectedDeliveryDate?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  productTitle: string;
  productTitleBn: string;
  productImage: string;
  variantLabel: string;
  cuttingPreference?: string;
  isPreorder: boolean;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderCode: string; // e.g. "SB-2610-9X4K2"
  customerName: string;
  customerPhone: string;
  deliveryZone: DeliveryZone;
  customerDistrict: string;
  customerAddress: string;
  customerNote?: string;
  subtotal: number;
  deliveryCharge: number;
  discountAmount: number;
  couponCode?: string;
  weightAdjustmentAmount?: number; // + or - BDT adjustment after weighing fish/meat on scale
  weightAdjustmentNote?: string;
  totalAmount: number;
  advancePaid: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  paymentPlan: PaymentPlan;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  hasPreorderItems: boolean;
  transactionId?: string;
  courierName?: string;
  trackingReference?: string;
  riderName?: string;
  riderPhone?: string;
  // Security & Anti-Fraud Engine
  fraudRiskScore?: number;
  isSuspicious?: boolean;
  reviewReasons?: string[];
  isPhoneVerified?: boolean;
  verificationMethod?: "manual_call" | "sms_otp" | "payment_gateway" | "unverified";
  idempotencyKey?: string;
  isPendingDbSync?: boolean;
  isResilientCod?: boolean;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProcessedWebhookEvent {
  id: string;
  gateway: "bkash" | "nagad" | "sslcommerz";
  transactionId: string;
  orderCode: string;
  amount: number;
  currency: "BDT";
  payload?: Record<string, unknown>;
  processedAt: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  orderCode: string;
  gateway: "bkash" | "nagad" | "sslcommerz" | "manual_verify";
  transactionId: string;
  validationId?: string;
  amount: number;
  currency: "BDT";
  status: "initiated" | "validated" | "failed";
  senderPhone?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface ProcurementSummaryItem {
  productId: string;
  productTitle: string;
  productTitleBn: string;
  productImage: string;
  variantLabel: string;
  cuttingPreference?: string;
  isPreorder: boolean;
  totalQuantity: number;
  orderCount: number;
}

export type ContactMessageStatus = "unread" | "read" | "replied" | "archived";

export interface ContactMessage {
  id: string;
  name: string;
  phone: string;
  email?: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  adminReply?: string;
  repliedAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Hero banner CMS (see supabase/migrations/*_06_hero_cms.sql, src/lib/hero/*)
// ---------------------------------------------------------------------------
import type { HeroIconKey, HeroImagePosition } from "@/lib/hero/schema";
export type { HeroIconKey, HeroImagePosition };

export interface HeroSlide {
  id: string;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string;
  imageAlt: string;
  imagePosition: HeroImagePosition;
  badgeText: string;
  badgeIcon: HeroIconKey;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt?: string;
}

export interface HeroTrustItem {
  icon: HeroIconKey;
  title: string;
  /** May contain {insideDhakaFee} / {outsideDhakaFee}; filled from live delivery settings. */
  subtitle: string;
}

export interface HeroSettings {
  showHeadline: boolean;
  headline: string;
  subheadline: string;
  showGuarantee: boolean;
  guaranteeText: string;
  showCounter: boolean;
  autoplay: boolean;
  autoplaySeconds: number;
  showTrustItems: boolean;
  trustItems: HeroTrustItem[];
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Pre-order batch & schedule CMS (see supabase/migrations/*_07_preorder_settings.sql)
// ---------------------------------------------------------------------------
import type {
  PreorderBatchStatus,
  PreorderSettingsInput,
} from "@/lib/preorder/schema";
export type { PreorderBatchStatus, PreorderSettingsInput };

export interface PreorderSettings {
  id: number;
  isBatchActive: boolean;
  batchStatus: PreorderBatchStatus;
  badgeText: string;
  headline: string;
  subheadline: string;
  cutoffTime: string;
  expectedDeliveryDate: string;
  dispatchLocation: string;
  closedMessage: string;
  showCountdown: boolean;
  requireAdvancePayment: boolean;
  advancePercent: number;
  bannerAlert: string;
  showBannerAlert: boolean;
  maxBatchCapacity: number;
  updatedAt?: string;
}

