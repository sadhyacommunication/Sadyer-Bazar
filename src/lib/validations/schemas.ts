import { z } from "zod";

// Bangladeshi Mobile Number Regex: Supports 013-019 (11 digits) or +88013-019
const bdPhoneRegex = /^(?:\+?88)?(01[3-9]\d{8})$/;

export const checkoutItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  variantId: z.string().min(1, "Variant ID is required"),
  quantity: z
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(50, "Maximum 50 units per item"),
  cuttingPreference: z.string().max(100).optional(),
});

export const createOrderSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Please enter your full name (at least 2 characters)")
    .max(80, "Name is too long"),
  customerPhone: z
    .string()
    .trim()
    .regex(
      bdPhoneRegex,
      "Please enter a valid 11-digit Bangladeshi mobile number (e.g., 01713477780)"
    ),
  deliveryZone: z.enum(["inside_dhaka", "outside_dhaka"]),
  customerDistrict: z
    .string()
    .trim()
    .min(2, "Please select or enter your District / Area")
    .max(60),
  customerAddress: z
    .string()
    .trim()
    .min(8, "Please provide your full street/house delivery address")
    .max(350, "Address is too long"),
  customerNote: z.string().trim().max(300).optional(),
  couponCode: z.string().trim().max(30).optional(),
  paymentMethod: z.enum(["bkash", "nagad", "sslcommerz", "cod"]),
  paymentPlan: z.enum(["full", "advance", "cod"]),
  items: z.array(checkoutItemSchema).min(1, "Your cart is empty"),
  // Honeypot anti-bot field (must be empty)
  websiteHoneypot: z.string().max(0, "Bot detected").optional(),
});

export const trackOrderQuerySchema = z.object({
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^SB-\d{4}-[A-Z0-9]{5}$/,
      "Invalid Order ID format (Expected: SB-YYMM-XXXXX)"
    ),
  phoneLast4: z.string().trim().optional(),
});

export const updateSettingsSchema = z.object({
  insideDhakaFee: z.number().min(0).max(2000),
  outsideDhakaFee: z.number().min(0).max(5000),
  freeDeliveryThreshold: z.number().min(0).max(50000),
  enableFreeDelivery: z.boolean(),
  preorderAdvancePercent: z.number().int().min(0).max(100),
  supportPhone: z.string().trim().min(6).max(40),
  whatsappNumber: z.string().trim().min(6).max(30),
  bkashMerchantNumber: z.string().trim().min(6).max(30),
  bkashAccountType: z.enum(["merchant", "personal", "agent"]).default("merchant"),
  nagadNumber: z.string().trim().min(6).max(30).default("01713-477780"),
  nagadAccountType: z.enum(["merchant", "personal"]).default("personal"),
  nagadEnabled: z.boolean().default(true),
  announcementEn: z.string().trim().min(5).max(240),
  announcementBn: z.string().trim().min(2).max(240),
  sslcommerzEnabled: z.boolean(),
  sslcommerzStoreId: z.string().trim().max(100).optional(),
  sslcommerzStorePassword: z.string().trim().max(100).optional(),
  sslcommerzIsLive: z.boolean().optional(),
  bkashEnabled: z.boolean(),
  bkashAppKey: z.string().trim().max(100).optional(),
  bkashAppSecret: z.string().trim().max(100).optional(),
  codEnabled: z.boolean(),
});

export const createContactMessageSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^(\+8801|8801|01)[3-9]\d{8}$/, "Valid 11-digit Bangladeshi mobile number required"),
  email: z.string().trim().email("Invalid email address").optional().or(z.literal("")),
  subject: z.string().trim().min(2, "Subject is required").max(150),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(2000),
  websiteHoneypot: z.string().max(0, "Bot detected").optional().default(""),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;
