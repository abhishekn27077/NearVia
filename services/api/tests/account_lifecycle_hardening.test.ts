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
import { query } from "../src/db";
import { otpService } from "../src/modules/otp/service";
import * as supabaseService from "../src/services/supabase.service";

describe("NEARVIA Prompt 3: Registration, Password, Account Lifecycle & Identity Integrity Hardening", () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Mount Auth Router
    app.use("/api/v1/auth", authRouter);

    // Protected Route for testing
    app.get("/api/v1/protected/resource", authenticateUser, (req: Request, res: Response) => {
      res.status(200).json({ success: true, user: req.user });
    });

    // Seed test users for Prompt 3 lifecycle tests
    try {
      await query(`
        DELETE FROM users 
        WHERE email IN (
          'victim.p3@nearvia.test', 
          'existing.provider.p3@nearvia.test', 
          'deactivated.p3@nearvia.test', 
          'otp.user.p3@nearvia.test',
          'otp.victim.p3@nearvia.test',
          'new.user.p3@nearvia.test',
          'concurrent.p3@nearvia.test'
        )
        OR auth_id IN (
          'test_victim_p3', 
          'test_provider_p3', 
          'test_deactivated_p3', 
          'test_otp_user_p3',
          'test_otp_victim_p3',
          'test_new_user_p3'
        )
        OR phone IN (
          '+919876560001', 
          '+919876560002', 
          '+919876560003', 
          '+919876560004',
          '+919876560005',
          '+919876560006'
        );
      `);

      await query(`
        INSERT INTO users (id, auth_id, phone, full_name, email, role, is_active, mobile_verified, identity_verified)
        VALUES 
          ('00000000-0000-0000-0000-000000000301', 'test_victim_p3', '+919876560001', 'Victim User P3', 'victim.p3@nearvia.test', 'WORKER', TRUE, TRUE, TRUE),
          ('00000000-0000-0000-0000-000000000302', 'test_provider_p3', '+919876560002', 'Provider User P3', 'existing.provider.p3@nearvia.test', 'PROVIDER', TRUE, TRUE, TRUE),
          ('00000000-0000-0000-0000-000000000303', 'test_deactivated_p3', '+919876560003', 'Deactivated User P3', 'deactivated.p3@nearvia.test', 'WORKER', FALSE, FALSE, FALSE),
          ('00000000-0000-0000-0000-000000000304', 'test_otp_user_p3', '+919876560004', 'OTP User P3', 'otp.user.p3@nearvia.test', 'WORKER', TRUE, FALSE, FALSE),
          ('00000000-0000-0000-0000-000000000305', 'test_otp_victim_p3', '+919876560005', 'OTP Victim P3', 'otp.victim.p3@nearvia.test', 'WORKER', TRUE, TRUE, TRUE);
      `);
    } catch (err) {
      console.error("Failed to seed Prompt 3 test users:", err);
    }

    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Register new email -> account created correctly
  // ─────────────────────────────────────────────────────────────
  it("TEST 1: Register new email -> account created correctly with safe role WORKER", async () => {
    const testEmail = `new.user.p3.${Date.now()}@nearvia.test`;
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: testEmail,
        password: "SafePassword123!",
        fullName: "New Registered User",
        phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
        role: "WORKER",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail);
    expect(res.body.data.role).toBe("WORKER");
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.mobileVerified).toBe(false);
    expect(res.body.data.identityVerified).toBe(false);

    // Verify DB record
    const dbRes = await query<any>("SELECT * FROM users WHERE email = $1", [testEmail]);
    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].role).toBe("WORKER");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Register existing email -> does NOT change existing password
  // ─────────────────────────────────────────────────────────────
  it("TEST 2: Register existing email -> does NOT change existing password (rejected with 409 Conflict)", async () => {
    const mockAdmin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: "test_victim_p3", email: "victim.p3@nearvia.test" }] },
          }),
          updateUserById: vi.fn(),
          createUser: vi.fn(),
        },
      },
    };
    vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValue(mockAdmin as any);

    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "victim.p3@nearvia.test",
        password: "AttackerNewPassword999!",
        fullName: "Attacker Impersonator",
        role: "WORKER",
      });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("CONFLICT");
    expect(mockAdmin.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(mockAdmin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Existing email registration -> does NOT change role
  // ─────────────────────────────────────────────────────────────
  it("TEST 3: Existing email registration -> does NOT change existing user role", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "existing.provider.p3@nearvia.test",
        password: "SomePassword123!",
        fullName: "Changed Name",
        role: "WORKER", // Attempt to downgrade/alter role
      });

    expect(res.status).toBe(409);

    // Verify Provider role remains untouched
    const dbRes = await query<any>("SELECT role FROM users WHERE email = $1", ["existing.provider.p3@nearvia.test"]);
    expect(dbRes.rows[0].role).toBe("PROVIDER");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Existing email registration -> does NOT change verification state
  // ─────────────────────────────────────────────────────────────
  it("TEST 4: Existing email registration -> does NOT change verification state", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "victim.p3@nearvia.test",
        password: "SomePassword123!",
        fullName: "Victim User",
        role: "WORKER",
      });

    expect(res.status).toBe(409);

    const dbRes = await query<any>("SELECT mobile_verified, identity_verified FROM users WHERE email = $1", ["victim.p3@nearvia.test"]);
    expect(dbRes.rows[0].mobile_verified).toBe(true);
    expect(dbRes.rows[0].identity_verified).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Existing email registration -> does NOT reactivate account
  // ─────────────────────────────────────────────────────────────
  it("TEST 5: Existing email registration -> does NOT reactivate account", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "deactivated.p3@nearvia.test",
        password: "SomePassword123!",
        fullName: "Deactivated User",
        role: "WORKER",
      });

    expect(res.status).toBe(409);

    const dbRes = await query<any>("SELECT is_active FROM users WHERE email = $1", ["deactivated.p3@nearvia.test"]);
    expect(dbRes.rows[0].is_active).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Client attempts role=ADMIN during registration -> rejected
  // ─────────────────────────────────────────────────────────────
  it("TEST 6: Client attempts role=ADMIN during registration -> rejected with 400 Validation Error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "admin.hack@nearvia.test",
        password: "Password123!",
        fullName: "Wannabe Admin",
        role: "ADMIN",
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");

    // Verify no admin was created in DB
    const dbRes = await query<any>("SELECT * FROM users WHERE email = 'admin.hack@nearvia.test'");
    expect(dbRes.rows.length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Invalid role -> rejected
  // ─────────────────────────────────────────────────────────────
  it("TEST 7: Invalid role -> rejected with 400 Validation Error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "invalid.role@nearvia.test",
        password: "Password123!",
        fullName: "Invalid Role User",
        role: "SUPERUSER",
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 8: Malformed email -> rejected
  // ─────────────────────────────────────────────────────────────
  it("TEST 8: Malformed email -> rejected with 400 Validation Error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "not-a-valid-email",
        password: "Password123!",
        fullName: "Invalid Email User",
        role: "WORKER",
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 9: Weak/invalid password -> rejected according to actual policy
  // ─────────────────────────────────────────────────────────────
  it("TEST 9: Weak/invalid password (< 6 chars) -> rejected with 400 Validation Error", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "weak.pass@nearvia.test",
        password: "123", // under 6 characters
        fullName: "Weak Password User",
        role: "WORKER",
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 10: Unauthenticated protected operation -> rejected (401)
  // ─────────────────────────────────────────────────────────────
  it("TEST 10: Unauthenticated protected operation -> rejected with 401", async () => {
    const res = await request(app).get("/api/v1/protected/resource");
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe("UNAUTHORIZED");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 11: User cannot update another user's profile
  // ─────────────────────────────────────────────────────────────
  it("TEST 11: User cannot update another user's profile (uses req.user context, rejects target ID injection)", async () => {
    // Authenticated as test_victim_p3
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", "Bearer mock_token_test_victim_p3")
      .send({
        fullName: "Victim Renamed",
        // Attacker attempting to target another user ID
        userId: "00000000-0000-0000-0000-000000000302",
      });

    // Schema is strict, rejects unexpected userId field with 400
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");

    // Provider user remains untouched
    const providerDb = await query<any>("SELECT full_name FROM users WHERE id = '00000000-0000-0000-0000-000000000302'");
    expect(providerDb.rows[0].full_name).toBe("Provider User P3");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 12: User cannot modify own role through profile endpoint
  // ─────────────────────────────────────────────────────────────
  it("TEST 12: User cannot modify own role through profile endpoint (rejected with 400)", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", "Bearer mock_token_test_victim_p3")
      .send({
        role: "ADMIN",
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");

    // Verify victim role remains WORKER
    const dbRes = await query<any>("SELECT role FROM users WHERE auth_id = 'test_victim_p3'");
    expect(dbRes.rows[0].role).toBe("WORKER");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 13: User cannot modify own verification status
  // ─────────────────────────────────────────────────────────────
  it("TEST 13: User cannot modify own verification status via profile endpoint", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", "Bearer mock_token_test_otp_user_p3")
      .send({
        mobileVerified: true,
        identityVerified: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");

    const dbRes = await query<any>("SELECT mobile_verified, identity_verified FROM users WHERE auth_id = 'test_otp_user_p3'");
    expect(dbRes.rows[0].mobile_verified).toBe(false);
    expect(dbRes.rows[0].identity_verified).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 14: User cannot modify own account status
  // ─────────────────────────────────────────────────────────────
  it("TEST 14: User cannot modify own account status via profile endpoint", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", "Bearer mock_token_test_victim_p3")
      .send({
        isActive: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("VALIDATION_ERROR");

    const dbRes = await query<any>("SELECT is_active FROM users WHERE auth_id = 'test_victim_p3'");
    expect(dbRes.rows[0].is_active).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 15: Invalid/expired token -> rejected
  // ─────────────────────────────────────────────────────────────
  it("TEST 15: Invalid/expired token -> rejected with 401 Unauthorized", async () => {
    vi.spyOn(supabaseService, "verifySupabaseToken").mockResolvedValue(null);

    const res = await request(app)
      .get("/api/v1/protected/resource")
      .set("Authorization", "Bearer expired.or.garbage.jwt");

    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe("UNAUTHORIZED");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 16: Deactivated account cannot access protected resources
  // ─────────────────────────────────────────────────────────────
  it("TEST 16: Deactivated account cannot access protected resources (403 Forbidden)", async () => {
    const res = await request(app)
      .get("/api/v1/protected/resource")
      .set("Authorization", "Bearer mock_token_test_deactivated_p3");

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("FORBIDDEN");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 17: Suspended account cannot bypass restriction through a new session/login
  // ─────────────────────────────────────────────────────────────
  it("TEST 17: Suspended account cannot bypass restriction through login (403 Forbidden)", async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: "mock_session_token" },
            user: { id: "test_deactivated_p3", email: "deactivated.p3@nearvia.test" },
          },
          error: null,
        }),
      },
    };
    vi.spyOn(supabaseService, "getSupabaseServerClient").mockReturnValue(mockSupabase as any);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "deactivated.p3@nearvia.test",
        password: "ValidPassword123!",
      });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("FORBIDDEN");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 18: OTP cannot be used for another user
  // ─────────────────────────────────────────────────────────────
  it("TEST 18: OTP cannot be used for another user's challenge (rejected with 400)", async () => {
    // Send OTP for test_otp_user_p3
    await otpService.sendOtp(
      "00000000-0000-0000-0000-000000000304",
      "+919876560004",
    );

    // Victim attempts to verify with the same OTP on victim account
    await expect(
      otpService.verifyOtp(
        "00000000-0000-0000-0000-000000000301", // Victim ID
        "+919876560004",
        "123456",
      ),
    ).rejects.toThrow();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 19: Expired OTP rejected
  // ─────────────────────────────────────────────────────────────
  it("TEST 19: Expired OTP rejected with validation error", async () => {
    // Insert pre-expired challenge
    await query(`
      INSERT INTO otp_challenges (user_id, phone, otp_hash, provider, max_attempts, expires_at)
      VALUES ('00000000-0000-0000-0000-000000000304', '+919876560004', 'expired_hash', 'mock', 3, NOW() - INTERVAL '5 minutes')
    `);

    await expect(
      otpService.verifyOtp(
        "00000000-0000-0000-0000-000000000304",
        "+919876560004",
        "123456",
      ),
    ).rejects.toThrow(/expired/i);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 20: OTP attempt limit enforced
  // ─────────────────────────────────────────────────────────────
  it("TEST 20: OTP attempt limit enforced -> max attempts exceeded returns 429", async () => {
    // Insert challenge with 3 attempts used
    await query(`
      INSERT INTO otp_challenges (user_id, phone, otp_hash, provider, attempts, max_attempts, expires_at)
      VALUES ('00000000-0000-0000-0000-000000000304', '+919876560004', 'dummy_hash', 'mock', 3, 3, NOW() + INTERVAL '5 minutes')
    `);

    await expect(
      otpService.verifyOtp(
        "00000000-0000-0000-0000-000000000304",
        "+919876560004",
        "123456",
      ),
    ).rejects.toThrow(/maximum verification attempts exceeded/i);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 21: Arbitrary email confirmation cannot confirm another user
  // ─────────────────────────────────────────────────────────────
  it("TEST 21: Arbitrary email confirmation cannot confirm another user (403 Forbidden)", async () => {
    // Authenticated as test_victim_p3, attempting to confirm another user's email
    const res = await request(app)
      .post("/api/v1/auth/confirm-email")
      .set("Authorization", "Bearer mock_token_test_victim_p3")
      .send({
        email: "other.user.p3@nearvia.test",
      });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("FORBIDDEN");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 22: Public confirmation endpoint is disabled/restricted in production mode
  // ─────────────────────────────────────────────────────────────
  it("TEST 22: Public confirmation endpoint is disabled in production mode (403 Forbidden)", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const res = await request(app)
        .post("/api/v1/auth/confirm-email")
        .send({
          email: "victim.p3@nearvia.test",
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe("FORBIDDEN");
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 23: Concurrent duplicate registration cannot create duplicate application users
  // ─────────────────────────────────────────────────────────────
  it("TEST 23: Concurrent duplicate registration cannot create duplicate application users", async () => {
    const concurrentEmail = `concurrent.p3.${Date.now()}@nearvia.test`;
    const mockSupabase = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }),
          createUser: vi.fn().mockImplementation(async ({ email }) => ({
            data: { user: { id: `auth_concurrent_${Date.now()}_${Math.random()}`, email } },
            error: null,
          })),
        },
      },
    };
    vi.spyOn(supabaseService, "getSupabaseAdminClient").mockReturnValue(mockSupabase as any);

    // Fire two simultaneous registration requests with same email but casing variations
    const [resA, resB] = await Promise.all([
      request(app).post("/api/v1/auth/signup").send({
        email: concurrentEmail,
        password: "Password123!",
        fullName: "Concurrent User A",
        phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
        role: "WORKER",
      }),
      request(app).post("/api/v1/auth/signup").send({
        email: concurrentEmail.toUpperCase(),
        password: "Password123!",
        fullName: "Concurrent User B",
        phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
        role: "WORKER",
      }),
    ]);

    // Exactly one should succeed, the other must fail with 409 Conflict
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Verify exactly one row in PostgreSQL
    const dbRes = await query<any>("SELECT * FROM users WHERE LOWER(email) = $1", [concurrentEmail]);
    expect(dbRes.rows.length).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 24: Logout/stale session cannot access protected API
  // ─────────────────────────────────────────────────────────────
  it("TEST 24: Logout acknowledges session termination and invalid tokens are rejected", async () => {
    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", "Bearer mock_token_test_victim_p3");

    expect(logoutRes.status).toBe(200);

    // Stale/revoked token rejected
    vi.spyOn(supabaseService, "verifySupabaseToken").mockResolvedValue(null);
    const protectedRes = await request(app)
      .get("/api/v1/protected/resource")
      .set("Authorization", "Bearer revoked_token");

    expect(protectedRes.status).toBe(401);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 25: Frontend does not expose service-role credentials
  // ─────────────────────────────────────────────────────────────
  it("TEST 25: Frontend does not expose service-role credentials in code or environment", () => {
    const webSrcDir = path.resolve(__dirname, "../../../apps/web/src");
    const webFiles = fs.readdirSync(webSrcDir, { recursive: true }) as string[];

    for (const file of webFiles) {
      const fullPath = path.join(webSrcDir, file);
      if (fs.statSync(fullPath).isFile() && /\.(ts|tsx|js|jsx|json)$/.test(file)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
        expect(content).not.toContain("sb_secret_");
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // CRITICAL REGRESSION TEST (Section 20 of Prompt 3)
  // ─────────────────────────────────────────────────────────────
  it("CRITICAL REGRESSION: Attacker cannot hijack existing victim account or reset password via registration", async () => {
    // 1. Existing victim account exists: victim.p3@nearvia.test
    const victimBefore = await query<any>("SELECT * FROM users WHERE email = 'victim.p3@nearvia.test'");
    expect(victimBefore.rows.length).toBe(1);
    const victimId = victimBefore.rows[0].id;
    const victimRole = victimBefore.rows[0].role;

    // 2. Attacker sends registration request using victim's email and attacker's password
    const attackRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "victim.p3@nearvia.test",
        password: "AttackerPwnedPassword2026!",
        fullName: "Attacker Hijacker",
        role: "WORKER",
      });

    // 3. System MUST reject with 409 Conflict
    expect(attackRes.status).toBe(409);
    expect(attackRes.body.error?.code).toBe("CONFLICT");

    // 4. Victim record MUST NOT be modified
    const victimAfter = await query<any>("SELECT * FROM users WHERE id = $1", [victimId]);
    expect(victimAfter.rows[0].email).toBe("victim.p3@nearvia.test");
    expect(victimAfter.rows[0].full_name).toBe("Victim User P3");
    expect(victimAfter.rows[0].role).toBe(victimRole);
    expect(victimAfter.rows[0].is_active).toBe(true);

    // 5. Attacker tries email=victim@example.com, role=ADMIN
    const adminAttackRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "victim.p3@nearvia.test",
        password: "AttackerPwnedPassword2026!",
        fullName: "Attacker Admin",
        role: "ADMIN",
      });

    expect(adminAttackRes.status).toBe(400); // Zod validation fails on role
    expect(adminAttackRes.body.error?.code).toBe("VALIDATION_ERROR");

    // Verify victim role still unchanged
    const victimFinal = await query<any>("SELECT role FROM users WHERE id = $1", [victimId]);
    expect(victimFinal.rows[0].role).toBe(victimRole);
  });
});
