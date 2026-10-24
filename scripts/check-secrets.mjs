#!/usr/bin/env node
/**
 * scripts/check-secrets.mjs
 *
 * Scans the static build output (`out/`) to guarantee that zero server-only
 * environment variable values or PEM private keys leaked into client-side assets.
 */

import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve(process.cwd(), "out");

const FORBIDDEN_PATTERNS = [
  { name: "PEM Private Key Header", regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/ },
  { name: "Supabase Service Role JWT claim", regex: /"role"\s*:\s*"service_role"/ },
  { name: "Hardcoded old admin passkey", regex: /SadyerBazar#Admin2026!/ },
  { name: "Hardcoded old admin SHA-256 hash", regex: /e553408b8eb0612d937e582be24e897be4a5ac5283a222d0fa5963eb8df5f9e7/ },
];

const SECRET_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "BKASH_APP_SECRET",
  "BKASH_PASSWORD",
  "NAGAD_MERCHANT_PRIVATE_KEY",
  "TURNSTILE_SECRET_KEY",
  "SSLCOMMERZ_STORE_PASS",
];

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (/\.(js|html|json|txt|css)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

if (!fs.existsSync(OUT_DIR)) {
  console.log("[check-secrets] out/ directory not found yet — skipping static bundle scan.");
  process.exit(0);
}

const files = walkFiles(OUT_DIR);
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const rel = path.relative(process.cwd(), file);

  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.regex.test(content)) {
      violations.push(`${rel}: matched forbidden pattern "${pat.name}"`);
    }
  }

  for (const key of SECRET_ENV_KEYS) {
    const val = process.env[key]?.trim();
    if (val && val.length >= 8 && content.includes(val)) {
      violations.push(`${rel}: leaked runtime secret value of ${key}`);
    }
  }
}

if (violations.length > 0) {
  console.error("❌ [check-secrets] SECRET LEAK DETECTED IN STATIC BUILD:");
  for (const v of violations) {
    console.error("  -", v);
  }
  process.exit(1);
}

console.log(`✅ [check-secrets] Scanned ${files.length} static build files in out/ — zero secret leaks found.`);
