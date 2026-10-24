import type { Env } from "./env";

/** Minimal Cloudflare Pages Functions context (no @cloudflare/workers-types dependency needed). */
export interface PagesContext<E = Env> {
  request: Request;
  env: E;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
}
