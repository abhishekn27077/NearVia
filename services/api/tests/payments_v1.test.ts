import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import crypto from "crypto";
import { UserRole, WorkOpportunityStatus, AssignmentStatus } from "@nearvia/types";
import { apiRouter } from "../src/routes";
import { errorHandler, notFoundHandler } from "../src/middleware";
import { query } from "../src/db";
import { RazorpayPaymentProvider } from "../src/modules/payments/provider/razorpay.provider";

describe("NEARVIA Phase 14: Payments (Cash & Razorpay Sandbox) Test Suite", () => {
  let app: Express;

  // Test Auth Identifiers
  const PROVIDER_OWNER_AUTH = "p14_prov_owner";
  const PROVIDER_UNAUTH_AUTH = "p14_prov_unauth";
  const WORKER_PRIMARY_AUTH = "p14_work_primary";
  const WORKER_UNAUTH_AUTH = "p14_work_unauth";

  let providerOwnerUserId: string;
  let providerOwnerProfileId: string;
  let providerUnauthUserId: string;
  let providerUnauthProfileId: string;

  let workerPrimaryUserId: string;
  let workerPrimaryProfileId: string;
  let workerUnauthUserId: string;
  let workerUnauthProfileId: string;

  let testCategoryId: string;

  // Assignments for testing
  let settlementPendingJobId: string;
  let settlementPendingAssignmentId: string;

  let assignedJobId: string;
  let assignedAssignmentId: string;

  let onlineJobId: string;
  let onlineAssignmentId: string;

  let webhookJobId: string;
  let webhookAssignmentId: string;

  const JOB_LAT = 12.9716;
  const JOB_LNG = 77.5946;

  beforeAll(async () => {
    app = express();
    // Preserve rawBody as UTF-8 string for HMAC webhook tests
    app.use(
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString("utf-8");
        },
      })
    );
    app.use("/api/v1", apiRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Cleanup previous p14 test data
    const cleanup = async () => {
      await query(`DELETE FROM webhook_events WHERE event_id LIKE 'evt_p14_%'`);
      await query(
        `DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p14_%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p14_%')`
      );
      await query(
        `DELETE FROM attendance_records WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p14_%')`
      );
      await query(
        `DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P14_TEST]%')`
      );
      await query(
        `DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P14_TEST]%')`
      );
      await query(
        `DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P14_TEST]%')`
      );
      await query(
        `DELETE FROM work_opportunities WHERE title LIKE '%[P14_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p14_%')`
      );
      await query(
        `DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p14_%')`
      );
      await query(
        `DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p14_%')`
      );
      await query(
        `DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p14_%')`
      );
      await query(
        `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p14_%')`
      );
      await query(`DELETE FROM users WHERE auth_id LIKE 'p14_%'`);
    };

    await cleanup();

    // 1. Seed Category
    const catRes = await query<{ id: string }>(
      `INSERT INTO categories (name, slug, description, is_active)
       VALUES ('Payments Test Category [P14_TEST]', 'payments-p14', 'Payments Test Category', TRUE)
       ON CONFLICT (name) DO UPDATE SET is_active = TRUE
       RETURNING id`
    );
    testCategoryId = catRes.rows[0].id;

    // 2. Seed Provider Owner
    const provOwnerRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900140001', 'Provider Owner [P14]', 'owner_p14@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_OWNER_AUTH]
    );
    providerOwnerUserId = provOwnerRes.rows[0].id;

    const provOwnerProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'P14 Enterprises', 'Owner Provider [P14_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru')
       RETURNING id`,
      [providerOwnerUserId, JOB_LNG, JOB_LAT]
    );
    providerOwnerProfileId = provOwnerProfRes.rows[0].id;

    // 3. Seed Provider Unauth (for IDOR tests)
    const provUnauthRes = await query<{ id: string }>(
      `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
       VALUES ($1, '+919900140002', 'Provider Unauth [P14]', 'unauth_prov_p14@nearvia.test', 'PROVIDER', TRUE)
       RETURNING id`,
      [PROVIDER_UNAUTH_AUTH]
    );
    providerUnauthUserId = provUnauthRes.rows[0].id;

    const provUnauthProfRes = await query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, description, location, address_approximate)
       VALUES ($1, 'Rival Enterprise', 'Unauth Provider [P14_TEST]', ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Koramangala, Bengaluru')
       RETURNING id`,
      [providerUnauthUserId, JOB_LNG, JOB_LAT]
    );
    providerUnauthProfileId = provUnauthProfRes.rows[0].id;

    // 4. Seed Workers
    const createWorker = async (authId: string, phone: string, name: string) => {
      const uRes = await query<{ id: string }>(
        `INSERT INTO users (auth_id, phone, full_name, email, role, is_active)
         VALUES ($1, $2, $3, $4, 'WORKER', TRUE)
         RETURNING id`,
        [authId, phone, name, `${authId}@nearvia.test`]
      );
      const userId = uRes.rows[0].id;

      const wpRes = await query<{ id: string }>(
        `INSERT INTO worker_profiles (
           user_id, location, address_approximate,
           reliability_score, completed_tasks_count, total_ratings_count, average_rating,
           is_available_now, availability_status, verified_badge
         ) VALUES (
           $1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 'Indiranagar, Bengaluru',
           96.0, 15, 8, 4.9,
           TRUE, 'AVAILABLE_NOW', TRUE
         ) RETURNING id`,
        [userId, JOB_LNG, JOB_LAT]
      );
      return { userId, profileId: wpRes.rows[0].id };
    };

    const w1 = await createWorker(WORKER_PRIMARY_AUTH, "+919900140003", "Primary Worker [P14]");
    workerPrimaryUserId = w1.userId;
    workerPrimaryProfileId = w1.profileId;

    const w2 = await createWorker(WORKER_UNAUTH_AUTH, "+919900140004", "Unauth Worker [P14]");
    workerUnauthUserId = w2.userId;
    workerUnauthProfileId = w2.profileId;

    // Helper to seed job and assignment in specified states
    const seedJobAndAssignment = async (params: {
      title: string;
      jobStatus: WorkOpportunityStatus;
      assignmentStatus: AssignmentStatus;
      agreedWage: number;
    }) => {
      const jobRes = await query<{ id: string }>(
        `INSERT INTO work_opportunities (
           provider_id, category_id, title, description, work_type, urgency, status,
           workers_needed, workers_assigned, location, address_approximate,
           work_date, start_time, end_time, duration_hours, payment_amount, payment_type
         ) VALUES (
           $1, $2, $3, 'Test Job Description', 'TASK', 'NORMAL', $4,
           1, 1, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, 'Indiranagar, Bengaluru',
           CURRENT_DATE, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour', 3, $7, 'FIXED'
         ) RETURNING id`,
        [
          providerOwnerProfileId,
          testCategoryId,
          params.title,
          params.jobStatus,
          JOB_LNG,
          JOB_LAT,
          params.agreedWage,
        ]
      );
      const jobId = jobRes.rows[0].id;

      const asgnRes = await query<{ id: string }>(
        `INSERT INTO assignments (
           work_opportunity_id, worker_id, provider_id, status, agreed_wage,
           assigned_at, confirmed_at, checked_in_at, completed_at, payment_status
         ) VALUES (
           $1, $2, $3, $4, $5,
           NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours',
           NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', 'PENDING'
         ) RETURNING id`,
        [
          jobId,
          workerPrimaryProfileId,
          providerOwnerProfileId,
          params.assignmentStatus,
          params.agreedWage,
        ]
      );
      return { jobId, assignmentId: asgnRes.rows[0].id };
    };

    // 1. Settlement Pending Job (for Cash & Direct Tests)
    const j1 = await seedJobAndAssignment({
      title: "Settlement Pending Job [P14_TEST]",
      jobStatus: WorkOpportunityStatus.SETTLEMENT_PENDING,
      assignmentStatus: AssignmentStatus.SETTLEMENT_PENDING,
      agreedWage: 750.0,
    });
    settlementPendingJobId = j1.jobId;
    settlementPendingAssignmentId = j1.assignmentId;

    // 2. Assigned Job (invalid state for payment)
    const j2 = await seedJobAndAssignment({
      title: "Active Assigned Job [P14_TEST]",
      jobStatus: WorkOpportunityStatus.FILLED,
      assignmentStatus: AssignmentStatus.ASSIGNED,
      agreedWage: 500.0,
    });
    assignedJobId = j2.jobId;
    assignedAssignmentId = j2.assignmentId;

    // 3. Completed Job for Online / Razorpay Sandbox tests
    const j3 = await seedJobAndAssignment({
      title: "Online Sandbox Job [P14_TEST]",
      jobStatus: WorkOpportunityStatus.SETTLEMENT_PENDING,
      assignmentStatus: AssignmentStatus.SETTLEMENT_PENDING,
      agreedWage: 1200.0,
    });
    onlineJobId = j3.jobId;
    onlineAssignmentId = j3.assignmentId;

    // 4. Completed Job for Webhook test
    const j4 = await seedJobAndAssignment({
      title: "Webhook Gateway Job [P14_TEST]",
      jobStatus: WorkOpportunityStatus.SETTLEMENT_PENDING,
      assignmentStatus: AssignmentStatus.SETTLEMENT_PENDING,
      agreedWage: 850.0,
    });
    webhookJobId = j4.jobId;
    webhookAssignmentId = j4.assignmentId;
  });

  afterAll(async () => {
    // Cleanup p14 test data
    await query(`DELETE FROM webhook_events WHERE event_id LIKE 'evt_p14_%'`);
    await query(
      `DELETE FROM payment_records WHERE payer_id IN (SELECT id FROM users WHERE auth_id LIKE 'p14_%') OR payee_id IN (SELECT id FROM users WHERE auth_id LIKE 'p14_%')`
    );
    await query(
      `DELETE FROM attendance_records WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p14_%')`
    );
    await query(
      `DELETE FROM assignments WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P14_TEST]%')`
    );
    await query(
      `DELETE FROM applications WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P14_TEST]%')`
    );
    await query(
      `DELETE FROM work_opportunity_skills WHERE work_opportunity_id IN (SELECT id FROM work_opportunities WHERE title LIKE '%[P14_TEST]%')`
    );
    await query(
      `DELETE FROM work_opportunities WHERE title LIKE '%[P14_TEST]%' OR provider_id IN (SELECT pp.id FROM provider_profiles pp JOIN users u ON u.id = pp.user_id WHERE u.auth_id LIKE 'p14_%')`
    );
    await query(
      `DELETE FROM worker_skills WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p14_%')`
    );
    await query(
      `DELETE FROM worker_availability WHERE worker_id IN (SELECT wp.id FROM worker_profiles wp JOIN users u ON u.id = wp.user_id WHERE u.auth_id LIKE 'p14_%')`
    );
    await query(
      `DELETE FROM worker_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p14_%')`
    );
    await query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE auth_id LIKE 'p14_%')`
    );
    await query(`DELETE FROM users WHERE auth_id LIKE 'p14_%'`);
  });

  // --------------------------------------------------------------------------
  // TEST 1: Target Not Found (404)
  // --------------------------------------------------------------------------
  it("Test 1: Returns 404 when target assignment does not exist", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res1 = await request(app)
      .post(`/api/v1/payments/assignments/${fakeId}/pay`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send({ paymentMethod: "ONLINE" });
    expect(res1.status).toBe(404);

    const res2 = await request(app)
      .post(`/api/v1/payments/assignments/${fakeId}/cash/initiate`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send();
    expect(res2.status).toBe(404);

    const res3 = await request(app)
      .get(`/api/v1/payments/${fakeId}/receipt`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`);
    expect(res3.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // TEST 2: IDOR Protection (403 Forbidden)
  // --------------------------------------------------------------------------
  it("Test 2: Rejects unauthorized provider or worker from initiating or confirming payments (403)", async () => {
    // Unrelated provider tries to initiate cash payment
    const res1 = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/initiate`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_UNAUTH_AUTH}`)
      .send();
    expect(res1.status).toBe(403);
    expect(res1.body.success).toBe(false);

    // Unrelated worker tries to confirm cash payment
    const res2 = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/confirm`)
      .set("Authorization", `Bearer mock_token_${WORKER_UNAUTH_AUTH}`)
      .send({ pin: "1234" });
    expect(res2.status).toBe(403);
    expect(res2.body.success).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Invalid State Rejection (400)
  // --------------------------------------------------------------------------
  it("Test 3: Rejects payment initiation when assignment is not completed/settlement pending (400)", async () => {
    const res = await request(app)
      .post(`/api/v1/payments/assignments/${assignedAssignmentId}/cash/initiate`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.message).toMatch(/cannot initiate payment for assignment in .* status/i);
  });

  // --------------------------------------------------------------------------
  // TEST 4 & 5: CASH Initiation & Authoritative Wage (PIN Generation)
  // --------------------------------------------------------------------------
  let generatedCashPin: string;
  let cashPaymentId: string;

  it("Test 4 & 5: Provider initiates CASH payment with authoritative wage calculation and receives 4-digit PIN", async () => {
    // Even if client passes a spoofed amount of 50.00, server must calculate 750.00
    const res = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/initiate`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send({ amount: 50.0 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const pin = res.body.data.paymentPin || res.body.data.pin;
    expect(pin).toBeDefined();
    expect(pin).toMatch(/^\d{4}$/); // Exactly 4 numeric digits
    generatedCashPin = pin;

    expect(res.body.data.payment).toBeDefined();
    expect(res.body.data.payment.amount).toBe(750.0); // Computed from assignment.agreed_wage!
    expect(res.body.data.payment.paymentMethod).toBe("CASH");
    expect(res.body.data.payment.status).toBe("PENDING");
    cashPaymentId = res.body.data.payment.id;

    // Verify PIN is securely saved in database
    const dbCheck = await query<{ payment_pin: string; payment_pin_attempts: number }>(
      `SELECT payment_pin, payment_pin_attempts FROM payment_records WHERE id = $1`,
      [cashPaymentId]
    );
    expect(dbCheck.rows[0].payment_pin).toBe(generatedCashPin);
    expect(dbCheck.rows[0].payment_pin_attempts).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST 6: CASH Wrong PIN Attempts and Lockout (429)
  // --------------------------------------------------------------------------
  it("Test 6: Worker enters wrong PIN and gets locked out after max attempts (429)", async () => {
    // Attempt 1: Wrong PIN
    const res1 = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/confirm`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({ pin: "0000" });
    expect(res1.status).toBe(400);
    expect(res1.body.error?.message).toMatch(/invalid.*pin/i);

    // Attempt 2: Wrong PIN
    const res2 = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/confirm`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({ pin: "1111" });
    expect(res2.status).toBe(400);

    // Attempt 3: Wrong PIN -> Lockout
    const res3 = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/confirm`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({ pin: "2222" });
    expect(res3.status).toBe(429);
    expect(res3.body.error?.message).toMatch(/too many failed pin attempts/i);

    // Attempt 4: Even correct PIN is now locked out
    const res4 = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/confirm`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({ pin: generatedCashPin });
    expect(res4.status).toBe(429);
  });

  // --------------------------------------------------------------------------
  // TEST 7: CASH Correct PIN Confirmation and Lifecycle Transition
  // --------------------------------------------------------------------------
  it("Test 7: Re-initiated cash payment confirms with correct PIN and transitions assignment to CLOSED and job to PAID", async () => {
    // Provider re-initiates to generate fresh PIN and reset lockout
    const reinitRes = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/initiate`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send();
    expect(reinitRes.status).toBe(200);
    const validPin = reinitRes.body.data.paymentPin || reinitRes.body.data.pin;

    // Worker enters valid PIN
    const confRes = await request(app)
      .post(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/cash/confirm`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`)
      .send({ pin: validPin });

    expect(confRes.status).toBe(200);
    expect(confRes.body.success).toBe(true);
    expect(confRes.body.data.status).toBe("CONFIRMED");

    // Verify DB state
    const asgnCheck = await query(
      `SELECT status, payment_status FROM assignments WHERE id = $1`,
      [settlementPendingAssignmentId]
    );
    expect(asgnCheck.rows[0].status).toBe("CLOSED");
    expect(asgnCheck.rows[0].payment_status).toBe("CONFIRMED");

    const jobCheck = await query(
      `SELECT status FROM work_opportunities WHERE id = $1`,
      [settlementPendingJobId]
    );
    expect(jobCheck.rows[0].status).toBe("PAID");
  });

  // --------------------------------------------------------------------------
  // TEST 8: RAZORPAY Sandbox Order Creation
  // --------------------------------------------------------------------------
  let onlinePaymentId: string;
  let onlineOrderId: string;

  it("Test 8: Initiates Razorpay sandbox order with minor unit integer wage (paise)", async () => {
    const res = await request(app)
      .post(`/api/v1/payments/assignments/${onlineAssignmentId}/pay`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send({ paymentMethod: "ONLINE" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payment).toBeDefined();
    expect(res.body.data.payment.amount).toBe(1200.0);
    expect(res.body.data.payment.status).toBe("PENDING");

    expect(res.body.data.order).toBeDefined();
    const orderObj = res.body.data.order;
    expect(orderObj.amountPaise).toBe(120000); // 1200 INR = 120,000 paise!
    expect(orderObj.currency).toBe("INR");

    onlinePaymentId = res.body.data.payment.id;
    onlineOrderId = orderObj.gatewayOrderId || orderObj.id;
  });

  // --------------------------------------------------------------------------
  // TEST 9: RAZORPAY Signature Verification Failure (400)
  // --------------------------------------------------------------------------
  it("Test 9: Rejects online confirmation with invalid HMAC signature (400)", async () => {
    const res = await request(app)
      .post(`/api/v1/payments/${onlinePaymentId}/confirm`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send({
        transactionRef: "pay_test_fake_123",
        paymentMethod: "ONLINE",
        razorpayPaymentId: "pay_test_fake_123",
        razorpayOrderId: onlineOrderId,
        razorpaySignature: "invalid_tampered_signature_hex",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.message).toMatch(/invalid razorpay payment signature/i);
  });

  // --------------------------------------------------------------------------
  // TEST 10: RAZORPAY Sandbox Direct Confirmation Success
  // --------------------------------------------------------------------------
  it("Test 10: Confirms sandbox payment and closes assignment and job", async () => {
    const res = await request(app)
      .post(`/api/v1/payments/${onlinePaymentId}/confirm`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send({
        transactionRef: `pay_sbx_${Date.now()}`,
        paymentMethod: "ONLINE",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status || res.body.data.payment?.status).toBe("CONFIRMED");

    // Assignment must be CLOSED
    const asgnCheck = await query(
      `SELECT status, payment_status FROM assignments WHERE id = $1`,
      [onlineAssignmentId]
    );
    expect(asgnCheck.rows[0].status).toBe("CLOSED");
    expect(asgnCheck.rows[0].payment_status).toBe("CONFIRMED");

    // Opportunity must be PAID
    const jobCheck = await query(
      `SELECT status FROM work_opportunities WHERE id = $1`,
      [onlineJobId]
    );
    expect(jobCheck.rows[0].status).toBe("PAID");
  });

  // --------------------------------------------------------------------------
  // TEST 11 & 12: Webhook Processing and Replay Idempotency Defense
  // --------------------------------------------------------------------------
  it("Test 11 & 12: Webhook confirms payment and defends against duplicate replay via webhook_events", async () => {
    // 1. Create a payment record for webhook testing
    const initRes = await request(app)
      .post(`/api/v1/payments/assignments/${webhookAssignmentId}/pay`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send({ paymentMethod: "ONLINE" });

    const whPaymentId = initRes.body.data.payment.id;
    const whOrderObj = initRes.body.data.order || initRes.body.data.razorpayOrder;
    const whOrderId = whOrderObj.gatewayOrderId || whOrderObj.id;

    const eventId = `evt_p14_${Date.now()}`;
    const webhookPayload = {
      entity: "event",
      account_id: "acc_sandbox_test",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: `pay_wh_${Date.now()}`,
            order_id: whOrderId,
            amount: 85000,
            currency: "INR",
            status: "captured",
            method: "upi",
            notes: {
              paymentId: whPaymentId,
              assignmentId: webhookAssignmentId,
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const rawPayload = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac("sha256", "nearvia_sandbox_webhook_secret_key_2026")
      .update(rawPayload)
      .digest("hex");

    // First Webhook Delivery: Processed
    const res1 = await request(app)
      .post("/api/v1/payments/webhook")
      .set("x-razorpay-signature", signature)
      .set("x-razorpay-event-id", eventId)
      .send(webhookPayload);

    expect(res1.status).toBe(200);
    expect(res1.body.data.processed).toBe(true);

    // Verify DB updated
    const asgnCheck = await query(
      `SELECT status, payment_status FROM assignments WHERE id = $1`,
      [webhookAssignmentId]
    );
    expect(asgnCheck.rows[0].status).toBe("CLOSED");
    expect(asgnCheck.rows[0].payment_status).toBe("CONFIRMED");

    const jobCheck = await query(
      `SELECT status FROM work_opportunities WHERE id = $1`,
      [webhookJobId]
    );
    expect(jobCheck.rows[0].status).toBe("PAID");

    // Second Webhook Delivery (Replay Attack / Duplicate Retry)
    const res2 = await request(app)
      .post("/api/v1/payments/webhook")
      .set("x-razorpay-signature", signature)
      .set("x-razorpay-event-id", eventId)
      .send(webhookPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.data.processed).toBe(true);
    expect(res2.body.data.duplicate).toBe(true); // Identified duplicate replay!
  });

  // --------------------------------------------------------------------------
  // TEST 13: Payment Failure Handling
  // --------------------------------------------------------------------------
  it("Test 13: Webhook payment.failed marks payment record FAILED without closing assignment", async () => {
    // Seed new settlement pending job
    const failJob = await query<{ id: string }>(
      `INSERT INTO work_opportunities (
         provider_id, category_id, title, description, work_type, urgency, status,
         workers_needed, workers_assigned, location, address_approximate,
         work_date, start_time, end_time, duration_hours, payment_amount, payment_type
       ) VALUES (
         $1, $2, 'Failed Payment Job [P14_TEST]', 'Test Job', 'TASK', 'NORMAL', 'SETTLEMENT_PENDING',
         1, 1, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, 'Indiranagar, Bengaluru',
         CURRENT_DATE, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 1, 600.00, 'FIXED'
       ) RETURNING id`,
      [providerOwnerProfileId, testCategoryId, JOB_LNG, JOB_LAT]
    );
    const failJobId = failJob.rows[0].id;

    const failAsgn = await query<{ id: string }>(
      `INSERT INTO assignments (
         work_opportunity_id, worker_id, provider_id, status, agreed_wage,
         payment_status
       ) VALUES (
         $1, $2, $3, 'SETTLEMENT_PENDING', 600.00, 'PENDING'
       ) RETURNING id`,
      [failJobId, workerPrimaryProfileId, providerOwnerProfileId]
    );
    const failAssignmentId = failAsgn.rows[0].id;

    // Create payment order
    const payRes = await request(app)
      .post(`/api/v1/payments/assignments/${failAssignmentId}/pay`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`)
      .send({ paymentMethod: "ONLINE" });

    const payId = payRes.body.data.payment.id;
    const payOrderObj = payRes.body.data.order || payRes.body.data.razorpayOrder;
    const orderId = payOrderObj.gatewayOrderId || payOrderObj.id;

    // Send payment.failed webhook
    const failEventId = `evt_p14_fail_${Date.now()}`;
    const failWebhook = {
      entity: "event",
      account_id: "acc_sandbox_test",
      event: "payment.failed",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: `pay_fail_${Date.now()}`,
            order_id: orderId,
            amount: 60000,
            currency: "INR",
            status: "failed",
            error_code: "BAD_REQUEST_ERROR",
            error_description: "Payment declined by customer bank in test sandbox",
            notes: {
              paymentId: payId,
              assignmentId: failAssignmentId,
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const failRaw = JSON.stringify(failWebhook);
    const failSig = crypto
      .createHmac("sha256", "nearvia_sandbox_webhook_secret_key_2026")
      .update(failRaw)
      .digest("hex");

    const res = await request(app)
      .post("/api/v1/payments/webhook")
      .set("x-razorpay-signature", failSig)
      .set("x-razorpay-event-id", failEventId)
      .send(failWebhook);

    expect(res.status).toBe(200);

    // Verify payment is FAILED
    const payCheck = await query(`SELECT status FROM payment_records WHERE id = $1`, [payId]);
    expect(payCheck.rows[0].status).toBe("FAILED");

    // Assignment remains SETTLEMENT_PENDING (NOT closed)
    const asgnCheck = await query(
      `SELECT status, payment_status FROM assignments WHERE id = $1`,
      [failAssignmentId]
    );
    expect(asgnCheck.rows[0].status).toBe("SETTLEMENT_PENDING");
    expect(asgnCheck.rows[0].payment_status).toBe("FAILED");
  });

  // --------------------------------------------------------------------------
  // TEST 14: Payment Receipt Generation and Sandbox Badge
  // --------------------------------------------------------------------------
  it("Test 14: Generates authoritative payment receipt with wage breakdown and sandbox flag", async () => {
    // 1. Cash Receipt
    const cashReceiptRes = await request(app)
      .get(`/api/v1/payments/assignments/${settlementPendingAssignmentId}/receipt`)
      .set("Authorization", `Bearer mock_token_${PROVIDER_OWNER_AUTH}`);

    expect(cashReceiptRes.status).toBe(200);
    expect(cashReceiptRes.body.success).toBe(true);
    const cashReceipt = cashReceiptRes.body.data;
    expect(cashReceipt.receiptNumber).toMatch(/^REC-[A-Z0-9]+/);
    expect(cashReceipt.amount).toBe(750.0);
    expect(cashReceipt.platformFee).toBe(0);
    expect(cashReceipt.netPayout).toBe(750.0);
    expect(cashReceipt.paymentMethod).toBe("CASH");
    expect(cashReceipt.isSandboxTest).toBe(false);
    expect(cashReceipt.disclaimer).toMatch(/physical cash|peer-to-peer/i);

    // 2. Online Sandbox Receipt
    const onlineReceiptRes = await request(app)
      .get(`/api/v1/payments/assignments/${onlineAssignmentId}/receipt`)
      .set("Authorization", `Bearer mock_token_${WORKER_PRIMARY_AUTH}`);

    expect(onlineReceiptRes.status).toBe(200);
    expect(onlineReceiptRes.body.success).toBe(true);
    const onlineReceipt = onlineReceiptRes.body.data;
    expect(onlineReceipt.amount).toBe(1200.0);
    expect(onlineReceipt.paymentMethod).toBe("ONLINE");
    expect(onlineReceipt.isSandboxTest).toBe(true);
    expect(onlineReceipt.disclaimer).toMatch(/sandbox/i);
  });
});
