/**
 * Nagad Merchant Cryptographic Engine (DFS Payment Gateway v0.2.0)
 *
 * Security & Compatibility Features:
 *  - Compatible with Cloudflare Pages Functions `nodejs_compat` (`node:crypto`).
 *  - Enforces `requirePaymentMode(cfg)` ("live" vs "sandbox").
 *  - Normalizes single-line or `\n`-escaped PEM keys from `.env`/`.dev.vars`/Cloudflare Secrets
 *    and wraps base64 bodies at 64 characters per line so OpenSSL/BoringSSL never rejects them.
 *  - Uses Bangladesh Standard Time (`UTC+6`, `Asia/Dhaka`) for `getNagadDateTime()` as required
 *    by Nagad's DFS API.
 *  - Supports RSA-PKCS1-v1_5 encryption/decryption, SHA256withRSA signing/verification, and AES-128-CBC.
 */
import crypto from "node:crypto";
import { requirePaymentMode, type Config, type Env, type PaymentMode } from "../../../_lib/env";
import { HttpError } from "../../../_lib/http";

export interface NagadCredentials {
  merchantId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  mode: PaymentMode;
}

export function getNagadBaseUrl(mode: PaymentMode): string {
  return mode === "live"
    ? "https://api.mynagad.com/api/dfs"
    : "http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs";
}

function isPlaceholder(val: string | undefined): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  return !trimmed || /your-|placeholder|changeme/i.test(trimmed);
}

export function isNagadConfigured(env: Env): boolean {
  return (
    !isPlaceholder(env.NAGAD_MERCHANT_ID) &&
    !isPlaceholder(env.NAGAD_PUBLIC_KEY) &&
    !isPlaceholder(env.NAGAD_PRIVATE_KEY)
  );
}

/**
 * Normalizes a raw PEM or base64 key string into standard 64-char-wrapped PEM format.
 * Preserves PKCS#1 (`RSA PRIVATE KEY` / `RSA PUBLIC KEY`) vs PKCS#8/SPKI (`PRIVATE KEY` / `PUBLIC KEY`)
 * headers if already present, or wraps raw base64 with the standard header.
 */
export function formatPemKey(raw: string, type: "PUBLIC" | "PRIVATE"): string {
  const unescaped = raw.replace(/\\n/g, "\n").replace(/\r/g, "").trim();

  let headerLabel = `${type} KEY`;
  const match = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(unescaped);
  let bodyB64: string;
  if (match) {
    headerLabel = match[1].trim();
    bodyB64 = match[2].replace(/\s+/g, "");
  } else {
    bodyB64 = unescaped
      .replace(/-----BEGIN [^-]+-----/g, "")
      .replace(/-----END [^-]+-----/g, "")
      .replace(/\s+/g, "");
  }

  const lines: string[] = [];
  for (let i = 0; i < bodyB64.length; i += 64) {
    lines.push(bodyB64.slice(i, i + 64));
  }

  return `-----BEGIN ${headerLabel}-----\n${lines.join("\n")}\n-----END ${headerLabel}-----`;
}

export function requireNagadCredentials(cfg: Config, env: Env): NagadCredentials {
  const mode = requirePaymentMode(cfg);
  if (!isNagadConfigured(env)) {
    throw new HttpError(
      503,
      "gateway_unconfigured",
      "Nagad Merchant payment is temporarily unavailable. Please try bKash or Cash on Delivery."
    );
  }
  return {
    merchantId: env.NAGAD_MERCHANT_ID!.trim(),
    publicKeyPem: formatPemKey(env.NAGAD_PUBLIC_KEY!, "PUBLIC"),
    privateKeyPem: formatPemKey(env.NAGAD_PRIVATE_KEY!, "PRIVATE"),
    mode,
  };
}

/**
 * Generates a cryptographically random alphanumeric string (default length 20).
 */
export function generateRandomString(length = 20): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Encrypts data using AES-128-CBC with PKCS7 padding (16-byte UTF-8 key and IV).
 */
export function encryptAes128(plainText: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

/**
 * Decrypts AES-128-CBC encrypted data.
 */
export function decryptAes128(cipherBase64: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  let decrypted = decipher.update(cipherBase64, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Encrypts plaintext with Nagad's RSA Public Key (PKCS#1 v1.5 padding).
 */
export function encryptWithPublicKey(data: string, publicKeyPem: string): string {
  const pem = formatPemKey(publicKeyPem, "PUBLIC");
  const encrypted = crypto.publicEncrypt(
    {
      key: pem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(data, "utf8")
  );
  return encrypted.toString("base64");
}

/**
 * Decrypts ciphertext using Merchant's RSA Private Key (PKCS#1 v1.5 padding).
 */
export function decryptWithPrivateKey(cipherBase64: string, privateKeyPem: string): string {
  const pem = formatPemKey(privateKeyPem, "PRIVATE");
  const decrypted = crypto.privateDecrypt(
    {
      key: pem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(cipherBase64, "base64")
  );
  return decrypted.toString("utf8");
}

/**
 * Signs data using Merchant's RSA Private Key (`SHA256withRSA`).
 */
export function signWithPrivateKey(data: string, privateKeyPem: string): string {
  const pem = formatPemKey(privateKeyPem, "PRIVATE");
  const sign = crypto.createSign("SHA256");
  sign.update(data, "utf8");
  sign.end();
  return sign.sign(pem, "base64");
}

/**
 * Verifies a `SHA256withRSA` signature using Nagad's RSA Public Key.
 */
export function verifyWithPublicKey(data: string, signatureBase64: string, publicKeyPem: string): boolean {
  try {
    const pem = formatPemKey(publicKeyPem, "PUBLIC");
    const verify = crypto.createVerify("SHA256");
    verify.update(data, "utf8");
    verify.end();
    return verify.verify(pem, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

/**
 * Formats date-time string strictly in Nagad format `YYYYMMDDHHmmss` in Bangladesh Standard Time (`UTC+6`).
 */
export function getNagadDateTime(now: Date = new Date()): string {
  // Asia/Dhaka is permanently UTC+6 (no DST)
  const dhakaMs = now.getTime() + 6 * 60 * 60 * 1000;
  const dhaka = new Date(dhakaMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dhaka.getUTCFullYear()}${pad(dhaka.getUTCMonth() + 1)}${pad(dhaka.getUTCDate())}${pad(
    dhaka.getUTCHours()
  )}${pad(dhaka.getUTCMinutes())}${pad(dhaka.getUTCSeconds())}`;
}
