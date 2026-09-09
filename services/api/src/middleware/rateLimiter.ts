import { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60_000);

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests. Please try again later.",
    keyGenerator = (req: Request) => {
      // 1. Authenticated user ID
      const authUser = (req as any).user?.id;
      if (authUser) return `user:${authUser}`;

      // 2. Normalized Email or Phone if present in request body
      if (req.body?.email && typeof req.body.email === "string") {
        return `email:${req.body.email.toLowerCase().trim()}`;
      }
      if (req.body?.phone && typeof req.body.phone === "string") {
        return `phone:${req.body.phone.replace(/[\s\-\(\)]/g, "")}`;
      }

      // 3. Client IP address (sanitizing X-Forwarded-For)
      const forwarded = req.headers?.["x-forwarded-for"];
      let clientIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";
      if (typeof forwarded === "string" && forwarded.trim()) {
        const parts = forwarded.split(",");
        const firstIp = parts[0]?.trim();
        if (firstIp) clientIp = firstIp;
      }
      return `ip:${clientIp}`;
    },
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, allow bypassing rate limits unless specifically testing rate limiter
    if (process.env.NODE_ENV === "test" && req.header?.("x-skip-rate-limit") === "true") {
      return next();
    }

    // Normalize endpoint path: lowercase and strip trailing slashes
    const rawPath = `${req.baseUrl || ""}${req.path || ""}`;
    const normalizedPath = rawPath.toLowerCase().replace(/\/+$/, "") || "/";
    const key = `${normalizedPath}:${keyGenerator(req)}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("RateLimit-Limit", maxRequests);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", resetSeconds);

    if (record.count > maxRequests) {
      res.setHeader("Retry-After", resetSeconds);
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message,
          retryAfterSeconds: resetSeconds,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}

// ── Preset Rate Limiters for NEARVIA ──
export const globalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 500,
  message: "Platform request rate limit exceeded. Please wait a few minutes.",
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 25,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
});

export const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 6,
  message: "Too many OTP verification attempts. Please wait 15 minutes.",
});

export const sensitiveActionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 60,
  message: "Too many sensitive actions submitted. Please slow down.",
});

export const messagesLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 60,
  message: "Message frequency limit reached. Please wait before sending more messages.",
});

export const aiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30,
  message: "Intelligence & voice assistance rate limit reached. Please wait a few moments.",
});

export const paymentLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30,
  message: "Payment transaction rate limit exceeded. Please wait a few minutes.",
});

export const webhookLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 120,
  message: "Webhook event ingestion rate limit exceeded.",
});

export const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200,
  message: "Admin operational request rate limit exceeded.",
});
