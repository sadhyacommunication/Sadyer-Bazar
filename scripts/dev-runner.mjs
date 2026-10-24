#!/usr/bin/env node
/**
 * scripts/dev-runner.mjs
 *
 * Starts the local Edge Functions API simulator (`scripts/dev-api-server.mjs`)
 * alongside `next dev` so `npm run dev` serves both the Next.js frontend and
 * `/api/*` Cloudflare Pages Functions using credentials from `.env` / `.env.local` / `.dev.vars`.
 */

import { spawn } from "node:child_process";

const isWin = process.platform === "win32";
const npxCmd = isWin ? "npx.cmd" : "npx";

const apiProc = spawn(npxCmd, ["tsx", "scripts/dev-api-server.mjs"], {
  stdio: "inherit",
  shell: isWin,
  env: { ...process.env, NODE_ENV: "development" },
});

const nextProc = spawn(npxCmd, ["next", "dev"], {
  stdio: "inherit",
  shell: isWin,
  env: { ...process.env, NODE_ENV: "development" },
});

function cleanup() {
  try {
    apiProc.kill();
  } catch {}
  try {
    nextProc.kill();
  } catch {}
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

nextProc.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
