/**
 * NEARVIA Account Lifecycle, Password, Registration & Identity Hardening
 * Live HTTP & Database Forensic Verification Script (Prompt 3)
 */

import request from "supertest";
import { createApp } from "../app";
import { query } from "../db";

const app = createApp();

async function runLiveVerification() {
  console.log("======================================================================");
  console.log("🛡️  NEARVIA ACCOUNT LIFECYCLE & IDENTITY INTEGRITY LIVE VERIFICATION");
  console.log("======================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(` ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${testName} - ${detail || ""}`);
      failed++;
    }
  }

  const testEmail = `http.live.p3.${Date.now()}@nearvia.test`;
  const victimEmail = "http.victim.p3@nearvia.test";
  const deactivatedEmail = "http.deactivated.p3@nearvia.test";
  const victimAuthId = "http_victim_auth_p3";
  const deactivatedAuthId = "http_deactivated_auth_p3";

  try {
    // 0. Clean & Seed setup test identities in PostgreSQL
    await query(`
      DELETE FROM users 
      WHERE email IN ('${victimEmail}', '${deactivatedEmail}') 
         OR email LIKE 'http.live.p3.%@nearvia.test'
         OR auth_id IN ('${victimAuthId}', '${deactivatedAuthId}')
         OR phone IN ('+919876599301', '+919876599302', '+919876599303');
    `);

    await query(`
      INSERT INTO users (id, auth_id, phone, full_name, email, role, is_active, mobile_verified, identity_verified)
      VALUES 
        ('00000000-0000-0000-0000-000000000391', '${victimAuthId}', '+919876599301', 'Live Victim P3', '${victimEmail}', 'PROVIDER', TRUE, TRUE, TRUE),
        ('00000000-0000-0000-0000-000000000392', '${deactivatedAuthId}', '+919876599302', 'Live Deactivated P3', '${deactivatedEmail}', 'WORKER', FALSE, FALSE, FALSE);
    `);

    console.log("\n[1. Registration & Password Security HTTP Verification]");

    // 1. Register valid new user
    const res1 = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: testEmail,
        password: "LiveTestPassword2026!",
        fullName: "Live Test User",
        phone: "+919876599303",
        role: "WORKER",
      });
    assert(
      res1.status === 201 && res1.body.success === true && res1.body.data.role === "WORKER",
      "Valid registration creates application user (HTTP 201 Created)",
      `Got status ${res1.status}, body: ${JSON.stringify(res1.body)}`,
    );

    // 2. Duplicate registration attempt with victim's email
    const res2 = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: victimEmail,
        password: "AttackerNewPassword123!",
        fullName: "Attacker Impersonator",
        role: "WORKER",
      });
    assert(
      res2.status === 409 && res2.body.error?.code === "CONFLICT",
      "Duplicate registration rejected without changing existing account (HTTP 409 Conflict)",
      `Got status ${res2.status}`,
    );

    // 3. Client attempts role=ADMIN in registration
    const res3 = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: `admin.attempt.${Date.now()}@nearvia.test`,
        password: "LiveTestPassword2026!",
        fullName: "Wannabe Admin",
        role: "ADMIN",
      });
    assert(
      res3.status === 400 && res3.body.error?.code === "VALIDATION_ERROR",
      "Client role=ADMIN registration strictly rejected (HTTP 400 Validation Error)",
      `Got status ${res3.status}`,
    );

    // 4. Malformed email in registration
    const res4 = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: "not-an-email",
        password: "LiveTestPassword2026!",
        fullName: "Invalid Email User",
        role: "WORKER",
      });
    assert(
      res4.status === 400 && res4.body.error?.code === "VALIDATION_ERROR",
      "Malformed email registration rejected (HTTP 400 Validation Error)",
      `Got status ${res4.status}`,
    );

    // 5. Short/weak password in registration
    const res5 = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: `short.pass.${Date.now()}@nearvia.test`,
        password: "123",
        fullName: "Short Password User",
        role: "WORKER",
      });
    assert(
      res5.status === 400 && res5.body.error?.code === "VALIDATION_ERROR",
      "Weak password (<6 chars) rejected (HTTP 400 Validation Error)",
      `Got status ${res5.status}`,
    );

    console.log("\n[2. Authentication & Session Verification]");

    // 6. Unauthenticated request to /auth/me
    const res6 = await request(app).get("/api/v1/auth/me");
    assert(
      res6.status === 401 && res6.body.error?.code === "UNAUTHORIZED",
      "Unauthenticated request to /auth/me rejected with 401 Unauthorized",
      `Got status ${res6.status}`,
    );

    // 7. Invalid token to /auth/me
    const res7 = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid.expired.token");
    assert(
      res7.status === 401 && res7.body.error?.code === "UNAUTHORIZED",
      "Invalid Bearer token rejected with 401 Unauthorized",
      `Got status ${res7.status}`,
    );

    // 8. Deactivated account access attempt on protected route
    const res8 = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer mock_token_${deactivatedAuthId}`);
    assert(
      res8.status === 403 && res8.body.error?.code === "FORBIDDEN",
      "Deactivated account access rejected with 403 Forbidden",
      `Got status ${res8.status}`,
    );

    console.log("\n[3. Privilege Escalation & Profile Tampering Verification]");

    // 9. Attacker attempts to change role via profile endpoint
    const res9 = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", `Bearer mock_token_${victimAuthId}`)
      .send({
        role: "ADMIN",
      });
    assert(
      res9.status === 400 && res9.body.error?.code === "VALIDATION_ERROR",
      "Attempt to escalate role via PUT /auth/profile rejected (HTTP 400)",
      `Got status ${res9.status}`,
    );

    // 10. Attacker attempts to change is_active status via profile endpoint
    const res10 = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", `Bearer mock_token_${victimAuthId}`)
      .send({
        isActive: false,
      });
    assert(
      res10.status === 400 && res10.body.error?.code === "VALIDATION_ERROR",
      "Attempt to tamper with isActive via PUT /auth/profile rejected (HTTP 400)",
      `Got status ${res10.status}`,
    );

    // 11. Attacker attempts to forge verification status via profile endpoint
    const res11 = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", `Bearer mock_token_${victimAuthId}`)
      .send({
        mobileVerified: true,
        identityVerified: true,
      });
    assert(
      res11.status === 400 && res11.body.error?.code === "VALIDATION_ERROR",
      "Attempt to tamper with verification flags via PUT /auth/profile rejected (HTTP 400)",
      `Got status ${res11.status}`,
    );

    console.log("\n[4. Email Confirmation Boundary Verification]");

    // 12. Authenticated user attempting to confirm an arbitrary other email
    const res12 = await request(app)
      .post("/api/v1/auth/confirm-email")
      .set("Authorization", `Bearer mock_token_${victimAuthId}`)
      .send({
        email: "unrelated.target@nearvia.test",
      });
    assert(
      res12.status === 403 && res12.body.error?.code === "FORBIDDEN",
      "User cannot confirm arbitrary other email addresses (HTTP 403 Forbidden)",
      `Got status ${res12.status}`,
    );

    console.log("\n[5. Database Forensic Verification]");

    // DB 1: Exactly 1 user record created for new registration
    const dbNewUser = await query<any>(
      "SELECT * FROM users WHERE email = $1",
      [testEmail],
    );
    assert(
      dbNewUser.rows.length === 1 && dbNewUser.rows[0].role === "WORKER",
      "Database: Exactly 1 user created with role WORKER",
      `Count: ${dbNewUser.rows.length}`,
    );

    // DB 2: Worker profile created idempotently for new user
    const dbWorkerProfile = await query<any>(
      "SELECT * FROM worker_profiles WHERE user_id = $1",
      [dbNewUser.rows[0]?.id],
    );
    assert(
      dbWorkerProfile.rows.length === 1,
      "Database: Exactly 1 worker_profile created for new user",
      `Profile count: ${dbWorkerProfile.rows.length}`,
    );

    // DB 3: Victim account completely unchanged by duplicate signup attempt
    const dbVictim = await query<any>(
      "SELECT * FROM users WHERE email = $1",
      [victimEmail],
    );
    assert(
      dbVictim.rows[0]?.role === "PROVIDER" &&
      dbVictim.rows[0]?.mobile_verified === true &&
      dbVictim.rows[0]?.identity_verified === true &&
      dbVictim.rows[0]?.full_name === "Live Victim P3",
      "Database: Victim account role, name, and verification untouched by duplicate signup",
      `Role: ${dbVictim.rows[0]?.role}, Name: ${dbVictim.rows[0]?.full_name}`,
    );

    // DB 4: Deactivated account remains deactivated
    const dbDeactivated = await query<any>(
      "SELECT is_active FROM users WHERE email = $1",
      [deactivatedEmail],
    );
    assert(
      dbDeactivated.rows[0]?.is_active === false,
      "Database: Deactivated account remains is_active = FALSE",
      `is_active: ${dbDeactivated.rows[0]?.is_active}`,
    );

    // DB 5: 0 duplicate lower(email) in entire users table
    const dbDupEmails = await query<any>(
      "SELECT lower(email), count(*) FROM users WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1",
    );
    assert(
      dbDupEmails.rows.length === 0,
      "Database: 0 duplicate lowercase email addresses across entire users table",
      `Duplicates: ${dbDupEmails.rows.length}`,
    );

    // DB 6: 0 unauthorized admin accounts
    const dbAdmins = await query<any>(
      "SELECT email FROM users WHERE role = 'ADMIN' AND email NOT IN ('admin@nearvia.in', 'admin@nearvia.test', 'admin.p2@nearvia.test')",
    );
    assert(
      dbAdmins.rows.length === 0,
      "Database: 0 unauthorized ADMIN accounts present",
      `Admins found: ${dbAdmins.rows.length}`,
    );

    // Cleanup live verification test rows
    await query(`
      DELETE FROM users 
      WHERE email IN ('${victimEmail}', '${deactivatedEmail}', '${testEmail}')
         OR email LIKE 'http.live.p3.%@nearvia.test'
         OR auth_id IN ('${victimAuthId}', '${deactivatedAuthId}')
         OR phone IN ('+919876599301', '+919876599302', '+919876599303');
    `);

    console.log("\n======================================================================");
    console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("======================================================================");

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error("Live verification error:", error);
    process.exit(1);
  }
}

runLiveVerification();
