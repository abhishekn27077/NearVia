import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRateLimiter } from "../src/middleware/rateLimiter";
import { redactSensitiveData } from "../src/middleware/requestLogger";
import { AppError } from "../src/middleware/errorHandler";

describe("Phase 18: Production Security, Performance & Reliability Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Rate Limiting Middleware & RFC Headers", () => {
    it("should enforce request limits and set RFC rate-limit headers", () => {
      const limiter = createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 2,
        message: "Rate limit exceeded test",
      });

      const mockReq: any = { ip: "192.168.1.100", header: () => undefined };
      const setHeaders: Record<string, any> = {};
      let statusCode = 200;
      let jsonBody: any = null;

      const mockRes: any = {
        setHeader: (k: string, v: any) => {
          setHeaders[k] = v;
        },
        status: (code: number) => {
          statusCode = code;
          return {
            json: (body: any) => {
              jsonBody = body;
            },
          };
        },
      };

      const next = vi.fn();

      // Request 1: Allowed
      limiter(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(setHeaders["RateLimit-Remaining"]).toBe(1);

      // Request 2: Allowed
      limiter(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(2);
      expect(setHeaders["RateLimit-Remaining"]).toBe(0);

      // Request 3: Blocked (429)
      limiter(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(2);
      expect(statusCode).toBe(429);
      expect(jsonBody?.error?.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(setHeaders).toHaveProperty("Retry-After");
    });
  });

  describe("2. Sensitive Data & Credential Protection", () => {
    it("should comprehensively scrub credentials, payment tokens, and secrets", () => {
      const payload = {
        user: "rahul",
        password: "MyPassword123!",
        pin: "1234",
        api_key: "mock_test_api_key",
        authorization: "Bearer mock_jwt_token",
        payment_info: {
          secret_key: "mock_test_secret_key",
          card_number: "4111222233334444",
          cvv: "123",
          amount: 500,
        },
      };

      const sanitized = redactSensitiveData(payload);

      expect(sanitized.user).toBe("rahul");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.api_key).toBe("[REDACTED]");
      expect(sanitized.authorization).toBe("[REDACTED]");
      expect(sanitized.payment_info.secret_key).toBe("[REDACTED]");
      expect(sanitized.payment_info.card_number).toBe("[REDACTED]");
      expect(sanitized.payment_info.cvv).toBe("[REDACTED]");
      expect(sanitized.payment_info.amount).toBe(500);
    });
  });

  describe("3. Application Error Isolation", () => {
    it("should construct typed AppError instances with HTTP status codes and domain error codes", () => {
      const err = new AppError("Unauthorized action attempted", 403, "FORBIDDEN");
      expect(err.message).toBe("Unauthorized action attempted");
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
      expect(err.name).toBe("AppError");
    });
  });
});
