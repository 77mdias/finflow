import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/shared/config/env";

import { logger } from "./logger";

export type RateLimitPolicy = "login" | "actions" | "export" | "unsubscribe";

const POLICIES: Record<RateLimitPolicy, { limit: number; windowSeconds: number }> = {
  login: { limit: 5, windowSeconds: 60 },
  actions: { limit: 60, windowSeconds: 60 },
  export: { limit: 3, windowSeconds: 3600 },
  unsubscribe: { limit: 30, windowSeconds: 60 },
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(policy: RateLimitPolicy, key: string): Promise<RateLimitResult>;
}

/** Janela deslizante aproximada em memória (desenvolvimento e testes). */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly now: () => number = Date.now) {}
  async check(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
    const { limit, windowSeconds } = POLICIES[policy];
    const t = this.now();
    const k = `${policy}:${key}`;
    const recent = (this.hits.get(k) ?? []).filter((x) => t - x < windowSeconds * 1000);
    if (recent.length >= limit) {
      const retry = Math.ceil((windowSeconds * 1000 - (t - recent[0]!)) / 1000);
      this.hits.set(k, recent);
      return { allowed: false, retryAfterSeconds: Math.max(retry, 1) };
    }
    recent.push(t);
    this.hits.set(k, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

class UpstashRateLimiter implements RateLimiter {
  private readonly limiters: Record<RateLimitPolicy, Ratelimit>;
  constructor(url: string, token: string) {
    const redis = new Redis({ url, token });
    this.limiters = Object.fromEntries(
      Object.entries(POLICIES).map(([name, p]) => [
        name,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(p.limit, `${p.windowSeconds} s`),
          prefix: `ff:rl:${name}`,
        }),
      ]),
    ) as Record<RateLimitPolicy, Ratelimit>;
  }
  async check(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 500));
      const res = await Promise.race([this.limiters[policy].limit(key), timeout]);
      return {
        allowed: res.success,
        retryAfterSeconds: Math.max(Math.ceil((res.reset - Date.now()) / 1000), 1),
      };
    } catch (e) {
      // Fail-open: indisponibilidade do rate limit não derruba o app (INTEGRATIONS §6).
      logger.warn({ err: e, policy }, "rate limit indisponível — permitindo requisição");
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }
}

let instance: RateLimiter | undefined;

export function rateLimiter(): RateLimiter {
  if (instance) return instance;
  const e = env();
  instance =
    e.RATE_LIMIT_DRIVER === "upstash"
      ? new UpstashRateLimiter(e.UPSTASH_REDIS_REST_URL!, e.UPSTASH_REDIS_REST_TOKEN!)
      : new MemoryRateLimiter();
  return instance;
}

export function setRateLimiter(r: RateLimiter | undefined): void {
  instance = r;
}
