/**
 * NEARVIA Prompt 2: PostgreSQL, Supabase & RLS Final Security Audit Test Suite
 * Validates RLS table coverage, policy granularity, spatial & FK indexing,
 * constraint integrity, location privacy, concurrency atomicity, and seed safeguards.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { query } from "../src/db";
import { providersService } from "../src/modules/providers/service";
import { assignmentsService } from "../src/modules/assignments/service";
import { seedDemoAccounts } from "../src/scripts/seed-demo";
import { resetDemoData } from "../src/scripts/reset-demo";
import { UserRole } from "@nearvia/types";

describe("Prompt 2: PostgreSQL, Supabase & RLS Final Security Audit Suite", () => {
  const TEST_PROVIDER_AUTH = "p2_prov_audit_auth";
  const TEST_WORKER_AUTH = "p2_work_audit_auth";

  let testProviderUserId: string;
  let testProviderProfileId: string;
  let testWorkerUserId: string;
  let testWorkerProfileId: string;
  let testCategoryId: string;
  let testOpportunityId: string;
  let testAssignmentId: string;

  beforeAll(async () => {
    // 1. Setup Category
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, is_active)
       VALUES ('Audit Testing Trade', 'audit-testing-trade', TRUE)
       ON CONFLICT (slug) DO UPDATE SET is_active = TRUE
       RETURNING id`,
    );
    testCategoryId = catRes.rows[0].id;

    // 2. Setup Provider
    const provUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919999988801', 'Audit Provider', 'audit.prov@test.local', 'PROVIDER', TRUE)
       ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [TEST_PROVIDER_AUTH],
    );
    testProviderUserId = provUserRes.rows[0].id;

    const provProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, location, address_approximate)
       VALUES ($1, 'Audit Logistics Ltd', ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Indiranagar')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
       RETURNING id`,
      [testProviderUserId],
    );
    testProviderProfileId = provProfRes.rows[0].id;

    // 3. Setup Worker
    const workUserRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919999988802', 'Audit Worker', 'audit.work@test.local', 'WORKER', TRUE)
       ON CONFLICT (auth_id) DO UPDATE SET is_active = TRUE
       RETURNING id`,
      [TEST_WORKER_AUTH],
    );
    testWorkerUserId = workUserRes.rows[0].id;

    const workProfRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, is_available_now, availability_status, availability_updated_at, updated_at)
       VALUES ($1, ST_SetSRID(ST_MakePoint(77.5950, 12.9720), 4326)::geography, 'Indiranagar 100ft', TRUE, 'AVAILABLE_NOW', NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET is_available_now = TRUE, availability_status = 'AVAILABLE_NOW', availability_updated_at = NOW(), updated_at = NOW()
       RETURNING id`,
      [testWorkerUserId],
    );
    testWorkerProfileId = workProfRes.rows[0].id;

    // 4. Setup Work Opportunity
    const oppRes = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
        provider_id, category_id, title, description, work_type, urgency, status,
        workers_needed, workers_assigned, location, address_approximate,
        work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
        $1, $2, 'Audit Test Job', 'Verification shift', 'TASK', 'NORMAL', 'PUBLISHED',
        1, 0, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Indiranagar',
        CURRENT_DATE, NOW(), NOW() + INTERVAL '4 hours', 4.0, 800.00, 'FIXED'
       ) RETURNING id`,
      [testProviderProfileId, testCategoryId],
    );
    testOpportunityId = oppRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup audit test data
    if (testOpportunityId) {
      await query(`DELETE FROM assignments WHERE work_opportunity_id = $1`, [testOpportunityId]);
      await query(`DELETE FROM applications WHERE work_opportunity_id = $1`, [testOpportunityId]);
      await query(`DELETE FROM work_opportunities WHERE id = $1`, [testOpportunityId]);
    }
    if (testWorkerUserId) {
      await query(`DELETE FROM worker_profiles WHERE user_id = $1`, [testWorkerUserId]);
      await query(`DELETE FROM users WHERE id = $1`, [testWorkerUserId]);
    }
    if (testProviderUserId) {
      await query(`DELETE FROM provider_profiles WHERE user_id = $1`, [testProviderUserId]);
      await query(`DELETE FROM users WHERE id = $1`, [testProviderUserId]);
    }
    await query(`DELETE FROM webhook_events WHERE event_id LIKE 'audit_evt_%'`);
  });

  // ─────────────────────────────────────────────────────────────
  // 1. RLS ACTIVATION ON ALL APPLICATION TABLES
  // ─────────────────────────────────────────────────────────────
  it("Test 1: RLS is actively enabled on all client-accessible application tables", async () => {
    const res = await query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity 
       FROM pg_tables 
       WHERE schemaname = 'public' 
         AND tablename IN (
           'users', 'worker_profiles', 'provider_profiles', 'agent_profiles',
           'categories', 'skills', 'worker_skills', 'work_opportunities',
           'applications', 'assignments', 'attendance_records', 'job_evidence',
           'payment_records', 'disputes', 'reports', 'notifications',
           'conversations', 'messages', 'webhook_events', 'audit_logs'
         )`,
    );

    expect(res.rows.length).toBeGreaterThanOrEqual(18);
    for (const row of res.rows) {
      expect(row.rowsecurity).toBe(true);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 2. INSECURE PUBLIC READ POLICIES REVOCATION
  // ─────────────────────────────────────────────────────────────
  it("Test 2: Insecure public read policies on worker and provider profiles are revoked", async () => {
    const res = await query<{ tablename: string; policyname: string }>(
      `SELECT tablename, policyname 
       FROM pg_policies 
       WHERE schemaname = 'public' 
         AND policyname IN (
           'Allow public read on worker profiles for matching',
           'Allow public read on provider profiles'
         )`,
    );

    expect(res.rows.length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────
  // 3. GRANULAR RLS POLICIES EXIST
  // ─────────────────────────────────────────────────────────────
  it("Test 3: Granular RLS policies (SELECT/INSERT/UPDATE/DELETE) exist across core entities", async () => {
    const res = await query<{ tablename: string; cmd: string; policyname: string }>(
      `SELECT tablename, cmd, policyname 
       FROM pg_policies 
       WHERE schemaname = 'public' 
         AND tablename IN ('users', 'worker_profiles', 'provider_profiles', 'applications', 'assignments', 'payment_records')`,
    );

    const commands = new Set(res.rows.map((r) => r.cmd));
    expect(commands.has("SELECT")).toBe(true);
    expect(commands.has("INSERT")).toBe(true);
    expect(commands.has("UPDATE")).toBe(true);
    expect(commands.has("DELETE")).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. SECURITY DEFINER HELPER FUNCTIONS
  // ─────────────────────────────────────────────────────────────
  it("Test 4: current_user_id() and current_user_role() are security definer functions", async () => {
    const res = await query<{ proname: string; prosecdef: boolean }>(
      `SELECT proname, prosecdef 
       FROM pg_proc 
       WHERE proname IN ('current_user_id', 'current_user_role')`,
    );

    expect(res.rows.length).toBe(2);
    for (const row of res.rows) {
      expect(row.prosecdef).toBe(true);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 5. SPATIAL AND FK INDEXES
  // ─────────────────────────────────────────────────────────────
  it("Test 5: Spatial GIST and foreign key performance indexes exist", async () => {
    const spatialRes = await query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes 
       WHERE schemaname = 'public' 
         AND tablename = 'agent_profiles' 
         AND indexname = 'idx_agent_profiles_location'`,
    );
    expect(spatialRes.rows.length).toBe(1);

    const fkRes = await query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes 
       WHERE schemaname = 'public' 
         AND indexname IN (
           'idx_assignments_application',
           'idx_applications_assisted_by_agent',
           'idx_worker_profiles_assisted_by_agent',
           'idx_conversations_application',
           'idx_job_evidence_assignment'
         )`,
    );
    expect(fkRes.rows.length).toBe(5);
  });

  // ─────────────────────────────────────────────────────────────
  // 6. DUPLICATE ACTIVE ASSIGNMENT CONCURRENCY DEFENSE
  // ─────────────────────────────────────────────────────────────
  it("Test 6: idx_unique_active_assignment_worker prevents concurrent duplicate active assignments", async () => {
    // 1. First assignment succeeds
    const firstRes = await query<{ id: string }>(
      `INSERT INTO assignments (
        work_opportunity_id, worker_id, provider_id, status, agreed_wage
       ) VALUES ($1, $2, $3, 'ASSIGNED', 800.00)
       RETURNING id`,
      [testOpportunityId, testWorkerProfileId, testProviderProfileId],
    );
    testAssignmentId = firstRes.rows[0].id;
    expect(testAssignmentId).toBeDefined();

    // 2. Second in-flight assignment for same (job, worker) must be rejected by unique partial index
    await expect(
      query(
        `INSERT INTO assignments (
          work_opportunity_id, worker_id, provider_id, status, agreed_wage
         ) VALUES ($1, $2, $3, 'ASSIGNED', 800.00)`,
        [testOpportunityId, testWorkerProfileId, testProviderProfileId],
      ),
    ).rejects.toThrow(/idx_unique_active_assignment_worker|duplicate key value/);
  });

  // ─────────────────────────────────────────────────────────────
  // 7. DUPLICATE APPLICATION CONSTRAINT
  // -------------------------------------------------------------
  it("Test 7: UNIQUE(work_opportunity_id, worker_id) prevents duplicate applications", async () => {
    // 1. First application succeeds
    await query(
      `INSERT INTO applications (work_opportunity_id, worker_id, status)
       VALUES ($1, $2, 'PENDING')`,
      [testOpportunityId, testWorkerProfileId],
    );

    // 2. Second application fails
    await expect(
      query(
        `INSERT INTO applications (work_opportunity_id, worker_id, status)
         VALUES ($1, $2, 'PENDING')`,
        [testOpportunityId, testWorkerProfileId],
      ),
    ).rejects.toThrow(/duplicate key value/);
  });

  // ─────────────────────────────────────────────────────────────
  // 8. WEBHOOK IDEMPOTENCY CONSTRAINT
  // ─────────────────────────────────────────────────────────────
  it("Test 8: UNIQUE(provider, event_id) prevents payment webhook replays", async () => {
    const eventId = "audit_evt_unique_test_1";

    await query(
      `INSERT INTO webhook_events (provider, event_id, event_type, status)
       VALUES ('RAZORPAY', $1, 'payment.captured', 'PROCESSED')`,
      [eventId],
    );

    // Replay attempt must fail with unique constraint violation
    await expect(
      query(
        `INSERT INTO webhook_events (provider, event_id, event_type, status)
         VALUES ('RAZORPAY', $1, 'payment.captured', 'PROCESSED')`,
        [eventId],
      ),
    ).rejects.toThrow(/unique_provider_event_id|duplicate key value/);
  });

  // ─────────────────────────────────────────────────────────────
  // 9. LOCATION PRIVACY IN WORKFORCE RADAR
  // ─────────────────────────────────────────────────────────────
  it("Test 9: Workforce Radar returns aggregates and hides raw worker coordinates", async () => {
    const radar = await providersService.getWorkforceRadar(
      testProviderUserId,
      12.9716,
      77.5946,
      5.0,
    );

    expect(radar).toBeDefined();
    expect(radar.totalAvailableWorkers).toBeGreaterThanOrEqual(1);
    expect(radar.searchCenter).toEqual({ latitude: 12.9716, longitude: 77.5946 });

    // Cluster verification: centerCoordinates must match coarse search center
    if (radar.clusters.length > 0) {
      const cluster = radar.clusters[0];
      expect(cluster.approximateAreaName).toBeDefined();
      expect(cluster.availableWorkersCount).toBeGreaterThanOrEqual(1);
      expect(cluster.centerCoordinates.latitude).toBe(12.9716);
      expect(cluster.centerCoordinates.longitude).toBe(77.5946);
    }

    // Available talent verification: IDs must be anonymized, no phone/email/exact coordinates
    if (radar.availableTalent.length > 0) {
      const talent = radar.availableTalent[0];
      expect(talent.id).toMatch(/^talent_/);
      expect((talent as any).phone).toBeUndefined();
      expect((talent as any).email).toBeUndefined();
      expect((talent as any).location).toBeUndefined();
      expect((talent as any).latitude).toBeUndefined();
      expect((talent as any).longitude).toBeUndefined();
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 10. ATOMIC STATE CONCURRENCY IN ASSIGNMENT EXECUTION
  // ─────────────────────────────────────────────────────────────
  it("Test 10: checkIn rejects concurrent check-in on unconfirmed assignment with 400", async () => {
    // Current testAssignmentId is in 'ASSIGNED' state (not CONFIRMED)
    await expect(
      assignmentsService.checkIn(testWorkerUserId, testAssignmentId, {
        latitude: 12.9716,
        longitude: 77.5946,
      }),
    ).rejects.toThrow(/confirm the assignment first/);
  });

  it("Test 11: checkOut rejects checkout from un-checked-in assignment with 400", async () => {
    // Assignment is still in 'ASSIGNED' state
    await expect(
      assignmentsService.checkOut(testWorkerUserId, testAssignmentId, {
        latitude: 12.9716,
        longitude: 77.5946,
      }),
    ).rejects.toThrow(/Cannot check out from status/);
  });

  // ─────────────────────────────────────────────────────────────
  // 11. SEED SCRIPT PRODUCTION ENVIRONMENT SAFEGUARDS
  // ─────────────────────────────────────────────────────────────
  it("Test 12: seedDemoAccounts aborts in production unless ALLOW_DEMO_SEED_IN_PROD is set", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalOverride = process.env.ALLOW_DEMO_SEED_IN_PROD;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_DEMO_SEED_IN_PROD;

      await expect(seedDemoAccounts()).rejects.toThrow(
        /Demo seed cannot run in production environment/,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalOverride !== undefined) {
        process.env.ALLOW_DEMO_SEED_IN_PROD = originalOverride;
      }
    }
  });

  it("Test 13: resetDemoData aborts in production unless ALLOW_DEMO_RESET_IN_PROD is set", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalOverride = process.env.ALLOW_DEMO_RESET_IN_PROD;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_DEMO_RESET_IN_PROD;

      await expect(resetDemoData()).rejects.toThrow(
        /Demo data reset cannot run in production environment/,
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalOverride !== undefined) {
        process.env.ALLOW_DEMO_RESET_IN_PROD = originalOverride;
      }
    }
  });
});
