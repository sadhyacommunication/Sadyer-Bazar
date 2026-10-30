import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  formatPemKey,
  getNagadDateTime,
  generateRandomString,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  signWithPrivateKey,
  verifyWithPublicKey,
  encryptAes128,
  decryptAes128,
} from "../functions/api/payment/_lib/nagadCrypto";
import { onRequestPost as createOrderPost } from "../functions/api/orders/create";
import { onRequestPost as trackOrderPost } from "../functions/api/orders/track";
import { onRequestPost as adminActionPost } from "../functions/api/admin/action";
import { ConfigError } from "../functions/_lib/env";
import { HttpError } from "../functions/_lib/http";

console.log("Running Edge API & Cryptographic Gateway Test Suite...");

// ---------------------------------------------------------------------------
// 1. Nagad RSA + AES Crypto & Signature Verification
// ---------------------------------------------------------------------------
{
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Strip headers and newlines to simulate single-line .env paste
  const rawPubBase64 = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  const rawPrivBase64 = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const formattedPub = formatPemKey(rawPubBase64, "PUBLIC");
  const formattedPriv = formatPemKey(rawPrivBase64, "PRIVATE");
  assert.ok(formattedPub.includes("-----BEGIN PUBLIC KEY-----\n"));
  assert.ok(formattedPriv.includes("-----BEGIN PRIVATE KEY-----\n"));

  const payload = {
    merchantId: "683002007104225",
    orderId: "SB2610ABCDEF1234",
    amount: "1450.00",
    challenge: generateRandomString(20),
  };

  const payloadStr = JSON.stringify(payload);
  const ciphertext = encryptWithPublicKey(payloadStr, rawPubBase64);
  const decrypted = JSON.parse(decryptWithPrivateKey(ciphertext, rawPrivBase64));
  assert.deepEqual(decrypted, payload, "RSA PKCS#1 v1.5 round-trip must match");

  const aesKey = generateRandomString(16);
  const aesIv = generateRandomString(16);
  const aesCipher = encryptAes128(payloadStr, aesKey, aesIv);
  assert.equal(decryptAes128(aesCipher, aesKey, aesIv), payloadStr, "AES-128-CBC round-trip must match");

  const signature = signWithPrivateKey(payloadStr, rawPrivBase64);
  assert.equal(
    verifyWithPublicKey(payloadStr, signature, rawPubBase64),
    true,
    "Authentic Nagad RSA signature must verify"
  );
  assert.equal(
    verifyWithPublicKey(
      JSON.stringify({ ...payload, amount: "1.00" }),
      signature,
      rawPubBase64
    ),
    false,
    "Tampered Nagad payload must fail RSA signature verification"
  );

  const dhakaNow = getNagadDateTime(new Date("2026-10-25T00:00:00Z"));
  assert.equal(
    dhakaNow,
    "20261025060000",
    "getNagadDateTime must format UTC+6 (Asia/Dhaka) YYYYMMDDHHmmss"
  );
  console.log("  ✓ Nagad RSA/AES encryption, PEM normalization, signature verification & Asia/Dhaka timestamp passed");
}

// Helper to build a valid-format HS256 service_role JWT for config validation
function makeServiceRoleJwt() {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  return `${header}.${payload}.sig`;
}

// ---------------------------------------------------------------------------
// 2. Order Creation Route: Turnstile Production Fail-Closed
// ---------------------------------------------------------------------------
{
  const prodEnv = {
    APP_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://sadhyerbazar.com",
    PAYMENT_MODE: "live",
    IP_HASH_SALT: "0123456789abcdef0123456789abcdef",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: makeServiceRoleJwt(),
    // Intentionally omit TURNSTILE_SECRET_KEY in production to test fail-closed
  };

  const req = new Request("https://sadhyerbazar.com/api/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: "Tanvir Ahmed",
      customerPhone: "01713477780",
      deliveryZone: "inside_dhaka",
      customerDistrict: "Dhaka City",
      customerAddress: "House 12, Road 5, Dhanmondi, Dhaka",
      paymentMethod: "cod",
      paymentPlan: "cod",
      items: [{ productId: "prod-1", variantId: "var-1", quantity: 1 }],
      idempotencyKey: "ord_test_1234567890",
    }),
  });

  let caughtError = null;
  try {
    await createOrderPost({
      request: req,
      env: prodEnv,
      data: { requestId: "req-test-1", ipHash: "hash1" },
      next: async () => new Response(),
    });
  } catch (err) {
    caughtError = err;
  }

  assert.ok(
    caughtError instanceof ConfigError,
    "Production order creation must throw ConfigError (503 in middleware) when TURNSTILE_SECRET_KEY is missing"
  );
  console.log("  ✓ POST /api/orders/create fails closed in production when Turnstile is missing");
}

// ---------------------------------------------------------------------------
// 3. Track Order Route: Input Validation (Requires SB-YYMM-XXXXX + 4 digits)
// ---------------------------------------------------------------------------
{
  const devEnv = {
    APP_ENV: "development",
    PAYMENT_MODE: "sandbox",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: makeServiceRoleJwt(),
  };

  const badReq = new Request("http://localhost:3000/api/orders/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderCode: "SB-2610-ABCDEF1234",
      phoneLast4: "12", // invalid: only 2 digits
    }),
  });

  let caughtTrackErr = null;
  try {
    await trackOrderPost({
      request: badReq,
      env: devEnv,
      data: { requestId: "req-test-2", ipHash: "hash2" },
      next: async () => new Response(),
    });
  } catch (err) {
    caughtTrackErr = err;
  }

  assert.ok(caughtTrackErr instanceof HttpError);
  assert.equal(
    caughtTrackErr.status,
    422,
    "Track order must reject requests without 4-digit phoneLast4"
  );
  console.log("  ✓ POST /api/orders/track enforces Order ID + 4-digit phone suffix");
}

// ---------------------------------------------------------------------------
// 4. Admin Action Route: Rejects Unauthenticated Requests (401)
// ---------------------------------------------------------------------------
{
  const devEnv = {
    APP_ENV: "development",
    PAYMENT_MODE: "sandbox",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: makeServiceRoleJwt(),
  };

  const unauthReq = new Request("http://localhost:3000/api/admin/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "set_order_status",
      orderId: "00000000-0000-0000-0000-000000000001",
      newStatus: "confirmed",
    }),
  });

  let caughtAdminErr = null;
  try {
    await adminActionPost({
      request: unauthReq,
      env: devEnv,
      data: { requestId: "req-test-3", ipHash: "hash3" },
      next: async () => new Response(),
    });
  } catch (err) {
    caughtAdminErr = err;
  }

  assert.ok(caughtAdminErr instanceof HttpError);
  assert.equal(
    caughtAdminErr.status,
    401,
    "POST /api/admin/action must throw 401 when Authorization Bearer token is missing"
  );
  console.log("  ✓ POST /api/admin/action rejects unauthenticated requests with 401");
}

// ---------------------------------------------------------------------------
// 5. Admin Hero CMS Actions: Rejects Unauthenticated Requests (401)
// ---------------------------------------------------------------------------
{
  const devEnv = {
    APP_ENV: "development",
    PAYMENT_MODE: "sandbox",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: makeServiceRoleJwt(),
  };

  const heroActions = [
    "hero_save_slide",
    "hero_delete_slide",
    "hero_reorder",
    "hero_set_active",
    "hero_save_settings",
    "hero_reset_defaults",
  ];

  for (const action of heroActions) {
    const unauthReq = new Request("http://localhost:3000/api/admin/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    let caughtErr = null;
    try {
      await adminActionPost({
        request: unauthReq,
        env: devEnv,
        data: { requestId: `req-hero-${action}`, ipHash: "hash-hero" },
        next: async () => new Response(),
      });
    } catch (err) {
      caughtErr = err;
    }

    assert.ok(caughtErr instanceof HttpError);
    assert.equal(
      caughtErr.status,
      401,
      `Action ${action} must reject without auth header`
    );
  }
  console.log("  ✓ POST /api/admin/action rejects unauthenticated hero CMS actions with 401");
}

console.log("All Edge API & Cryptographic Gateway tests passed!");
