import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve(process.cwd(), "out");
const vercelStaticDir = path.resolve(process.cwd(), ".vercel", "output", "static");

if (fs.existsSync(outDir)) {
  fs.mkdirSync(vercelStaticDir, { recursive: true });
  fs.cpSync(outDir, vercelStaticDir, { recursive: true });
  console.log("✓ Synced static build output to both out/ and .vercel/output/static/");
}
