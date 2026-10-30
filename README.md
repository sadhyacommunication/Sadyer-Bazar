# Sadhyer Bazar (সাধ্যের বাজার) — গ্রামের পণ্য শহরে, আপনার ঘরে (Village Freshness in the City, at Your Home)

An enterprise-grade, ultra-clean e-commerce and nationwide pre-order management platform built for **Sadhyer Bazar (সাধ্যের বাজার)** using **Next.js (App Router), TypeScript, Tailwind CSS, and Supabase**, architected for **Cloudflare Pages** deployment.

---

## Key Features Built

### 1. High-Conversion Storefront (Clean English UI + Authentic Bangla Posters)
* **Bangla Hero Showcase & Live Pre-Order Catch Board:** Real-time countdown timer and batch booking progress bar for **Jamuna River Fish** & **Bogura Shahi Doi**.
* **Instant Weight Switcher on Cards:** Customers can switch between `500g Jar`, `1kg Jar`, `12 Pcs`, etc. right on the product card with instant price updates.
* **Custom Fish & Meat Cutting Options:** Customers can choose preparation preferences (*Cleaned & Gutted*, *Bengali Curry Cut*, *Whole Uncut on Ice*).
* **Slide-Over Smart Basket:** Includes a **Free Home Delivery Progress Bar** and **1-Click Complementary Upsell**.

### 2. 1-Click Frictionless Checkout & Automated Payments
* **No-Login 1-Click Guest Checkout:** Customers order using only **Name, 11-Digit Mobile Number, Inside/Outside Dhaka Zone, and Full Address**.
* **Automated Payment Gateway Support:**
  * **bKash AutoPay (Tokenized Checkout)**
  * **SSLCommerz Gateway** (bKash, Nagad, Rocket, Visa/Mastercard)
  * **Cash on Home Delivery (COD)**
* **Flexible Payment Plans:** Supports **100% Full Online Payment**, **Pre-Order Advance Payment (e.g., 25%)**, or **Cash on Delivery**.
* **Real-Time Order Tracking (`/track-order`):** Customers track their order using their unique non-guessable Order ID (`SB-YYMM-XXXXX`) and can print their official invoice.

### 3. Enterprise Admin Dashboard (`/admin`)
* **Executive Overview & KPIs:** Total Order Value, Online Collected (bKash/SSLCommerz), Collectible COD Due, and Pre-Order Batch count.
* **Automated Batch Buying / Procurement List (বাজারের হিসাব):** Automatically aggregates active orders to show the exact total quantity of each product/variant/cut needed for the upcoming dispatch.
* **Product & Pre-Order Manager:** Add/edit products, update `500g`/`1kg` variant prices, and toggle Pre-Order batch mode.
* **Order Manager & Printable Delivery Labels:** Update order status (`Pending` $\rightarrow$ `Confirmed` $\rightarrow$ `Processing` $\rightarrow$ `Shipped` $\rightarrow$ `Delivered`) and print thermal delivery labels.
* **Dynamic Delivery Charge Control:** Update **Inside Dhaka** and **Outside Dhaka** delivery fees in real time from the Admin Settings tab.

### 4. Hacker-Proof Security Architecture
* **Zero-Client-Trust Pricing Engine:** Server recalculates all product prices, variants, and Inside/Outside Dhaka delivery charges strictly from server records.
* **Non-Guessable Cryptographic Order IDs (`SB-YYMM-XXXXX`):** Prevents IDOR enumeration attacks, with PII masking on public order tracking.
* **Supabase Row Level Security (RLS):** Full SQL schema and RLS policies in [`supabase/schema.sql`](./supabase/schema.sql).
* **Zod Validation, XSS Sanitization & Rate Limiting:** Protects checkout and tracking endpoints against spam bots and injection attacks.

---

## Getting Started Locally

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

Open `http://localhost:3000` for the Storefront, or `http://localhost:3000/admin` for the Merchant Admin Dashboard.

---

## Connecting Supabase & Deploying to Cloudflare Pages

1. Create a new project on [Supabase](https://supabase.com) and run the SQL script in [`supabase/schema.sql`](./supabase/schema.sql) inside the Supabase SQL Editor.
2. Copy [`.env.example`](./.env.example) to `.env.local` and fill in your `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SSLCOMMERZ` / `BKASH` credentials.
3. Push the repository to GitHub and connect it to **Cloudflare Pages** (set environment variables in the Cloudflare Pages dashboard).
