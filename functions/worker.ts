/**
 * Cloudflare Worker + Static Assets Entrypoint (`npx wrangler deploy`)
 *
 * Routes:
 *  - `/api/*` -> Executed through `functions/api/_middleware.ts` (CORS, CSRF,
 *    Content-Type/Length guards, rate-limiting, security headers, error boundary)
 *    and dispatched to the matching edge route handler.
 *  - All other paths -> Served from the static Next.js export (`./out`) via `env.ASSETS`.
 */
import type { Env } from "./_lib/env";
import { HttpError } from "./_lib/http";
import type { PagesContext } from "./_lib/types";
import { onRequest as apiMiddleware } from "./api/_middleware";

import { onRequestPost as adminActionPost } from "./api/admin/action";
import { onRequestPost as ordersCreatePost } from "./api/orders/create";
import { onRequestPost as ordersQuotePost } from "./api/orders/quote";
import { onRequestPost as ordersTrackPost } from "./api/orders/track";
import { onRequestGet as bkashCallbackGet } from "./api/payment/bkash/callback";
import { onRequestPost as bkashCreatePost } from "./api/payment/bkash/create";
import { onRequestGet as nagadCallbackGet } from "./api/payment/nagad/callback";
import { onRequestPost as nagadCreatePost } from "./api/payment/nagad/create";
import { onRequestPost as reviewsSubmitPost } from "./api/reviews/submit";

export interface WorkerEnv extends Env {
  ASSETS?: {
    fetch: (request: Request | string) => Promise<Response>;
  };
}

interface WorkerExecutionContext {
  waitUntil?: (promise: Promise<unknown>) => void;
}

type RouteHandler = (ctx: PagesContext) => Promise<Response>;

const POST_ROUTES: Record<string, RouteHandler> = {
  "/api/orders/quote": ordersQuotePost,
  "/api/orders/create": ordersCreatePost,
  "/api/orders/track": ordersTrackPost,
  "/api/reviews/submit": reviewsSubmitPost,
  "/api/admin/action": adminActionPost,
  "/api/payment/bkash/create": bkashCreatePost,
  "/api/payment/nagad/create": nagadCreatePost,
};

const GET_ROUTES: Record<string, RouteHandler> = {
  "/api/payment/bkash/callback": bkashCallbackGet,
  "/api/payment/nagad/callback": nagadCallbackGet,
};

function normalizeApiPath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

async function dispatchApiRoute(ctx: PagesContext): Promise<Response> {
  const url = new URL(ctx.request.url);
  const path = normalizeApiPath(url.pathname);
  const method = ctx.request.method.toUpperCase();

  if (method === "POST") {
    const handler = POST_ROUTES[path];
    if (handler) return handler(ctx);
    if (GET_ROUTES[path]) {
      throw new HttpError(405, "method_not_allowed", "Method not allowed");
    }
    throw new HttpError(404, "not_found", "API endpoint not found");
  }

  if (method === "GET") {
    const handler = GET_ROUTES[path];
    if (handler) return handler(ctx);
    if (POST_ROUTES[path]) {
      throw new HttpError(405, "method_not_allowed", "Method not allowed");
    }
    throw new HttpError(404, "not_found", "API endpoint not found");
  }

  throw new HttpError(405, "method_not_allowed", "Method not allowed");
}

const worker = {
  async fetch(
    request: Request,
    env: WorkerEnv,
    execCtx?: WorkerExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = normalizeApiPath(url.pathname);

    if (path === "/api" || path.startsWith("/api/")) {
      const ctx: PagesContext = {
        request,
        env,
        params: {},
        data: {},
        next: () => dispatchApiRoute(ctx),
        waitUntil: (p) => execCtx?.waitUntil?.(p),
      };
      return apiMiddleware(ctx);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};

export default worker;
