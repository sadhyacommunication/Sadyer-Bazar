/**
 * Nagad Merchant Cryptographic Engine
 * Handles RSA-2048 Asymmetric Encryption/Signing and AES-128-CBC Data Encryption
 * Strictly adheres to Bangladesh Bank & Nagad DFS Payment Gateway Specifications.
 */

import crypto from "node:crypto";

export interface NagadEnv {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  NAGAD_MERCHANT_ID?: string;
  NAGAD_ACCOUNT_PHONE?: string;
  NAGAD_PUBLIC_KEY?: string;
  NAGAD_PRIVATE_KEY?: string;
  NAGAD_IS_LIVE?: string;
}

export function isNagadConfigured(env: NagadEnv): boolean {
  return Boolean(
    env.NAGAD_MERCHANT_ID &&
    env.NAGAD_PUBLIC_KEY &&
    env.NAGAD_PRIVATE_KEY
  );
}

export function getNagadBaseUrl(isLive: boolean): string {
  return isLive
    ? "https://api.mynagad.com/api/dfs"
    : "http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs";
}

/**
 * Normalizes PEM string formatting (handles escaped \n in env variables)
 */
export function formatPemKey(raw: string, type: "PUBLIC" | "PRIVATE"): string {
  const clean = raw.replace(/\\n/g, "\n").trim();
  if (clean.includes(`-----BEGIN ${type}`)) {
    return clean;
  }
  return `-----BEGIN ${type} KEY-----\n${clean}\n-----END ${type} KEY-----`;
}

/**
 * Generates a cryptographically random alphanumeric string (length 16)
 */
export function generateRandomString(length = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Encrypts data using AES-128-CBC with PKCS5/PKCS7 padding
 */
export function encryptAes128(plainText: string, key: string, iv: string): string {
  const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

/**
 * Decrypts AES-128-CBC encrypted data
 */
export function decryptAes128(cipherBase64: string, key: string, iv: string): string {
  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  let decrypted = decipher.update(cipherBase64, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Encrypts data with Nagad's RSA Public Key (PKCS1 Padding)
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
 * Decrypts data using Merchant's RSA Private Key (PKCS1 Padding)
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
 * Signs data using Merchant's RSA Private Key (SHA256withRSA)
 */
export function signWithPrivateKey(data: string, privateKeyPem: string): string {
  const pem = formatPemKey(privateKeyPem, "PRIVATE");
  const sign = crypto.createSign("SHA256");
  sign.update(data);
  sign.end();
  return sign.sign(pem, "base64");
}

/**
 * Verifies signature using Nagad's RSA Public Key
 */
export function verifyWithPublicKey(data: string, signatureBase64: string, publicKeyPem: string): boolean {
  try {
    const pem = formatPemKey(publicKeyPem, "PUBLIC");
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();
    return verify.verify(pem, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

/**
 * Formats date-time string strictly in Nagad format: YYYYMMDDHHmmss (UTC)
 */
export function getNagadDateTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate()
  )}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(
    now.getUTCSeconds()
  )}`;
}
