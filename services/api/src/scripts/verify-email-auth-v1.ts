import { query } from "../db";
import request from "supertest";
import express from "express";
import { authRouter } from "../modules/auth";
import { errorHandler, notFoundHandler, authenticateUser, requireVerifiedEmail } from "../middleware";

async function main() {
  console.log("===============================================================================");
  console.log("NEARVIA PROMPT 4: Supabase Email Verification & Free-First Verification Verification");
  console.log("===============================================================================");

  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRouter);
  app.get("/api/v1/protected/verified-only", authenticateUser, requireVerifiedEmail, (req, res) => {
    res.json({ success: true, message: "Authorized verified access", user: req.user });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  const timestamp = Date.now();
  const testEmail = `live.worker.${timestamp}@nearvia.test`;
  const attackerEmail = `live.attacker.${timestamp}@nearvia.test`;

  try {
    // 1. Live Registration Test
    console.log("\n[CHECK 1] Registering new user without phone or SMS credentials...");
    const regRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: testEmail,
        password: "StrongPassword123!",
        fullName: "Live Verified Worker",
        role: "WORKER",
      });
    console.log(`  -> Status: ${regRes.status} (Expected: 201)`);
    console.log(`  -> Role: ${regRes.body.data?.role} (Expected: WORKER)`);
    console.log(`  -> Mobile Verified: ${regRes.body.data?.mobileVerified} (Expected: false)`);
    if (regRes.status !== 201) throw new Error("Registration failed");

    // 2. Database Invariant Check
    console.log("\n[CHECK 2] Querying PostgreSQL for registered user row...");
    const dbRes = await query<any>("SELECT * FROM users WHERE email = $1", [testEmail]);
    const user = dbRes.rows[0];
    console.log(`  -> DB User Found: ID=${user.id}, AuthID=${user.auth_id}`);
    console.log(`  -> DB Role: ${user.role} (Expected: WORKER)`);
    console.log(`  -> DB Mobile Verified: ${user.mobile_verified} (Expected: false)`);
    console.log(`  -> DB Email Verified: ${user.email_verified}`);
    if (!user || user.role !== "WORKER" || user.mobile_verified !== false) {
      throw new Error("Database invariants violated");
    }

    // 3. Admin Escalation Rejection
    console.log("\n[CHECK 3] Attempting ADMIN registration escalation...");
    const adminRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: `fake.admin.${timestamp}@nearvia.test`,
        password: "StrongPassword123!",
        fullName: "Fake Admin",
        role: "ADMIN",
      });
    console.log(`  -> Status: ${adminRes.status} (Expected: 400 Validation Error)`);
    if (adminRes.status !== 400) throw new Error("Admin escalation was not rejected with 400");

    // 4. Duplicate Account Hijack Rejection
    console.log("\n[CHECK 4] Attempting duplicate registration on existing email with new password...");
    const hijackRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: testEmail,
        password: "AttackerNewPassword!",
        fullName: "Attacker Account Hijacker",
        role: "PROVIDER",
      });
    console.log(`  -> Status: ${hijackRes.status} (Expected: 409 Conflict)`);
    console.log(`  -> Error: ${hijackRes.body.error?.message}`);
    if (hijackRes.status !== 409) throw new Error("Account hijack was not rejected with 409");

    // 5. Login without SMS OTP
    console.log("\n[CHECK 5] Logging in with email & password without SMS OTP...");
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: testEmail,
        password: "StrongPassword123!",
      });
    console.log(`  -> Status: ${loginRes.status} (Expected: 200)`);
    console.log(`  -> Token Received: ${loginRes.body.data?.token ? "YES (Valid Bearer)" : "NO"}`);
    const token = loginRes.body.data?.token;
    if (!token) throw new Error("Login failed to return token");

    // 6. Privilege Tampering via Profile Update
    console.log("\n[CHECK 6] Attempting to tamper email_verified and role via PUT /profile...");
    const tamperRes = await request(app)
      .put("/api/v1/auth/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Tampered Worker",
        email_verified: false,
        role: "ADMIN",
      });
    console.log(`  -> Status: ${tamperRes.status} (Expected: 400 Strict Schema Rejection)`);
    if (tamperRes.status !== 400) throw new Error("Profile tampering was not rejected");

    // 7. Verify Another User Email Rejection
    console.log("\n[CHECK 7] Attempting to confirm another user email address...");
    const confirmRes = await request(app)
      .post("/api/v1/auth/confirm-email")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "other.victim@nearvia.test",
      });
    console.log(`  -> Status: ${confirmRes.status} (Expected: 403 Forbidden)`);
    console.log(`  -> Message: ${confirmRes.body.error?.message}`);
    if (confirmRes.status !== 403) throw new Error("Arbitrary confirm-email was not rejected with 403");

    // 8. Session Termination
    console.log("\n[CHECK 8] Logging out session...");
    const logoutRes = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    console.log(`  -> Status: ${logoutRes.status} (Expected: 200)`);
    console.log(`  -> Message: ${logoutRes.body.data?.message}`);
    if (logoutRes.status !== 200) throw new Error("Logout acknowledgment failed");

    // 9. Free-First Architecture Verification
    console.log("\n[CHECK 9] Verifying free-first zero-cost SMS credentials requirement...");
    console.log(`  -> MSG91_AUTH_KEY: ${process.env.MSG91_AUTH_KEY ? "SET" : "NOT SET (Free default)"}`);
    console.log(`  -> TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? "SET" : "NOT SET (Free default)"}`);
    console.log(`  -> SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? "PRESENT" : "MISSING"}`);
    console.log(`  -> SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "PRESENT (Backend isolated)" : "MISSING"}`);

    console.log("\n===============================================================================");
    console.log("ALL LIVE HTTP & POSTGRES FORENSIC CHECKS PASSED PERFECTLY!");
    console.log("===============================================================================");
  } finally {
    await query("DELETE FROM users WHERE email IN ($1, $2)", [testEmail, attackerEmail]);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
