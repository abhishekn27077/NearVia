/**
 * NEARVIA Google OAuth & Supabase Identity Security Verification
 * Live HTTP & Database Forensic Verification Script
 */

import request from "supertest";
import { createApp } from "../app";
import { query } from "../db";
import { UserRole } from "@nearvia/types";

const app = createApp();

async function runLiveVerification() {
  console.log("====================================================");
  console.log("🛡️  NEARVIA GOOGLE OAUTH & IDENTITY LIVE VERIFICATION");
  console.log("====================================================");

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

  try {
    // 0. Setup clean test identities in Database
    await query(`
      DELETE FROM users 
      WHERE email IN ('http.worker@nearvia.test', 'http.provider@nearvia.test', 'http.deactivated@nearvia.test')
         OR auth_id IN ('http_auth_worker_1', 'http_auth_provider_1', 'http_auth_deactivated_1')
         OR phone IN ('+919876599001', '+919876599002', '+919876599003');
    `);

    await query(`
      INSERT INTO users (id, auth_id, phone, full_name, email, role, is_active, mobile_verified, identity_verified)
      VALUES 
        ('00000000-0000-0000-0000-000000000081', 'http_auth_worker_1', '+919876599001', 'HTTP Worker User', 'http.worker@nearvia.test', 'WORKER', TRUE, FALSE, FALSE),
        ('00000000-0000-0000-0000-000000000082', 'http_auth_provider_1', '+919876599002', 'HTTP Provider User', 'http.provider@nearvia.test', 'PROVIDER', TRUE, TRUE, TRUE),
        ('00000000-0000-0000-0000-000000000083', 'http_auth_deactivated_1', '+919876599003', 'HTTP Deactivated User', 'http.deactivated@nearvia.test', 'WORKER', FALSE, FALSE, FALSE);
    `);

    console.log("\n[1. HTTP Verification Suite]");

    // 1. Unauthenticated Google sync
    const res1 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .send({ fullName: "Anonymous Attacker", role: "WORKER" });
    assert(
      res1.status === 401 && res1.body.error?.code === "UNAUTHORIZED",
      "Unauthenticated request to sync-google-profile rejected with 401",
      `Got status ${res1.status}`,
    );

    // 2. Malformed token
    const res2 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer bad_format_token")
      .send({ fullName: "Attacker" });
    assert(
      res2.status === 401,
      "Malformed or invalid token rejected with 401",
      `Got status ${res2.status}`,
    );

    // 3. Identity mismatch (malicious authId in body)
    const res3 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_http_auth_worker_1")
      .send({ authId: "forged_victim_auth_id", role: "WORKER" });
    assert(
      res3.status === 403 && res3.body.error?.code === "FORBIDDEN",
      "Malicious authId discrepancy in payload rejected with 403 Forbidden",
      `Got status ${res3.status}`,
    );

    // 4. Identity mismatch (malicious email in body)
    const res4 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_http_auth_worker_1")
      .send({ email: "victim.executive@nearvia.test", role: "WORKER" });
    assert(
      res4.status === 403 && res4.body.error?.code === "FORBIDDEN",
      "Malicious email discrepancy in payload rejected with 403 Forbidden",
      `Got status ${res4.status}`,
    );

    // 5. Privilege escalation attempt (role: ADMIN)
    const res5 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_http_auth_worker_1")
      .send({ role: "ADMIN" });
    assert(
      (res5.status === 400 || res5.status === 403) && res5.body.success === false,
      "Self-selection of ADMIN role via OAuth payload rejected",
      `Got status ${res5.status}`,
    );

    // 6. Role immutability on sync (Provider sends role: WORKER)
    const res6 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_http_auth_provider_1")
      .send({ fullName: "Updated Provider Name", role: "WORKER" });
    assert(
      res6.status === 200 && res6.body.data.role === UserRole.PROVIDER,
      "Existing Provider role immutable against Google sync payload",
      `Got role ${res6.body.data?.role}`,
    );

    // 7. Deactivated account blocked
    const res7 = await request(app)
      .post("/api/v1/auth/sync-google-profile")
      .set("Authorization", "Bearer mock_token_http_auth_deactivated_1")
      .send({ fullName: "Deactivated Attempt" });
    assert(
      res7.status === 403 && res7.body.error?.code === "FORBIDDEN",
      "Suspended/deactivated account rejected with 403 Forbidden",
      `Got status ${res7.status}`,
    );

    // 8. Protected endpoint without token
    const res8 = await request(app).get("/api/v1/auth/me");
    assert(
      res8.status === 401,
      "Unauthenticated request to /auth/me rejected with 401",
      `Got status ${res8.status}`,
    );

    // 9. Case-insensitive Bearer header parsing
    const res9 = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "bearer   mock_token_http_auth_worker_1");
    assert(
      res9.status === 200 && res9.body.data.role === UserRole.WORKER,
      "Case-insensitive Bearer header with whitespace parsed successfully",
      `Got status ${res9.status}`,
    );

    console.log("\n[2. Database Forensic Verification Suite]");

    // DB 1: Check Provider role unchanged in PostgreSQL
    const dbProvider = await query<any>(
      "SELECT role, identity_verified, mobile_verified, is_active FROM users WHERE auth_id = $1",
      ["http_auth_provider_1"],
    );
    assert(
      dbProvider.rows[0]?.role === UserRole.PROVIDER,
      "Database: Provider role remains PROVIDER",
      `DB role is ${dbProvider.rows[0]?.role}`,
    );
    assert(
      dbProvider.rows[0]?.identity_verified === true,
      "Database: Verification flags untouched by sync",
      `DB identity_verified is ${dbProvider.rows[0]?.identity_verified}`,
    );

    // DB 2: Check Deactivated user is still deactivated
    const dbDeactivated = await query<any>(
      "SELECT is_active FROM users WHERE auth_id = $1",
      ["http_auth_deactivated_1"],
    );
    assert(
      dbDeactivated.rows[0]?.is_active === false,
      "Database: Deactivated user remains is_active = FALSE",
      `DB is_active is ${dbDeactivated.rows[0]?.is_active}`,
    );

    // DB 3: Check zero duplicate auth_ids across entire users table
    const dbDups = await query<any>(
      "SELECT auth_id, count(*) FROM users WHERE auth_id IS NOT NULL GROUP BY auth_id HAVING count(*) > 1",
    );
    assert(
      dbDups.rows.length === 0,
      "Database: 0 duplicate auth_ids in users table",
      `Found ${dbDups.rows.length} duplicates`,
    );

    // DB 4: Check zero unauthorized ADMIN users created
    const dbAdmins = await query<any>(
      "SELECT email, auth_id FROM users WHERE role = 'ADMIN' AND email NOT IN ('admin@nearvia.in', 'admin@nearvia.test', 'admin.p2@nearvia.test')",
    );
    assert(
      dbAdmins.rows.length === 0,
      "Database: 0 unauthorized ADMIN accounts present",
      `Found ${dbAdmins.rows.length} unexpected admin accounts`,
    );

    // Cleanup test users
    await query(`
      DELETE FROM users 
      WHERE email IN ('http.worker@nearvia.test', 'http.provider@nearvia.test', 'http.deactivated@nearvia.test')
         OR auth_id IN ('http_auth_worker_1', 'http_auth_provider_1', 'http_auth_deactivated_1')
         OR phone IN ('+919876599001', '+919876599002', '+919876599003');
    `);

    console.log("\n====================================================");
    console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log("====================================================");

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
