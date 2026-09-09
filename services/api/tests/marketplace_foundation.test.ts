import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { UserRole, WorkOpportunityStatus, ApplicationStatus } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";
import { workOpportunitiesService } from "../src/modules/jobs/service";
import { applicationsService } from "../src/modules/applications/service";

describe("NEARVIA Prompt 5: Marketplace Foundation (Jobs, Discovery, Applications) Test Suite", () => {
  let app: Express;

  const PROVIDER_A_AUTH = "test_provider_a_p5";
  const PROVIDER_B_AUTH = "test_provider_b_p5";
  const WORKER_A_AUTH = "test_worker_a_p5";
  const WORKER_B_AUTH = "test_worker_b_p5";
  const ADMIN_AUTH = "test_admin_p5";

  let providerAUserId: string;
  let providerBUserId: string;
  let workerAUserId: string;
  let workerBUserId: string;
  let adminUserId: string;

  let providerAProfileId: string;
  let providerBProfileId: string;
  let workerAProfileId: string;
  let workerBProfileId: string;

  const validCategoryId = "a0000001-0000-0000-0000-000000000001"; // Restaurant & Hospitality
  const validSkillId = "b0000001-0000-0000-0000-000000000001"; // Kitchen Helper

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Clean up any stale test accounts
    await query(`
      DELETE FROM assignments WHERE agreed_wage IN (555, 666, 777, 888, 999);
      DELETE FROM applications WHERE worker_notes LIKE '%[P5_TEST]%';
      DELETE FROM work_opportunities WHERE title LIKE '%[P5_TEST]%';
      DELETE FROM worker_profiles WHERE user_id IN (
        SELECT id FROM users WHERE auth_id IN ('test_worker_a_p5', 'test_worker_b_p5')
      );
      DELETE FROM provider_profiles WHERE user_id IN (
        SELECT id FROM users WHERE auth_id IN ('test_provider_a_p5', 'test_provider_b_p5')
      );
      DELETE FROM users WHERE auth_id IN (
        'test_provider_a_p5', 'test_provider_b_p5', 'test_worker_a_p5', 'test_worker_b_p5', 'test_admin_p5'
      ) OR email IN (
        'provider.a.p5@nearvia.test', 'provider.b.p5@nearvia.test',
        'worker.a.p5@nearvia.test', 'worker.b.p5@nearvia.test',
        'admin.p5@nearvia.test'
      );
    `);

    // Insert test users
    const userInsertSql = `
      INSERT INTO users (auth_id, phone, full_name, email, role, is_active, mobile_verified, identity_verified)
      VALUES 
        ($1, '+919999000001', 'Provider Alice P5', 'provider.a.p5@nearvia.test', 'PROVIDER', TRUE, TRUE, TRUE),
        ($2, '+919999000002', 'Provider Bob P5', 'provider.b.p5@nearvia.test', 'PROVIDER', TRUE, TRUE, TRUE),
        ($3, '+919999000003', 'Worker Charlie P5', 'worker.a.p5@nearvia.test', 'WORKER', TRUE, TRUE, TRUE),
        ($4, '+919999000004', 'Worker Diana P5', 'worker.b.p5@nearvia.test', 'WORKER', TRUE, TRUE, TRUE),
        ($5, '+919999000005', 'Admin Eve P5', 'admin.p5@nearvia.test', 'ADMIN', TRUE, TRUE, TRUE)
      RETURNING id, auth_id;
    `;
    const usersRes = await query<{ id: string; auth_id: string }>(userInsertSql, [
      PROVIDER_A_AUTH,
      PROVIDER_B_AUTH,
      WORKER_A_AUTH,
      WORKER_B_AUTH,
      ADMIN_AUTH,
    ]);

    for (const u of usersRes.rows) {
      if (u.auth_id === PROVIDER_A_AUTH) providerAUserId = u.id;
      if (u.auth_id === PROVIDER_B_AUTH) providerBUserId = u.id;
      if (u.auth_id === WORKER_A_AUTH) workerAUserId = u.id;
      if (u.auth_id === WORKER_B_AUTH) workerBUserId = u.id;
      if (u.auth_id === ADMIN_AUTH) adminUserId = u.id;
    }

    // Insert provider profiles
    const provARes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, provider_type, contact_phone)
       VALUES ($1, 'Alice Bistro', 'BUSINESS', '+919999000001') RETURNING id`,
      [providerAUserId],
    );
    providerAProfileId = provARes.rows[0].id;

    const provBRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, provider_type, contact_phone)
       VALUES ($1, 'Bob Logistics', 'BUSINESS', '+919999000002') RETURNING id`,
      [providerBUserId],
    );
    providerBProfileId = provBRes.rows[0].id;

    // Insert worker profiles with coordinates in central Bangalore (12.9716, 77.5946)
    const workARes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, service_radius_km, is_available_now, average_rating)
       VALUES ($1, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'MG Road Bangalore', 10, TRUE, 4.8) RETURNING id`,
      [workerAUserId],
    );
    workerAProfileId = workARes.rows[0].id;

    const workBRes = await query<{ id: string }>(
      `INSERT INTO worker_profiles (user_id, location, address_approximate, service_radius_km, is_available_now, average_rating)
       VALUES ($1, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Brigade Road Bangalore', 10, TRUE, 4.9) RETURNING id`,
      [workerBUserId],
    );
    workerBProfileId = workBRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup created test rows
    await query(`
      DELETE FROM assignments WHERE agreed_wage IN (555, 666, 777, 888, 999);
      DELETE FROM applications WHERE worker_notes LIKE '%[P5_TEST]%';
      DELETE FROM work_opportunities WHERE title LIKE '%[P5_TEST]%';
      DELETE FROM worker_profiles WHERE user_id IN (
        SELECT id FROM users WHERE auth_id IN ('test_worker_a_p5', 'test_worker_b_p5')
      );
      DELETE FROM provider_profiles WHERE user_id IN (
        SELECT id FROM users WHERE auth_id IN ('test_provider_a_p5', 'test_provider_b_p5')
      );
      DELETE FROM users WHERE auth_id IN (
        'test_provider_a_p5', 'test_provider_b_p5', 'test_worker_a_p5', 'test_worker_b_p5', 'test_admin_p5'
      );
    `);
  });

  // =========================================================================
  // GROUP 1: Job Creation Tests (1-10)
  // =========================================================================
  describe("Group 1: Job Creation (Tests 1-10)", () => {
    it("1. Provider can create draft job", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          title: "[P5_TEST] Kitchen Helper Draft",
          description: "Assisting chef with food prep and dishwashing.",
          categoryId: validCategoryId,
          workType: "SHIFT",
          urgency: "NORMAL",
          workersNeeded: 2,
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "MG Road, Bangalore",
          workDate: tomorrow,
          startTime: "10:00",
          endTime: "14:00",
          durationHours: 4,
          paymentAmount: 800,
          paymentType: "FIXED",
          status: "DRAFT",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("DRAFT");
      expect(res.body.data.title).toBe("[P5_TEST] Kitchen Helper Draft");
      expect(res.body.data.providerId).toBe(providerAProfileId);
    });

    it("2. Provider can create published job", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          title: "[P5_TEST] Table Server Immediate",
          description: "Evening rush table service assistance needed.",
          categoryId: validCategoryId,
          workType: "TASK",
          urgency: "URGENT",
          workersNeeded: 1,
          location: { latitude: 12.975, longitude: 77.6 },
          addressApproximate: "Commercial Street, Bangalore",
          workDate: tomorrow,
          startTime: "18:00",
          endTime: "22:00",
          durationHours: 4,
          paymentAmount: 900,
          paymentType: "FIXED",
          status: "PUBLISHED",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PUBLISHED");
      expect(res.body.data.publishedAt).toBeTruthy();
    });

    it("3. Worker cannot create job (403)", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`)
        .send({
          title: "[P5_TEST] Unauthorized Worker Job",
          description: "A worker trying to create a provider job.",
          categoryId: validCategoryId,
          workType: "SHIFT",
          workersNeeded: 1,
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "MG Road",
          workDate: tomorrow,
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          paymentAmount: 500,
          paymentType: "FIXED",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("4. Non-authenticated user cannot create job (401)", async () => {
      const res = await request(app)
        .post("/api/v1/jobs")
        .send({
          title: "[P5_TEST] Unauthenticated Job",
          description: "No auth header provided.",
          categoryId: validCategoryId,
          workType: "SHIFT",
          workersNeeded: 1,
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "MG Road",
          workDate: "2026-09-10",
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          paymentAmount: 500,
          paymentType: "FIXED",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("5. Invalid job payload fails validation (400)", async () => {
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          // Missing required fields like title, categoryId, workDate
          description: "Too short",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("6. Negative wage rejected (400)", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          title: "[P5_TEST] Negative Wage Job",
          description: "Testing wage validation boundary.",
          categoryId: validCategoryId,
          workType: "SHIFT",
          workersNeeded: 1,
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "MG Road",
          workDate: tomorrow,
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          paymentAmount: -500, // Invalid negative
          paymentType: "FIXED",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("7. Past date rejected (400)", async () => {
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          title: "[P5_TEST] Past Date Job",
          description: "Testing past date publishing rejection.",
          categoryId: validCategoryId,
          workType: "SHIFT",
          workersNeeded: 1,
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "MG Road",
          workDate: "2020-01-01", // Past date
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          paymentAmount: 500,
          paymentType: "FIXED",
          status: "PUBLISHED",
        });

      // Post-validation in service or publishing rejects past date
      // If schema accepts date regex, publish validation checks past date
      if (res.status === 201) {
        // If created as draft, verify publish rejects it
        const pubRes = await request(app)
          .post(`/api/v1/jobs/${res.body.data.id}/publish`)
          .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);
        expect(pubRes.status).toBe(400);
      } else {
        expect(res.status).toBe(400);
      }
    });

    it("8. End time before start time rejected (400)", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          title: "[P5_TEST] Invalid Timing Job",
          description: "End time is before start time.",
          categoryId: validCategoryId,
          workType: "SHIFT",
          workersNeeded: 1,
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "MG Road",
          workDate: tomorrow,
          startTime: "18:00",
          endTime: "14:00", // Before start time
          durationHours: 4,
          paymentAmount: 500,
          paymentType: "FIXED",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("9. Invalid coordinates rejected (400)", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          title: "[P5_TEST] Impossible Coordinates",
          description: "Testing latitude bounds checking.",
          categoryId: validCategoryId,
          workType: "SHIFT",
          workersNeeded: 1,
          location: { latitude: 150.0, longitude: 250.0 }, // Invalid coords
          addressApproximate: "Outer Space",
          workDate: tomorrow,
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          paymentAmount: 500,
          paymentType: "FIXED",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("10. workers_needed <= 0 rejected (400)", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          title: "[P5_TEST] Zero Workers Job",
          description: "Testing workersNeeded lower boundary.",
          categoryId: validCategoryId,
          workType: "SHIFT",
          workersNeeded: 0, // Must be at least 1
          location: { latitude: 12.9716, longitude: 77.5946 },
          addressApproximate: "MG Road",
          workDate: tomorrow,
          startTime: "10:00",
          endTime: "12:00",
          durationHours: 2,
          paymentAmount: 500,
          paymentType: "FIXED",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // =========================================================================
  // GROUP 2: Job Publishing Tests (11-15)
  // =========================================================================
  describe("Group 2: Job Publishing (Tests 11-15)", () => {
    let draftJobId: string;

    beforeAll(async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const created = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Draft Job for Publishing",
        description: "Valid draft waiting to be published.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 2,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "MG Road, Bangalore",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "14:00",
        durationHours: 4,
        paymentAmount: 700,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "DRAFT" as any,
      });
      draftJobId = created.id;
    });

    it("11. Draft job transitions to published", async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${draftJobId}/publish`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PUBLISHED");
      expect(res.body.data.publishedAt).toBeTruthy();
    });

    it("12. Already published job handled properly (400 on duplicate publish)", async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${draftJobId}/publish`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("Cannot publish opportunity currently in PUBLISHED status");
    });

    it("13. Cannot publish another provider's job (403)", async () => {
      // Provider B creates a draft
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const bDraft = await workOpportunitiesService.createWorkOpportunity(providerBUserId, {
        title: "[P5_TEST] Provider B Private Draft",
        description: "Provider B draft opportunity.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "Koramangala",
        workDate: tomorrow,
        startTime: "11:00",
        endTime: "15:00",
        durationHours: 4,
        paymentAmount: 850,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "DRAFT" as any,
      });

      // Provider A attempts to publish Provider B's draft
      const res = await request(app)
        .post(`/api/v1/jobs/${bDraft.id}/publish`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("14. Non-provider cannot publish (403)", async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const draft = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Draft for Worker Publish Test",
        description: "Valid draft waiting to test non-provider rejection.",
        categoryId: validCategoryId,
        workType: "TASK" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "Indiranagar",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "12:00",
        durationHours: 2,
        paymentAmount: 600,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "DRAFT" as any,
      });

      const res = await request(app)
        .post(`/api/v1/jobs/${draft.id}/publish`)
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("15. Incomplete draft cannot be published (400)", async () => {
      // Direct DB insert of an incomplete draft (e.g. title too short, payment 0)
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const incompleteRes = await query<{ id: string }>(
        `INSERT INTO work_opportunities (
          provider_id, category_id, title, description, work_type, urgency, status,
          workers_needed, location, address_approximate, work_date, start_time, end_time,
          duration_hours, payment_amount, payment_type, currency
        ) VALUES (
          $1, $2, 'Test', 'Short', 'TASK', 'NORMAL', 'DRAFT',
          1, ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography, 'Test',
          $3, $4, $5, 2, 100, 'FIXED', 'INR'
        ) RETURNING id`,
        [
          providerAProfileId,
          validCategoryId,
          tomorrow,
          `${tomorrow}T10:00:00Z`,
          `${tomorrow}T12:00:00Z`,
        ],
      );
      const incId = incompleteRes.rows[0].id;

      const res = await request(app)
        .post(`/api/v1/jobs/${incId}/publish`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // =========================================================================
  // GROUP 3: Job Discovery Tests (16-21)
  // =========================================================================
  describe("Group 3: Job Discovery (Tests 16-21)", () => {
    let publishedNearJobId: string;
    let draftNearJobId: string;
    let cancelledNearJobId: string;
    let farAwayJobId: string;

    beforeAll(async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

      // 1. Published job near MG Road (1.5 km away)
      const pNear = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Near Published Job",
        description: "Published job 1.5 km from search center.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 2,
        location: { latitude: 12.975, longitude: 77.605 },
        addressApproximate: "Residency Road",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "14:00",
        durationHours: 4,
        paymentAmount: 750,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "PUBLISHED" as any,
      });
      publishedNearJobId = pNear.id;

      // 2. Draft job near MG Road
      const dNear = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Near Draft Job",
        description: "Draft job should never be in discovery.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1,
        location: { latitude: 12.975, longitude: 77.605 },
        addressApproximate: "Residency Road",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "14:00",
        durationHours: 4,
        paymentAmount: 750,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "DRAFT" as any,
      });
      draftNearJobId = dNear.id;

      // 3. Cancelled job near MG Road
      const cNear = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Near Cancelled Job",
        description: "Cancelled job should not be in discovery.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1,
        location: { latitude: 12.975, longitude: 77.605 },
        addressApproximate: "Residency Road",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "14:00",
        durationHours: 4,
        paymentAmount: 750,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "PUBLISHED" as any,
      });
      await workOpportunitiesService.cancelWorkOpportunity(cNear.id, providerAUserId);
      cancelledNearJobId = cNear.id;

      // 4. Far Away Job (Whitefield, ~18 km away from MG Road)
      const far = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Far Away Whitefield Job",
        description: "18 km away in ITPL Whitefield.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1,
        location: { latitude: 12.985, longitude: 77.745 },
        addressApproximate: "ITPL Whitefield",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "14:00",
        durationHours: 4,
        paymentAmount: 900,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "PUBLISHED" as any,
      });
      farAwayJobId = far.id;
    });

    it("16. Worker sees published jobs within radius", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover?latitude=12.9716&longitude=77.5946&radiusKm=5")
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((j: any) => j.id);
      expect(ids).toContain(publishedNearJobId);
    });

    it("17. Worker does not see draft jobs", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover?latitude=12.9716&longitude=77.5946&radiusKm=5")
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((j: any) => j.id);
      expect(ids).not.toContain(draftNearJobId);
    });

    it("18. Worker does not see cancelled jobs", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover?latitude=12.9716&longitude=77.5946&radiusKm=5")
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((j: any) => j.id);
      expect(ids).not.toContain(cancelledNearJobId);
    });

    it("19. Category filter works", async () => {
      const res = await request(app)
        .get(`/api/v1/work-opportunities/discover?latitude=12.9716&longitude=77.5946&categoryId=${validCategoryId}`)
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(200);
      for (const job of res.body.data) {
        expect(job.categoryId).toBe(validCategoryId);
      }
    });

    it("20. Distance calculation works", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover?latitude=12.9716&longitude=77.5946&radiusKm=5")
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(200);
      const target = res.body.data.find((j: any) => j.id === publishedNearJobId);
      expect(target).toBeDefined();
      expect(typeof target.distanceKm).toBe("number");
      expect(target.distanceKm).toBeGreaterThan(0);
      expect(target.distanceKm).toBeLessThan(5);
    });

    it("21. Jobs outside radius excluded", async () => {
      const res = await request(app)
        .get("/api/v1/work-opportunities/discover?latitude=12.9716&longitude=77.5946&radiusKm=5")
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((j: any) => j.id);
      expect(ids).not.toContain(farAwayJobId);
    });
  });

  // =========================================================================
  // GROUP 4: Applications (Tests 22-29)
  // =========================================================================
  describe("Group 4: Applications (Tests 22-29)", () => {
    let applyTargetJobId: string;
    let draftApplyJobId: string;
    let cancelledApplyJobId: string;

    beforeAll(async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

      // Published job accepting applications
      const pub = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Application Target Job",
        description: "Open job for worker application testing.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 2,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "MG Road, Bangalore",
        workDate: tomorrow,
        startTime: "09:00",
        endTime: "13:00",
        durationHours: 4,
        paymentAmount: 800,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "PUBLISHED" as any,
      });
      applyTargetJobId = pub.id;

      // Draft job
      const dr = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Draft Job No Apply",
        description: "Draft job cannot be applied to.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "MG Road",
        workDate: tomorrow,
        startTime: "09:00",
        endTime: "13:00",
        durationHours: 4,
        paymentAmount: 800,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "DRAFT" as any,
      });
      draftApplyJobId = dr.id;

      // Cancelled job
      const cn = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Cancelled Job No Apply",
        description: "Cancelled job cannot be applied to.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "MG Road",
        workDate: tomorrow,
        startTime: "09:00",
        endTime: "13:00",
        durationHours: 4,
        paymentAmount: 800,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "PUBLISHED" as any,
      });
      await workOpportunitiesService.cancelWorkOpportunity(cn.id, providerAUserId);
      cancelledApplyJobId = cn.id;
    });

    it("22. Worker can apply to published job", async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${applyTargetJobId}/applications`)
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`)
        .send({
          proposedWage: 800,
          workerNotes: "[P5_TEST] Ready to start tomorrow morning.",
          workerLatitude: 12.9716,
          workerLongitude: 77.5946,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.workerId).toBe(workerAProfileId);
    });

    it("23. Worker cannot apply to draft job (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${draftApplyJobId}/applications`)
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`)
        .send({
          workerNotes: "[P5_TEST] Trying to apply to draft",
          workerLatitude: 12.9716,
          workerLongitude: 77.5946,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("draft");
    });

    it("24. Worker cannot apply to cancelled job (400)", async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${cancelledApplyJobId}/applications`)
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`)
        .send({
          workerNotes: "[P5_TEST] Trying to apply to cancelled",
          workerLatitude: 12.9716,
          workerLongitude: 77.5946,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("cancelled");
    });

    it("25. Worker cannot apply twice to same job (409)", async () => {
      // Worker A already applied in test 22
      const res = await request(app)
        .post(`/api/v1/jobs/${applyTargetJobId}/applications`)
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`)
        .send({
          workerNotes: "[P5_TEST] Duplicate application attempt",
          workerLatitude: 12.9716,
          workerLongitude: 77.5946,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("APPLICATION_DUPLICATE");
    });

    it("26. Concurrent duplicate applications handled safely (409)", async () => {
      // Worker B applies twice concurrently to applyTargetJobId
      const req1 = request(app)
        .post(`/api/v1/jobs/${applyTargetJobId}/applications`)
        .set("Authorization", `Bearer mock_token_${WORKER_B_AUTH}`)
        .send({
          workerNotes: "[P5_TEST] Concurrent test worker B attempt 1",
          workerLatitude: 12.9716,
          workerLongitude: 77.5946,
        });

      const req2 = request(app)
        .post(`/api/v1/jobs/${applyTargetJobId}/applications`)
        .set("Authorization", `Bearer mock_token_${WORKER_B_AUTH}`)
        .send({
          workerNotes: "[P5_TEST] Concurrent test worker B attempt 2",
          workerLatitude: 12.9716,
          workerLongitude: 77.5946,
        });

      const [res1, res2] = await Promise.all([req1, req2]);
      const statuses = [res1.status, res2.status];

      // One must succeed (201) and one must be rejected (409 Conflict)
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);
    });

    it("27. Worker cannot apply with missing auth (401)", async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${applyTargetJobId}/applications`)
        .send({
          workerNotes: "[P5_TEST] Missing auth",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("28. Provider cannot apply as worker to own job (400)", async () => {
      // Provider A attempts to apply to Provider A's own job
      const res = await request(app)
        .post(`/api/v1/jobs/${applyTargetJobId}/applications`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({
          workerNotes: "[P5_TEST] Provider applying to own job",
        });

      // Role check rejects (WORKER role required for applications) or self-check rejects
      expect([400, 403]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it("29. Application appears in worker's applications list", async () => {
      const res = await request(app)
        .get("/api/v1/applications/mine")
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const applied = res.body.data.find((a: any) => a.workOpportunityId === applyTargetJobId);
      expect(applied).toBeDefined();
      expect(applied.status).toBe("PENDING");
    });
  });

  // =========================================================================
  // GROUP 5: Applicant Review (Tests 30-33)
  // =========================================================================
  describe("Group 5: Applicant Review (Tests 30-33)", () => {
    let reviewJobId: string;

    beforeAll(async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const job = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Applicant Review Job",
        description: "Testing applicant review dashboard.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 3,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "MG Road, Bangalore",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "14:00",
        durationHours: 4,
        paymentAmount: 850,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "PUBLISHED" as any,
      });
      reviewJobId = job.id;

      // Worker A applies
      await applicationsService.applyForWork(workerAUserId, reviewJobId, {
        proposedWage: 850,
        workerNotes: "[P5_TEST] Experienced restaurant helper ready.",
        workerLatitude: 12.9716,
        workerLongitude: 77.5946,
      });
    });

    it("30. Provider sees applicants for own job", async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${reviewJobId}/applicants`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      const appItem = res.body.data.find((a: any) => a.workerUserId === workerAUserId);
      expect(appItem).toBeDefined();
      expect(appItem.workerFullName).toBe("Worker Charlie P5");
      expect(appItem.status).toBe("PENDING");
    });

    it("31. Provider cannot see applicants for another provider's job (403)", async () => {
      // Provider B attempts to view Provider A's applicants
      const res = await request(app)
        .get(`/api/v1/jobs/${reviewJobId}/applicants`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_B_AUTH}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("32. Worker cannot view provider applicant dashboard (403)", async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${reviewJobId}/applicants`)
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("33. Non-authenticated user cannot view applicants (401)", async () => {
      const res = await request(app).get(`/api/v1/jobs/${reviewJobId}/applicants`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  // =========================================================================
  // GROUP 6: Application Lifecycle & Concurrency (Tests 34-39)
  // =========================================================================
  describe("Group 6: Application Lifecycle & Concurrency (Tests 34-39)", () => {
    let lifecycleJobId: string;
    let applicationAId: string;
    let applicationBId: string;

    beforeAll(async () => {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      // Job with exactly 1 worker needed
      const job = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Capacity 1 Work Opportunity",
        description: "Job with capacity of exactly 1 worker.",
        categoryId: validCategoryId,
        workType: "SHIFT" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1, // Exactly 1
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "MG Road, Bangalore",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "14:00",
        durationHours: 4,
        paymentAmount: 777,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "PUBLISHED" as any,
      });
      lifecycleJobId = job.id;

      // Worker A applies
      const appA = await applicationsService.applyForWork(workerAUserId, lifecycleJobId, {
        proposedWage: 777,
        workerNotes: "[P5_TEST] Worker A lifecycle candidate",
        workerLatitude: 12.9716,
        workerLongitude: 77.5946,
      });
      applicationAId = appA.id;

      // Worker B applies
      const appB = await applicationsService.applyForWork(workerBUserId, lifecycleJobId, {
        proposedWage: 777,
        workerNotes: "[P5_TEST] Worker B lifecycle candidate",
        workerLatitude: 12.9716,
        workerLongitude: 77.5946,
      });
      applicationBId = appB.id;
    });

    it("34. Provider can shortlist applicant", async () => {
      const res = await request(app)
        .post(`/api/v1/applications/${applicationAId}/shortlist`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({ decisionNotes: "[P5_TEST] Shortlisted for interview" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("SHORTLISTED");
    });

    it("35. Provider can reject applicant", async () => {
      const res = await request(app)
        .post(`/api/v1/applications/${applicationBId}/reject`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({ decisionNotes: "[P5_TEST] Position filled by another candidate" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("REJECTED");
    });

    it("36. Provider can accept applicant", async () => {
      const res = await request(app)
        .post(`/api/v1/applications/${applicationAId}/accept`)
        .set("Authorization", `Bearer mock_token_${PROVIDER_A_AUTH}`)
        .send({ decisionNotes: "[P5_TEST] Accepted and hired!" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.status).toBe("ACCEPTED");
      expect(res.body.data.assignmentId).toBeTruthy();
    });

    it("37. Worker cannot accept themselves (403)", async () => {
      // Create fresh job and application to test self-acceptance denial
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      const freshJob = await workOpportunitiesService.createWorkOpportunity(providerAUserId, {
        title: "[P5_TEST] Self Accept Test Job",
        description: "Testing worker self-accept prohibition.",
        categoryId: validCategoryId,
        workType: "TASK" as any,
        urgency: "NORMAL" as any,
        workersNeeded: 1,
        location: { latitude: 12.9716, longitude: 77.5946 },
        addressApproximate: "MG Road",
        workDate: tomorrow,
        startTime: "10:00",
        endTime: "12:00",
        durationHours: 2,
        paymentAmount: 500,
        paymentType: "FIXED" as any,
        currency: "INR",
        status: "PUBLISHED" as any,
      });

      const freshApp = await applicationsService.applyForWork(workerAUserId, freshJob.id, {
        workerNotes: "[P5_TEST] Self accept test",
        workerLatitude: 12.9716,
        workerLongitude: 77.5946,
      });

      const res = await request(app)
        .post(`/api/v1/applications/${freshApp.id}/accept`)
        .set("Authorization", `Bearer mock_token_${WORKER_A_AUTH}`)
        .send({ decisionNotes: "Worker attempting to accept self" });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("38. Accepted applicant creates assignment in assignments table", async () => {
      const assignRes = await query<{
        id: string;
        work_opportunity_id: string;
        worker_id: string;
        provider_id: string;
        status: string;
        agreed_wage: number;
      }>(
        `SELECT id, work_opportunity_id, worker_id, provider_id, status, agreed_wage
         FROM assignments
         WHERE application_id = $1`,
        [applicationAId],
      );

      expect(assignRes.rows.length).toBe(1);
      const assignment = assignRes.rows[0];
      expect(assignment.work_opportunity_id).toBe(lifecycleJobId);
      expect(assignment.worker_id).toBe(workerAProfileId);
      expect(assignment.provider_id).toBe(providerAProfileId);
      expect(assignment.status).toBe("ASSIGNED");
      expect(Number(assignment.agreed_wage)).toBe(777);
    });

    it("39. Job capacity updates correctly when applicant accepted", async () => {
      const jobRes = await query<{
        workers_needed: number;
        workers_assigned: number;
        status: string;
      }>(
        `SELECT workers_needed, workers_assigned, status
         FROM work_opportunities
         WHERE id = $1`,
        [lifecycleJobId],
      );

      expect(jobRes.rows.length).toBe(1);
      const job = jobRes.rows[0];
      expect(Number(job.workers_needed)).toBe(1);
      expect(Number(job.workers_assigned)).toBe(1); // Capacity incremented
      expect(job.status).toBe("FILLED"); // Capacity filled
    });
  });
});
