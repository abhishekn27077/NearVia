import { describe, it, expect, beforeAll, vi, afterEach } from "vitest";
import request from "supertest";
import express, { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { UserRole } from "@nearvia/types";
import {
  errorHandler,
  notFoundHandler,
  authenticateUser,
  requireRole,
} from "../src/middleware";
import { authRouter } from "../src/modules/auth";
import { authService } from "../src/modules/auth/service";
import { otpService } from "../src/modules/otp/service";
import { query } from "../src/db";
import { verifySupabaseToken } from "../src/services/supabase.service";

describe("NEARVIA Authentication & Identity Adversarial Security Hardening Suite", () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Seed test worker in local database for authenticated tests
    try {
      await query(`
        INSERT INTO users (id, auth_id, phone, full_name, email, role, is_active, mobile_verified, identity_verified)
        VALUES ('00000000-0000-0000-0000-000000000099', 'test_worker_1', '+919876543291', 'Test Worker One', 'testworker1@nearvia.test', 'WORKER', TRUE, FALSE, FALSE)
        ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE, role = 'WORKER'
      `);
    } catch {
      // Ignore if running without live database
    }

    // Mount Auth Router
    app.use("/api/v1/auth", authRouter);

    // Mock Admin Role Route for testing cross-role privilege escalation
    app.put(
      "/api/v1/admin/users/:id/role",
      authenticateUser,
      requireRole(UserRole.ADMIN),
      (req: Request, res: Response) => {
        res.status(200).json({ success: true, message: "Role updated by admin" });
      },
    );

    // Error Handlers
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Unauthenticated Google sync → rejected (401)
  // ─────────────────────────────────────────────────────────────
  it("1. unauthenticated Google sync → rejected with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .send({
        authId: "google_uid_123",
        email: "attacker@gmail.com",
        role: "WORKER",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toContain("Authentication required");
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Forged authId → rejected (403)
  // ─────────────────────────────────────────────────────────────
  it("2. forged authId in sync-google-profile → rejected with 403", async () => {
    // Valid token for auth_legit_user, but request body specifies victim authId
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_auth_legit_user")
      .send({
        authId: "auth_victim_identity_forged",
        email: "legit@example.com",
        role: "WORKER",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("Identity mismatch");
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Worker attempting ADMIN role → rejected
  // ─────────────────────────────────────────────────────────────
  it("3. worker attempting ADMIN role via sync-google-profile → rejected with 403", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_worker_escalate")
      .send({
        authId: "worker_escalate",
        role: "ADMIN",
      });

    expect(res.status).toBe(400); // Caught by syncGoogleProfileSchema / controller check
    expect(res.body.success).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Provider attempting ADMIN role → rejected
  // ─────────────────────────────────────────────────────────────
  it("4. provider attempting ADMIN role via registration → rejected with 400/403", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        authId: "provider_admin_attempt",
        phone: "+919876543299",
        fullName: "Malicious Provider",
        role: "ADMIN",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Agent attempting ADMIN role → rejected
  // ─────────────────────────────────────────────────────────────
  it("5. agent attempting ADMIN role via direct signup → rejected with 403", async () => {
    await expect(
      authService.signUpWithEmail({
        email: "agent_admin@test.com",
        password: "Password123!",
        fullName: "Malicious Agent",
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow("Public registration as ADMIN is strictly prohibited.");
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Public registration ADMIN → rejected
  // ─────────────────────────────────────────────────────────────
  it("6. public registration ADMIN → rejected with 403 in domain service", async () => {
    await expect(
      authService.registerUser({
        authId: "admin_reg_attacker",
        phone: "+919876543111",
        fullName: "Attacker Admin",
        role: UserRole.ADMIN as any,
      }),
    ).rejects.toThrow("Public registration as ADMIN is strictly prohibited.");
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Existing email signup → conflict (409)
  // ─────────────────────────────────────────────────────────────
  it("7. existing email signup → returns 409 Conflict", async () => {
    // Seed existing email in mock DB query
    vi.spyOn(authService, "signUpWithEmail").mockRejectedValueOnce(
      new (await import("../src/middleware/errorHandler")).AppError(
        "An account with this email address already exists. Please log in or reset your password.",
        409,
        "CONFLICT",
      ),
    );

    const res = await request(app).post("/api/v1/auth/signup").send({
      email: "existing.user@nearvia.test",
      password: "Password123!",
      fullName: "Existing User",
      role: "WORKER",
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Signup cannot reset existing password
  // ─────────────────────────────────────────────────────────────
  it("8. signup cannot reset existing password or overwrite auth account", async () => {
    const mockSupabase = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: {
              users: [
                { id: "existing_auth_id", email: "victim@nearvia.test" },
              ],
            },
          }),
          updateUserById: vi.fn(),
          createUser: vi.fn(),
        },
      },
    };

    const supabaseMod = await import("../src/services/supabase.service");
    vi.spyOn(supabaseMod, "getSupabaseServerClient").mockReturnValue(mockSupabase as any);
    vi.spyOn(supabaseMod, "getSupabaseAdminClient").mockReturnValue(mockSupabase as any);

    await expect(
      authService.signUpWithEmail({
        email: "victim@nearvia.test",
        password: "AttackerNewPassword2026!",
        fullName: "Attacker Takeover",
        role: UserRole.WORKER,
      }),
    ).rejects.toThrow("already exists");

    // CRITICAL: updateUserById must NEVER be called to reset password on registration!
    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Public arbitrary email confirmation → rejected
  // ─────────────────────────────────────────────────────────────
  it("9. public arbitrary email confirmation → rejected (403)", async () => {
    // Arbitrary non-test domain email in dev mode must be rejected
    const res = await request(app).post("/api/v1/auth/confirm-email").send({
      email: "victim@gmail.com",
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("test accounts");
  });

  // ─────────────────────────────────────────────────────────────
  // 10. User cannot change own role
  // ─────────────────────────────────────────────────────────────
  it("10. user cannot change own role via profile update (strict schema rejects)", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", "Bearer mock_token_test_worker_1")
      .send({
        role: "ADMIN", // Malicious role change attempt
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // ─────────────────────────────────────────────────────────────
  // 11. User cannot change another user's role
  // ─────────────────────────────────────────────────────────────
  it("11. non-admin user cannot change another user's role (403 Forbidden)", async () => {
    const res = await request(app)
      .put("/api/v1/admin/users/target_user_id/role")
      .set("Authorization", "Bearer mock_token_test_worker_1") // Authenticated as Worker
      .send({
        role: "ADMIN",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  // ─────────────────────────────────────────────────────────────
  // 12. User cannot modify another user's profile
  // ─────────────────────────────────────────────────────────────
  it("12. user cannot modify another user's profile via body user_id injection", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", "Bearer mock_token_test_worker_1")
      .send({
        id: "victim_user_uuid", // Attempted IDOR injection
        fullName: "Hacked Name",
      });

    // Strict schema rejects unknown property 'id'
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // ─────────────────────────────────────────────────────────────
  // 13. User cannot modify verification state directly
  // ─────────────────────────────────────────────────────────────
  it("13. user cannot modify verification state directly via profile update", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", "Bearer mock_token_test_worker_1")
      .send({
        identity_verified: true,
        mobile_verified: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // ─────────────────────────────────────────────────────────────
  // 14. Deactivated account with valid token → 403
  // ─────────────────────────────────────────────────────────────
  it("14. deactivated account with valid token → 403 Forbidden", async () => {
    // Mock database returning is_active = false for authenticated authId
    const dbMod = await import("../src/db");
    vi.spyOn(dbMod, "query").mockResolvedValueOnce({
      rows: [
        {
          id: "deactivated_user_id",
          auth_id: "auth_deactivated",
          phone: "+919876543219",
          full_name: "Deactivated User",
          email: "deactivated@example.com",
          role: UserRole.WORKER,
          is_active: false, // Suspended / deactivated
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    } as any);

    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer mock_token_auth_deactivated");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("suspended or deactivated");
  });

  // ─────────────────────────────────────────────────────────────
  // 15. Forged user_id in OTP / Identity verification is ignored
  // ─────────────────────────────────────────────────────────────
  it("15. forged user_id in verify-identity is rejected or bound to caller", async () => {
    const res = await request(app)
      .post("/api/v1/auth/verify-identity")
      .set("Authorization", "Bearer mock_token_test_worker_1")
      .send({
        userId: "victim_user_id", // Forged user ID
        reference: "DEMO_REF_VALID",
      });

    // The endpoint strictly binds to req.user.id
    expect(res.status).toBe(200);
    // Verified user returned is the caller, not the forged victim
    expect(res.body.data.authId).toBe("test_worker_1");
  });

  // ─────────────────────────────────────────────────────────────
  // 16. OTP expired → rejected
  // ─────────────────────────────────────────────────────────────
  it("16. OTP expired → rejected with 400", async () => {
    const dbMod = await import("../src/db");
    vi.spyOn(dbMod, "query").mockResolvedValueOnce({
      rows: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          user_id: "00000000-0000-0000-0000-000000000099",
          phone: "+919876543200",
          otp_hash: "mockhash",
          expires_at: new Date(Date.now() - 60000).toISOString(), // Expired 1 min ago
          attempts: 0,
          max_attempts: 3,
          consumed_at: null,
        },
      ],
      rowCount: 1,
    } as any);

    await expect(
      otpService.verifyOtp("00000000-0000-0000-0000-000000000099", "+919876543200", "123456"),
    ).rejects.toThrow("Verification code has expired");
  });

  // ─────────────────────────────────────────────────────────────
  // 17. OTP wrong attempt → rejected
  // ─────────────────────────────────────────────────────────────
  it("17. OTP wrong attempt → rejected with 400", async () => {
    const dbMod = await import("../src/db");
    const validHash = otpService.hashOtp("+919876543200", "654321");

    vi.spyOn(dbMod, "query").mockResolvedValueOnce({
      rows: [
        {
          id: "00000000-0000-0000-0000-000000000002",
          user_id: "00000000-0000-0000-0000-000000000099",
          phone: "+919876543200",
          otp_hash: validHash,
          expires_at: new Date(Date.now() + 600000).toISOString(),
          attempts: 0,
          max_attempts: 3,
          consumed_at: null,
        },
      ],
      rowCount: 1,
    } as any);

    await expect(
      otpService.verifyOtp("00000000-0000-0000-0000-000000000099", "+919876543200", "000000"), // Wrong code
    ).rejects.toThrow("Invalid verification code");
  });

  // ─────────────────────────────────────────────────────────────
  // 18. OTP for another user → rejected
  // ─────────────────────────────────────────────────────────────
  it("18. OTP for another user → rejected (no active challenge for caller)", async () => {
    const dbMod = await import("../src/db");
    // DB returns empty when looking up challenge for caller user_id
    vi.spyOn(dbMod, "query").mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    await expect(
      otpService.verifyOtp("00000000-0000-0000-0000-000000000099", "+919876543200", "123456"),
    ).rejects.toThrow("No active verification request found");
  });

  // ─────────────────────────────────────────────────────────────
  // 19. OTP resend cooldown → enforced (429)
  // ─────────────────────────────────────────────────────────────
  it("19. OTP resend cooldown → enforced with 429", async () => {
    const dbMod = await import("../src/db");
    // Mock user exists
    vi.spyOn(dbMod, "query")
      .mockResolvedValueOnce({
        rows: [{ id: "00000000-0000-0000-0000-000000000099", role: "WORKER", email: "u1@test.com" }],
        rowCount: 1,
      } as any) // user check
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // dup check
      .mockResolvedValueOnce({
        rows: [{ created_at: new Date(Date.now() - 10000).toISOString() }], // Sent 10s ago
        rowCount: 1,
      } as any); // recent send cooldown check

    await expect(
      otpService.sendOtp("00000000-0000-0000-0000-000000000099", "+919876543200"),
    ).rejects.toThrow(/Please wait \d+ seconds before requesting another verification code/);
  });

  // ─────────────────────────────────────────────────────────────
  // 20. Mock OTP in production → rejected
  // ─────────────────────────────────────────────────────────────
  it("20. mock OTP in production → strictly rejected with 500", () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevOtpProvider = process.env.OTP_PROVIDER;
    try {
      process.env.NODE_ENV = "production";
      process.env.OTP_PROVIDER = "mock";

      expect(() => {
        (otpService as any).getProvider();
      }).toThrow("Mock OTP provider is strictly prohibited in production");
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      process.env.OTP_PROVIDER = prevOtpProvider;
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 21. Service-role secret not present in frontend build or source
  // ─────────────────────────────────────────────────────────────
  it("21. service-role secret not present in frontend client code", () => {
    const webSrcDir = path.resolve(__dirname, "../../../apps/web/src");
    const files = fs.readdirSync(webSrcDir, { recursive: true }) as string[];

    for (const file of files) {
      if (typeof file === "string" && (file.endsWith(".ts") || file.endsWith(".tsx"))) {
        const fullPath = path.join(webSrcDir, file);
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 22. Protected endpoint without bearer token → 401
  // ─────────────────────────────────────────────────────────────
  it("22. protected endpoint without bearer token → 401 Unauthorized", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});
