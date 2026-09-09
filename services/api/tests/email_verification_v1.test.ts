import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole } from "@nearvia/types";
import { authRouter } from "../src/modules/auth";
import { errorHandler, notFoundHandler, authenticateUser, requireVerifiedEmail } from "../src/middleware";
import { query } from "../src/db";
import { authService } from "../src/modules/auth/service";
import * as supabaseService from "../src/services/supabase.service";

describe("NEARVIA V1: Supabase Email Verification & Free-First Security Suite", () => {
  let app: Express;

  const TEST_WORKER_AUTH_ID = "11111111-2222-3333-4444-555555555551";
  const TEST_WORKER_EMAIL = "worker.v1.auth@nearvia.test";
  const TEST_WORKER_TOKEN = `mock_token_${TEST_WORKER_AUTH_ID}`;

  const UNVERIFIED_AUTH_ID = "11111111-2222-3333-4444-555555555552";
  const UNVERIFIED_EMAIL = "unverified.user@example.com";
  const UNVERIFIED_TOKEN = `mock_token_${UNVERIFIED_AUTH_ID}`;

  beforeAll(async () => {
    // Clean up test users
    await query("DELETE FROM users WHERE id IN ($1::uuid, $2::uuid) OR email IN ($3, $4, $5, $6) OR phone IN ('+919999000101', '+919999000102')", [
      TEST_WORKER_AUTH_ID,
      UNVERIFIED_AUTH_ID,
      TEST_WORKER_EMAIL,
      UNVERIFIED_EMAIL,
      "new.worker.v1@nearvia.test",
      "attack.victim@example.com",
    ]);

    // Insert active test worker
    await query(
      `INSERT INTO users (
        id, auth_id, email, phone, full_name, role, is_active, 
        email_verified, email_verified_at, mobile_verified, profile_completed
      ) VALUES (
        $1::uuid, $2, $3, '+919999000101', 'V1 Test Worker', 'WORKER', TRUE,
        TRUE, NOW(), FALSE, TRUE
      )`,
      [TEST_WORKER_AUTH_ID, TEST_WORKER_AUTH_ID, TEST_WORKER_EMAIL],
    );

    // Insert unverified user (email_verified = false)
    await query(
      `INSERT INTO users (
        id, auth_id, email, phone, full_name, role, is_active, 
        email_verified, email_verified_at, mobile_verified, profile_completed
      ) VALUES (
        $1::uuid, $2, $3, '+919999000102', 'Unverified User', 'WORKER', TRUE,
        FALSE, NULL, FALSE, FALSE
      )`,
      [UNVERIFIED_AUTH_ID, UNVERIFIED_AUTH_ID, UNVERIFIED_EMAIL],
    );

    app = express();
    app.use(express.json());
    app.use("/api/v1/auth", authRouter);

    // Protected resource requiring email verification
    app.get("/api/v1/protected/verified-only", authenticateUser, requireVerifiedEmail, (req, res) => {
      res.status(200).json({ success: true, message: "Welcome verified user", user: req.user });
    });

    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email IN ($1, $2, $3, $4)", [
      TEST_WORKER_EMAIL,
      UNVERIFIED_EMAIL,
      "new.worker.v1@nearvia.test",
      "attack.victim@example.com",
    ]);
  });

  // TEST 1: New registration creates an account correctly
  it("TEST 1: New registration creates an account correctly without requiring phone or SMS OTP", async () => {
    const testEmail1 = `new.worker.${Date.now()}@nearvia.test`;
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: testEmail1,
        password: "Password123!",
        fullName: "New Free Worker",
        role: "WORKER",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail1);
    expect(res.body.data.role).toBe(UserRole.WORKER);
    expect(res.body.data.phone).toBeUndefined(); // Phone was not provided and is purely optional

    await query("DELETE FROM users WHERE email = $1", [testEmail1]);
  });

  // TEST 2: Existing email cannot reset existing password through registration
  it("TEST 2: Existing email cannot reset existing password through registration (409 Conflict)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: TEST_WORKER_EMAIL,
        password: "NewAttackerPassword999!",
        fullName: "Attacker Impersonator",
        role: "WORKER",
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("already exists");
  });

  // TEST 3: Existing email cannot change existing role through registration
  it("TEST 3: Existing email cannot change existing role through registration (409 Conflict)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: TEST_WORKER_EMAIL,
        password: "Password123!",
        fullName: "Role Changer",
        role: "PROVIDER",
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);

    // Verify in database that original role is preserved
    const dbUser = await authService.getUserByAuthId(TEST_WORKER_AUTH_ID);
    expect(dbUser?.role).toBe(UserRole.WORKER);
  });

  // TEST 4: ADMIN cannot be selected during public registration
  it("TEST 4: ADMIN cannot be selected during public registration (400 / 403)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "admin.wannabe@nearvia.test",
        password: "Password123!",
        fullName: "Fake Admin",
        role: "ADMIN",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // TEST 5: Email verification state cannot be changed through arbitrary profile update
  it("TEST 5: Email verification state cannot be changed through profile update (400 strict schema rejection)", async () => {
    const res = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", `Bearer ${TEST_WORKER_TOKEN}`)
      .send({
        fullName: "Legit Name",
        email_verified: false, // Attempt to tamper with email verification
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // TEST 6: Client cannot send email_verified=true to bypass verification
  it("TEST 6: Client cannot send email_verified=true in registration/signup body to bypass verification", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "untrusted.bypass@example.com",
        password: "Password123!",
        fullName: "Bypass Attacker",
        role: "WORKER",
        email_verified: true, // Attempt to inject email_verified
      });

    expect(res.status).toBe(400); // Strict schema rejects unknown property
    expect(res.body.success).toBe(false);
  });

  // TEST 7: Client cannot verify another user's email
  it("TEST 7: Client cannot verify another user's email (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/confirm-email")
      .set("Authorization", `Bearer ${TEST_WORKER_TOKEN}`)
      .send({
        email: "victim.target@nearvia.test",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("Cannot confirm email for another user account");
  });

  // TEST 8: Public arbitrary email-confirmation endpoint cannot be abused without token congruence
  it("TEST 8: Public arbitrary email-confirmation endpoint cannot confirm arbitrary non-test accounts", async () => {
    const res = await request(app)
      .post("/api/v1/auth/confirm-email")
      .send({
        email: "victim@realcompany.com",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("only permitted for test accounts");
  });

  // TEST 9: Production environment cannot use arbitrary public confirmation bypass
  it("TEST 9: Production environment cannot use arbitrary public confirmation bypass (403 Forbidden)", async () => {
    const oldEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const res = await request(app)
        .post("/api/v1/auth/confirm-email")
        .send({
          email: "test.worker@nearvia.test",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("disabled in production");
    } finally {
      process.env.NODE_ENV = oldEnv;
    }
  });

  // TEST 10: Valid Supabase-authenticated user is recognized correctly
  it("TEST 10: Valid Supabase-authenticated user is recognized correctly", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${TEST_WORKER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.authId).toBe(TEST_WORKER_AUTH_ID);
    expect(res.body.data.email).toBe(TEST_WORKER_EMAIL);
    expect(res.body.data.emailVerified).toBe(true);
  });

  // TEST 11: Invalid/expired token is rejected
  it("TEST 11: Invalid or malformed authentication token is rejected with HTTP 401", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid_expired_or_forged_token");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // TEST 12: Logout invalidates application authorization appropriately
  it("TEST 12: POST /api/v1/auth/logout succeeds and informs client to clear credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${TEST_WORKER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain("terminated");
  });

  // TEST 13: Mobile field does not automatically become verified (phone entered != phone verified)
  it("TEST 13: Mobile field entered during registration does NOT automatically become verified", async () => {
    const testEmail = `phone.unverified.${Date.now()}@nearvia.test`;
    await query("DELETE FROM users WHERE email = $1 OR phone = '+919999000199'", [testEmail]);

    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: testEmail,
        password: "Password123!",
        fullName: "Phone Unverified Worker",
        phone: "+919999000199",
        role: "WORKER",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.phone).toBe("+919999000199");
    expect(res.body.data.mobileVerified).toBe(false); // PHONE ENTERED != PHONE VERIFIED

    await query("DELETE FROM users WHERE email = $1 OR phone = '+919999000199'", [testEmail]);
  });

  // TEST 14: SMS OTP is not required anywhere in normal V1 registration/login flow
  it("TEST 14: Normal V1 registration and login flow complete without any SMS OTP step", async () => {
    const flowEmail = `flow.test.${Date.now()}@nearvia.test`;
    await query("DELETE FROM users WHERE email = $1", [flowEmail]);

    // 1. Sign up
    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: flowEmail,
        password: "SecurePassword123!",
        fullName: "No OTP Worker",
        role: "WORKER",
      });
    expect(signupRes.status).toBe(201);

    // 2. Login directly
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: flowEmail,
        password: "SecurePassword123!",
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.token).toBeDefined();
    expect(loginRes.body.data.user.role).toBe(UserRole.WORKER);

    await query("DELETE FROM users WHERE email = $1", [flowEmail]);
  });

  // TEST 15: No SMS provider credentials are required for V1 (server operates without MSG91/Twilio)
  it("TEST 15: Application routes and services operate without any MSG91 or SMS gateway credentials", () => {
    // Verify that MSG91_AUTH_KEY is not required to be set
    expect(process.env.MSG91_AUTH_KEY || "").toBe("");
    expect(process.env.TWILIO_AUTH_TOKEN || "").toBe("");
    // System is free-first
  });

  // TEST 16: Frontend does not expose Supabase service-role credentials
  it("TEST 16: Neither frontend environment nor public config expose Supabase service-role key", async () => {
    const fs = await import("fs");
    const path = await import("path");

    // Read web .env or .env.example
    const webEnvPath = path.resolve(__dirname, "../../../apps/web/.env");
    if (fs.existsSync(webEnvPath)) {
      const webEnv = fs.readFileSync(webEnvPath, "utf-8");
      expect(webEnv).not.toContain("SERVICE_ROLE_KEY");
      expect(webEnv).not.toContain("SUPABASE_SERVICE_KEY");
    }

    const rootEnvExample = path.resolve(__dirname, "../../../.env.example");
    const envExample = fs.readFileSync(rootEnvExample, "utf-8");
    // Ensure service key is documented only under backend
    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(envExample).not.toMatch(/VITE_.*SERVICE_ROLE/i);
  });
});
