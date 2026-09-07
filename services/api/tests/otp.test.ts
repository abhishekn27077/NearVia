import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { authRouter } from "../src/modules/auth";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { otpService } from "../src/modules/otp/service";
import { mockOtpProvider } from "../src/modules/otp/provider/mock.provider";
import { msg91OtpProvider } from "../src/modules/otp/provider/msg91.provider";
import * as db from "../src/db";

// Mock the DB query helper
vi.mock("../src/db", () => ({
  query: vi.fn(),
  getClient: vi.fn(),
}));

describe("Progressive OTP Verification & Staging Provider Suite", () => {
  let app: Express;

  beforeAll(() => {
    (db.query as any).mockImplementation((sql: string) => {
      if (sql.includes("FROM users")) {
        return Promise.resolve({
          rows: [
            {
              id: "00000000-0000-0000-0000-000000000001",
              auth_id: "00000000-0000-0000-0000-000000000001",
              phone: "+919876543210",
              full_name: "Mock Worker",
              role: "WORKER",
              is_active: true,
            },
          ],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    app = express();
    app.use(express.json());
    app.use("/api/v1/auth", authRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  describe("Phone Number Normalization & Validation", () => {
    it("should normalize 10-digit Indian numbers with +91", () => {
      expect(otpService.normalizePhone("9876543210")).toBe("+919876543210");
      expect(otpService.normalizePhone("  87654-32109  ")).toBe("+918765432109");
      expect(otpService.normalizePhone("919876543210")).toBe("+919876543210");
      expect(otpService.normalizePhone("+919876543210")).toBe("+919876543210");
    });

    it("should reject invalid mobile numbers", () => {
      expect(() => otpService.normalizePhone("12345")).toThrow();
      expect(() => otpService.normalizePhone("abcdefghij")).toThrow();
      expect(() => otpService.normalizePhone("")).toThrow();
    });
  });

  describe("Cryptographic Challenge & HMAC Verification", () => {
    it("should generate 64-character SHA-256 HMAC hash", () => {
      const hash = otpService.hashOtp("+919876543210", "123456");
      expect(hash).toHaveLength(64);
      expect(otpService.verifyHash("123456", "+919876543210", hash)).toBe(true);
      expect(otpService.verifyHash("000000", "+919876543210", hash)).toBe(false);
    });
  });

  describe("Provider Implementations", () => {
    it("MockOTPProvider should send mock SMS without external network calls", async () => {
      const res = await mockOtpProvider.sendOtp({ phone: "+919876543210", otp: "123456" });
      expect(res.success).toBe(true);
      expect(res.provider).toBe("mock");
      expect(res.messageId).toContain("mock_msg_");
    });

    it("MSG91OTPProvider should gracefully report missing credentials in test mode", async () => {
      const res = await msg91OtpProvider.sendOtp({ phone: "+919876543210", otp: "123456" });
      expect(res.success).toBe(false);
      expect(res.provider).toBe("msg91");
      expect(res.error).toContain("MSG91 credentials");
    });
  });

  describe("OTP API Endpoints & Security Guards", () => {
    it("should reject unauthenticated send-otp request with HTTP 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send({ phone: "+919876543210" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject unauthenticated verify-otp request with HTTP 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .send({ phone: "+919876543210", otp: "123456" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject unauthenticated resend-otp request with HTTP 401", async () => {
      const res = await request(app)
        .post("/api/v1/auth/resend-otp")
        .send({ phone: "+919876543210" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject send-otp with missing phone body with HTTP 400", async () => {
      // Pass demo worker token
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .set("Authorization", "Bearer mock_token_00000000-0000-0000-0000-000000000001")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject verify-otp with missing otp body with HTTP 400", async () => {
      const res = await request(app)
        .post("/api/v1/auth/verify-otp")
        .set("Authorization", "Bearer mock_token_00000000-0000-0000-0000-000000000001")
        .send({ phone: "+919876543210" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
