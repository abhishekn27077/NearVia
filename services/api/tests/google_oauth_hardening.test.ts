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
import { env } from "../src/config";
import {
  verifySupabaseToken,
  getSupabaseAdminClient,
  _resetClientsForTest,
} from "../src/services/supabase.service";

describe("NEARVIA Prompt 2: Google OAuth / Supabase Identity Security Hardening Suite", () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Mount Auth Router
    app.use("/api/v1/auth", authRouter);

    // Protected Test Route (requires authentication)
    app.get("/api/v1/protected/test", authenticateUser, (req: Request, res: Response) => {
      res.status(200).json({ success: true, user: req.user });
    });

    // Mock Admin-Only Route for privilege testing
    app.get(
      "/api/v1/admin/privileged-action",
      authenticateUser,
      requireRole(UserRole.ADMIN),
      (req: Request, res: Response) => {
        res.status(200).json({ success: true, message: "Admin authorized" });
      },
    );

    // Seed test users for integration tests
    try {
      await query(`
        DELETE FROM users 
        WHERE email IN ('worker.p2@nearvia.test', 'provider.p2@nearvia.test', 'admin.p2@nearvia.test', 'deactivated.p2@nearvia.test')
           OR auth_id IN ('test_worker_p2', 'test_provider_p2', 'test_admin_p2', 'test_deactivated_p2')
           OR phone IN ('+919876550001', '+919876550002', '+919876550003', '+919876550004');
      `);
      await query(`
        INSERT INTO users (id, auth_id, phone, full_name, email, role, is_active, mobile_verified, identity_verified)
        VALUES 
          ('00000000-0000-0000-0000-000000000091', 'test_worker_p2', '+919876550001', 'Test Worker P2', 'worker.p2@nearvia.test', 'WORKER', TRUE, FALSE, FALSE),
          ('00000000-0000-0000-0000-000000000092', 'test_provider_p2', '+919876550002', 'Test Provider P2', 'provider.p2@nearvia.test', 'PROVIDER', TRUE, TRUE, TRUE),
          ('00000000-0000-0000-0000-000000000093', 'test_admin_p2', '+919876550003', 'Test Admin P2', 'admin.p2@nearvia.test', 'ADMIN', TRUE, TRUE, TRUE),
          ('00000000-0000-0000-0000-000000000094', 'test_deactivated_p2', '+919876550004', 'Test Deactivated P2', 'deactivated.p2@nearvia.test', 'WORKER', FALSE, FALSE, FALSE);
      `);
    } catch (e) {
      console.error("Failed to seed test users:", e);
    }

    // Error Handlers
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Unauthenticated request to Google sync -> rejected (401)
  // ─────────────────────────────────────────────────────────────
  it("TEST 1: unauthenticated request to Google sync -> rejected with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .send({
        fullName: "Attacker User",
        avatarUrl: "https://example.com/avatar.png",
        role: "WORKER",
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toContain("Authentication required");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Authenticated WORKER attempts role=ADMIN -> cannot become ADMIN
  // ─────────────────────────────────────────────────────────────
  it("TEST 2: authenticated WORKER attempts role=ADMIN -> cannot become ADMIN (rejected 400/403)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_test_worker_p2")
      .send({
        role: "ADMIN", // Malicious escalation attempt
      });

    expect(res.status).toBe(400); // Strict Zod publicUserRoleSchema rejects ADMIN
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    // Also verify domain service rejects ADMIN
    await expect(
      authService.syncGoogleUser({
        authId: "test_worker_p2",
        email: "worker.p2@nearvia.test",
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow(/Self-assignment of ADMIN role via OAuth is strictly prohibited/);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Authenticated WORKER sends authId=<another-user-id> -> cannot modify another user
  // ─────────────────────────────────────────────────────────────
  it("TEST 3: authenticated WORKER sends authId=<another-user-id> -> cannot modify another user (403)", async () => {
    // Authenticated caller is test_worker_p2, but supplies victim authId in body
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_test_worker_p2")
      .send({
        authId: "victim_user_99999",
        fullName: "Hijacked Victim Name",
        role: "WORKER",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("Identity mismatch");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Authenticated user sends email=<another-user-email> -> cannot impersonate/change another identity
  // ─────────────────────────────────────────────────────────────
  it("TEST 4: authenticated user sends email=<another-user-email> -> rejected with 403", async () => {
    // Authenticated caller is test_worker_p2 (email: test_worker_p2@example.com in mock token)
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_test_worker_p2")
      .send({
        email: "victim.executive@corporate.com", // Attempt to spoof high-privilege corporate email
        fullName: "Attacker Impersonator",
        role: "WORKER",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("Identity mismatch");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Existing PROVIDER sends role=WORKER during sync -> existing role remains server-authoritative
  // ─────────────────────────────────────────────────────────────
  it("TEST 5: existing PROVIDER sends role=WORKER during sync -> existing role remains server-authoritative (PROVIDER)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_test_provider_p2")
      .send({
        fullName: "Updated Provider Profile Name",
        role: "WORKER", // Attempting to shift role via OAuth sync payload
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // CRITICAL: Database role MUST remain PROVIDER!
    expect(res.body.data.role).toBe(UserRole.PROVIDER);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 6: Google sync cannot modify verification status
  // ─────────────────────────────────────────────────────────────
  it("TEST 6: Google sync cannot modify verification status (schema rejects extra fields with 400)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_test_worker_p2")
      .send({
        fullName: "Attempted Verified Worker",
        mobile_verified: true, // Malicious verification bypass
        identity_verified: true,
      });

    expect(res.status).toBe(400); // Strict schema rejects extra fields
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");

    // Also verify directly in domain service: worker's identity_verified is unchanged
    const worker = await authService.getUserByAuthId("test_worker_p2");
    expect(worker?.identityVerified).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 7: Google sync cannot modify account suspension/deactivation state
  // ─────────────────────────────────────────────────────────────
  it("TEST 7: Google sync cannot bypass deactivation or re-activate account (403)", async () => {
    // Calling sync with deactivated user token
    const res = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_test_deactivated_p2")
      .send({
        fullName: "Attempt Re-activation",
        is_active: true, // Attempting to un-suspend account via payload
      });

    // Both strict schema rejects is_active, and controller/service blocks deactivated users with 403
    expect([400, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);

    // Direct service attempt also rejects
    await expect(
      authService.syncGoogleUser({
        authId: "test_deactivated_p2",
        email: "deactivated.p2@nearvia.test",
        fullName: "Attempt Service Re-activate",
      }),
    ).rejects.toThrow(/suspended or deactivated/);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 8: Malformed/expired token -> rejected (401)
  // ─────────────────────────────────────────────────────────────
  it("TEST 8: malformed or expired token -> rejected with 401", async () => {
    // 1. Malformed token string
    const res1 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer bad_malformed_token_xyz")
      .send({ fullName: "Test" });

    expect(res1.status).toBe(401);
    expect(res1.body.success).toBe(false);
    expect(res1.body.error.code).toBe("UNAUTHORIZED");

    // 2. Missing token format (just Bearer with whitespace)
    const res2 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer   ")
      .send({ fullName: "Test" });

    expect(res2.status).toBe(401);
    expect(res2.body.success).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 9: Logout/stale token -> protected API rejected
  // ─────────────────────────────────────────────────────────────
  it("TEST 9: logout / unauthenticated / stale token -> protected API rejected (401)", async () => {
    const res = await request(app).get("/api/v1/protected/test");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toContain("Authentication required");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 10: ADMIN can perform legitimate admin-only operation
  // ─────────────────────────────────────────────────────────────
  it("TEST 10: ADMIN can perform legitimate admin-only operation (200)", async () => {
    const res = await request(app)
      .get("/api/v1/admin/privileged-action")
      .set("Authorization", "Bearer mock_token_test_admin_p2");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Admin authorized");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 11: Non-admin cannot perform admin-only operation
  // ─────────────────────────────────────────────────────────────
  it("TEST 11: non-admin (WORKER) cannot perform admin-only operation (403)", async () => {
    const res = await request(app)
      .get("/api/v1/admin/privileged-action")
      .set("Authorization", "Bearer mock_token_test_worker_p2");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("Access denied. Requires one of roles: [ADMIN]");
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 12: Service-role key is never exposed to frontend build/source
  // ─────────────────────────────────────────────────────────────
  it("TEST 12: service-role key is never exposed to frontend build or source files", () => {
    const webSrcDir = path.resolve(__dirname, "../../../apps/web/src");
    const scanDir = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".env")) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const files = scanDir(webSrcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(content).not.toContain("service_role");
    }
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 13: Existing account registration cannot reset password through signup
  // ─────────────────────────────────────────────────────────────
  it("TEST 13: existing account registration cannot reset password through signup", async () => {
    const mockSupabase = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: {
              users: [{ id: "existing_auth_id", email: "victim.account@nearvia.test" }],
            },
          }),
          updateUserById: vi.fn(),
          createUser: vi.fn(),
        },
      },
    };

    const supabaseMod = await import("../src/services/supabase.service");
    vi.spyOn(supabaseMod, "getSupabaseAdminClient").mockReturnValue(mockSupabase as any);

    await expect(
      authService.signUpWithEmail({
        email: "victim.account@nearvia.test",
        password: "AttackerNewPassword123!",
        fullName: "Attacker Account Takeover",
        role: UserRole.WORKER,
      }),
    ).rejects.toThrow(/already exists/);

    // Crucial check: password must NEVER be overwritten via registration
    expect(mockSupabase.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 14: Duplicate identity cannot silently create an unauthorized second account
  // ─────────────────────────────────────────────────────────────
  it("TEST 14: duplicate identity with different authId cannot silently hijack account (409 Conflict)", async () => {
    // Worker P2 already has auth_id 'test_worker_p2' with email 'worker.p2@nearvia.test'
    // Attacker logs in via Google with a different authId 'attacker_google_id' claiming the same email
    await expect(
      authService.syncGoogleUser({
        authId: "attacker_google_id",
        email: "worker.p2@nearvia.test",
        fullName: "Attacker Impersonator",
      }),
    ).rejects.toThrow(/already registered to a different identity/);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 15: Case-insensitive Bearer header matching
  // ─────────────────────────────────────────────────────────────
  it("TEST 15: Bearer header with lowercase 'bearer' and whitespace is parsed cleanly", async () => {
    const res = await request(app)
      .get("/api/v1/protected/test")
      .set("Authorization", "bearer   mock_token_test_worker_p2");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe(UserRole.WORKER);
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 16: Privileged admin operations fail safely if service role key is absent
  // ─────────────────────────────────────────────────────────────
  it("TEST 16: getSupabaseAdminClient strictly requires SUPABASE_SERVICE_ROLE_KEY and never falls back to anon key", () => {
    const originalEnvKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      (env as any).SUPABASE_SERVICE_ROLE_KEY = undefined;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      _resetClientsForTest();
      // When SUPABASE_SERVICE_ROLE_KEY is absent, admin client must be null
      const adminClient = getSupabaseAdminClient();
      expect(adminClient).toBeNull();
    } finally {
      (env as any).SUPABASE_SERVICE_ROLE_KEY = originalEnvKey;
      if (originalServiceKey) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
      }
      _resetClientsForTest();
    }
  });

  // ─────────────────────────────────────────────────────────────
  // TEST 17: Mock tokens strictly rejected in production
  // ─────────────────────────────────────────────────────────────
  it("TEST 17: verifySupabaseToken strictly rejects mock tokens when NODE_ENV is production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const result = await verifySupabaseToken("mock_token_forged_identity");
      expect(result).toBeNull();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
