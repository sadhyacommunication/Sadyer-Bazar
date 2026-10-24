#!/usr/bin/env tsx
/**
 * scripts/dev-api-server.mjs
 *
 * Local Cloudflare Pages Functions Edge API Simulator.
 * Loads credentials from `.env`, `.env.local`, and `.dev.vars` automatically
 * so pasting bKash and Nagad credentials into `.env` works immediately during
 * local testing (`npm run dev`).
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

import { onRequest as middlewareOnRequest } from "../functions/api/_middleware";
import { onRequestPost as quotePost } from "../functions/api/orders/quote";
import { onRequestPost as createOrderPost } from "../functions/api/orders/create";
import { onRequestPost as trackOrderPost } from "../functions/api/orders/track";
import { onRequestPost as submitReviewPost } from "../functions/api/reviews/submit";
import { onRequestPost as adminActionPost } from "../functions/api/admin/action";
import { onRequestPost as bkashCreatePost } from "../functions/api/payment/bkash/create";
import { onRequestGet as bkashCallbackGet } from "../functions/api/payment/bkash/callback";
import { onRequestPost as nagadCreatePost } from "../functions/api/payment/nagad/create";
import { onRequestGet as nagadCallbackGet } from "../functions/api/payment/nagad/callback";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

function loadMergedEnv() {
  const cwd = process.cwd();
  return {
    APP_ENV: "development",
    ...parseEnvFile(path.join(cwd, ".env")),
    ...parseEnvFile(path.join(cwd, ".env.local")),
    ...parseEnvFile(path.join(cwd, ".dev.vars")),
    ...process.env,
  };
}

const ROUTES = {
  "POST /api/orders/quote": quotePost,
  "POST /api/orders/create": createOrderPost,
  "POST /api/orders/track": trackOrderPost,
  "POST /api/reviews/submit": submitReviewPost,
  "POST /api/admin/action": adminActionPost,
  "POST /api/payment/bkash/create": bkashCreatePost,
  "GET /api/payment/bkash/callback": bkashCallbackGet,
  "POST /api/payment/nagad/create": nagadCreatePost,
  "GET /api/payment/nagad/callback": nagadCallbackGet,
};

const PORT = Number(process.env.DEV_API_PORT || 8788);

const server = http.createServer(async (req, res) => {
  try {
    const env = loadMergedEnv();
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
    const proto = req.headers["x-forwarded-proto"] || "http";
    const fullUrl = `${proto}://${host}${req.url || "/"}`;

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyBuffer = Buffer.concat(chunks);

    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) {
        headers.set(k, v.join(", "));
      } else if (typeof v === "string") {
        headers.set(k, v);
      }
    }
    if (!headers.has("cf-connecting-ip")) {
      headers.set("cf-connecting-ip", req.socket.remoteAddress || "127.0.0.1");
    }

    const method = (req.method || "GET").toUpperCase();
    const webReq = new Request(fullUrl, {
      method,
      headers,
      body:
        method === "GET" || method === "HEAD" || bodyBuffer.length === 0
          ? undefined
          : bodyBuffer,
    });

    const pathname = new URL(fullUrl).pathname.replace(/\/+$/, "") || "/";
    const routeHandler = ROUTES[`${method} ${pathname}`];

    const data = {};
    const waitUntilPromises = [];
    const context = {
      request: webReq,
      env,
      data,
      waitUntil(promise) {
        waitUntilPromises.push(Promise.resolve(promise).catch(() => {}));
      },
      async next() {
        if (!routeHandler) {
          return new Response(
            JSON.stringify({
              ok: false,
              code: "NOT_FOUND",
              error: `No handler registered for ${method} ${pathname}`,
            }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        return await routeHandler({
          request: webReq,
          env,
          data,
          waitUntil: context.waitUntil,
        });
      },
    };

    const webRes = await middlewareOnRequest(context);
    await Promise.allSettled(waitUntilPromises);

    res.statusCode = webRes.status;
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    const arrayBuf = await webRes.arrayBuffer();
    res.end(Buffer.from(arrayBuf));
  } catch (err) {
    console.error("[dev-api-server] Unhandled error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: false,
        code: "INTERNAL_ERROR",
        error: err instanceof Error ? err.message : "Internal dev API error",
      })
    );
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `⚡ [Sadyer Bazar Edge API] Listening on http://127.0.0.1:${PORT} (loaded .env / .env.local / .dev.vars)`
  );
});
