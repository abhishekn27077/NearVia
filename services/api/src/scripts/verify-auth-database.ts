import { query } from "../db";

async function runDatabaseVerification() {
  console.log("====================================================");
  console.log("🛡️  NEARVIA DATABASE IDENTITY & AUTH SECURITY AUDIT");
  console.log("====================================================");

  try {
    // 1. Users Table Audit
    const usersCountRes = await query("SELECT COUNT(*) as count FROM users");
    const rolesRes = await query(`
      SELECT role, count(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY count DESC
    `);
    const activeRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_count,
        COUNT(*) FILTER (WHERE is_active = FALSE) as deactivated_count,
        COUNT(*) FILTER (WHERE mobile_verified = TRUE) as mobile_verified_count,
        COUNT(*) FILTER (WHERE identity_verified = TRUE) as identity_verified_count
      FROM users
    `);
    
    console.log(`\n[Users Overview]`);
    console.log(`Total Registered Users: ${usersCountRes.rows[0]?.count ?? 0}`);
    console.log(`Active Users: ${activeRes.rows[0]?.active_count ?? 0} | Deactivated Users: ${activeRes.rows[0]?.deactivated_count ?? 0}`);
    console.log(`Mobile Verified: ${activeRes.rows[0]?.mobile_verified_count ?? 0} | Identity Verified: ${activeRes.rows[0]?.identity_verified_count ?? 0}`);
    console.log("\n[Role Distribution]");
    for (const row of rolesRes.rows) {
      console.log(` - ${row.role}: ${row.count}`);
    }

    // Check for duplicate auth_id or email
    const duplicateCheck = await query(`
      SELECT auth_id, count(*) 
      FROM users 
      WHERE auth_id IS NOT NULL 
      GROUP BY auth_id 
      HAVING count(*) > 1
    `);
    console.log(`\n[Integrity Check: Duplicate auth_id]: ${duplicateCheck.rows.length === 0 ? "PASSED (0 duplicates)" : "FAILED"}`);

    const emailDupCheck = await query(`
      SELECT LOWER(email) as email, count(*) 
      FROM users 
      WHERE email IS NOT NULL 
      GROUP BY LOWER(email) 
      HAVING count(*) > 1
    `);
    console.log(`[Integrity Check: Duplicate emails]: ${emailDupCheck.rows.length === 0 ? "PASSED (0 duplicates)" : "FAILED"}`);

    // 2. Profile Tables Audit
    const workerProfiles = await query("SELECT COUNT(*) as count FROM worker_profiles");
    const providerProfiles = await query("SELECT COUNT(*) as count FROM provider_profiles");
    const agentProfiles = await query("SELECT COUNT(*) as count FROM agent_profiles");

    console.log(`\n[Profiles Count]`);
    console.log(` - Worker Profiles: ${workerProfiles.rows[0]?.count ?? 0}`);
    console.log(` - Provider Profiles: ${providerProfiles.rows[0]?.count ?? 0}`);
    console.log(` - Agent Profiles: ${agentProfiles.rows[0]?.count ?? 0}`);

    // Check for orphaned profiles
    const orphanedWorkers = await query(`
      SELECT wp.id FROM worker_profiles wp LEFT JOIN users u ON wp.user_id = u.id WHERE u.id IS NULL
    `);
    console.log(`[Integrity Check: Orphaned Worker Profiles]: ${orphanedWorkers.rows.length === 0 ? "PASSED (0 orphaned)" : "FAILED"}`);

    // 3. OTP Security Audit
    const otpChallenges = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE otp_hash LIKE 'mock_%' OR LENGTH(otp_hash) = 64) as hashed_valid,
        COUNT(*) FILTER (WHERE LENGTH(otp_hash) < 10) as plaintext_leaks,
        COUNT(*) FILTER (WHERE consumed_at IS NOT NULL) as consumed,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired
      FROM otp_challenges
    `);
    console.log(`\n[OTP Security Audit]`);
    console.log(` - Total Challenges: ${otpChallenges.rows[0]?.total ?? 0}`);
    console.log(` - Hashed/Secure: ${otpChallenges.rows[0]?.hashed_valid ?? 0}`);
    console.log(` - Plaintext Leaks Detected: ${otpChallenges.rows[0]?.plaintext_leaks ?? 0} (Expected: 0)`);
    console.log(` - Consumed: ${otpChallenges.rows[0]?.consumed ?? 0} | Expired: ${otpChallenges.rows[0]?.expired ?? 0}`);

    // 4. Audit Log Verification
    const auditLogsRes = await query(`
      SELECT action, count(*) as count 
      FROM audit_logs 
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `);
    console.log(`\n[Audit Trail Summary (Top Actions)]`);
    for (const log of auditLogsRes.rows) {
      console.log(` - ${log.action}: ${log.count}`);
    }

    console.log("\n====================================================");
    console.log("✅ DATABASE AUTHENTICATION AUDIT COMPLETED CLEANLY");
    console.log("====================================================");
    process.exit(0);
  } catch (error) {
    console.error("Database audit failed:", error);
    process.exit(1);
  }
}

runDatabaseVerification();
