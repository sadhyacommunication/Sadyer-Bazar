import fs from "node:fs";
import path from "node:path";

const root = path.resolve("supabase");
const migrationsDir = path.join(root, "migrations");
const schemaFile = path.join(root, "schema.sql");
const outputFile = path.join(root, "MASTER_PRODUCTION_MIGRATION.sql");

const header = `-- ============================================================================
-- SADYER BAZAR (সাধ্যের বাজার) — ONE-CLICK MASTER PRODUCTION SQL MIGRATION
-- Project: sadhyarbazar
-- Instructions: Copy & Paste this entire file into Supabase SQL Editor and click RUN.
-- Safe to re-run (idempotent).
-- ============================================================================

`;

let content = header;

if (fs.existsSync(schemaFile)) {
  content += `-- =============================================================================\n`;
  content += `-- FILE: schema.sql\n`;
  content += `-- =============================================================================\n\n`;
  content += fs.readFileSync(schemaFile, "utf8").trim() + "\n\n";
}

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

for (const file of files) {
  content += `-- =============================================================================\n`;
  content += `-- FILE: migrations/${file}\n`;
  content += `-- =============================================================================\n\n`;
  content += fs.readFileSync(path.join(migrationsDir, file), "utf8").trim() + "\n\n";
}

fs.writeFileSync(outputFile, content, "utf8");
console.log(`Successfully generated ${outputFile} (${files.length} migrations included)`);
