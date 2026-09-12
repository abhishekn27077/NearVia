/**
 * Payments Domain Service (Phase 7)
 * Handles end-to-end wage settlement:
 * - CASH payments with dual-confirmation & secure 4-digit Payment PIN
 * - ONLINE payments with Razorpay Sandbox / Demo providers
 * - Canonical payment receipts with explicit disclaimers
 * - Worker earnings breakdown (today, this week, this month)
 * - Provider payment history with server-side filtering
 * - Payment disputes integration & automated reconciliation
 *
 * All money arithmetic strictly uses integer minor units (paise) to eliminate floating point issues.
 */

import { query, withTransaction } from "../../db";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { defaultPaymentProvider } from "./provider/sandbox.provider";
import { RazorpayPaymentProvider, defaultRazorpayProvider } from "./provider/razorpay.provider";
import { PaymentProvider } from "./provider/payment.provider";
import { logAuditEvent } from "../../utils/audit";
import {
  InitiatePaymentInput,
  InitiateCashPaymentInput,
  ConfirmCashPaymentInput,
  ConfirmPaymentInput,
  RefundPaymentInput,
  DisputePaymentInput,
  PaymentRecordResponse,
  PaymentReceipt,
  WorkerEarningsSummary,
  ProviderPaymentsSummary,
  PayableAssignmentItem,
  PaymentOrderResult,
  PaymentReconciliationReport,
} from "./types";

export class PaymentsService {
  constructor(
    private readonly provider: PaymentProvider = process.env.PAYMENT_MODE === "sandbox"
      ? defaultRazorpayProvider
      : defaultPaymentProvider
  ) {}

  // ──────────────────────────────────────────────────
  // 1. INITIATE ONLINE PAYMENT FOR COMPLETED ASSIGNMENT
  // ──────────────────────────────────────────────────

  async initiatePayment(
    payerUserId: string,
    assignmentId: string,
    input: InitiatePaymentInput
  ): Promise<{ payment: PaymentRecordResponse; order: PaymentOrderResult }> {
    const assignment = await this.validateAssignmentForPayment(assignmentId, payerUserId);

    // Calculate integer minor units (Paise: 1 INR = 100 paise)
    const agreedWageFloat = Number(assignment.agreed_wage);
    if (isNaN(agreedWageFloat) || agreedWageFloat <= 0) {
      throw new AppError("Invalid assignment wage amount", 400, ErrorCode.VALIDATION_ERROR);
    }
    const amountPaise = Math.round(agreedWageFloat * 100);
    const amountINR = amountPaise / 100;
    const platformFeePaise = 0; // Configurable platform commission (currently ₹0)
    const netPayoutPaise = amountPaise - platformFeePaise;

    // Create order with the payment provider
    const order = await this.provider.createOrder({
      orderId: assignment.id,
      assignmentId: assignment.id,
      amountPaise,
      currency: "INR",
      payerUserId,
      payeeUserId: assignment.worker_user_id,
      description: `Wage settlement for ${assignment.opportunity_title}`,
    });

    const method = input.paymentMethod || "UPI";

    // Check if existing payment record exists for this assignment
    const existingPayment = await query<{ id: string; status: string }>(
      `SELECT id, status FROM payment_records WHERE assignment_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [assignmentId]
    );

    const firstExisting = existingPayment.rows[0];
    let record: any;
    if (firstExisting && firstExisting.status === "CONFIRMED") {
      throw new AppError(
        "Payment for this assignment is already confirmed",
        400,
        ErrorCode.PAYMENT_ALREADY_CONFIRMED
      );
    }

    if (firstExisting && firstExisting.status === "PENDING") {
      const updateRes = await query(
        `UPDATE payment_records
         SET amount = $1,
             amount_paise = $2,
             platform_fee = 0.00,
             platform_fee_paise = $3,
             net_payout = $1,
             net_payout_paise = $4,
             status = 'PENDING',
             payment_method = $5,
             gateway_order_id = $6,
             transaction_ref = $6,
             idempotency_key = COALESCE($7, idempotency_key),
             notes = $8,
             updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          amountINR,
          amountPaise,
          platformFeePaise,
          netPayoutPaise,
          method,
          order.gatewayOrderId,
          input.idempotencyKey || null,
          `Online wage payment for ${assignment.opportunity_title}`,
          firstExisting.id,
        ]
      );
      record = updateRes.rows[0];
    } else {
      const insertRes = await query(
        `INSERT INTO payment_records (
           assignment_id, payer_id, payee_id, amount, amount_paise, platform_fee, platform_fee_paise,
           net_payout, net_payout_paise, currency, status, payment_method, transaction_ref,
           gateway_order_id, idempotency_key, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'INR', 'PENDING', $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          assignmentId,
          payerUserId,
          assignment.worker_user_id,
          amountINR,
          amountPaise,
          0.0,
          platformFeePaise,
          amountINR,
          netPayoutPaise,
          method,
          order.gatewayOrderId,
          order.gatewayOrderId,
          input.idempotencyKey || null,
          `Online wage payment for ${assignment.opportunity_title}`,
        ]
      );
      record = insertRes.rows[0];
    }

    if (!record) {
      throw new AppError("Failed to create payment record", 500, ErrorCode.INTERNAL_SERVER_ERROR);
    }

    // Update assignment method
    await query(`UPDATE assignments SET payment_method = $1 WHERE id = $2`, [method, assignmentId]);

    // Send notification to worker
    try {
      await query(
        `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
        [
          assignment.worker_user_id,
          "PAYMENT_INITIATED",
          "Payment Initiated",
          `Employer has initiated online wage payment of ₹${amountINR.toFixed(2)} for ${assignment.opportunity_title}.`,
          JSON.stringify({ assignmentId, amountINR, paymentId: record.id }),
        ]
      );
    } catch {}

    try {
      await logAuditEvent({
        actorId: payerUserId,
        action: "ONLINE_PAYMENT_INITIATED",
        targetEntity: "payment_records",
        targetId: record.id,
        newValues: { assignmentId, amountINR, gatewayOrderId: order.gatewayOrderId, method },
      });
    } catch {}

    const normalizedOrder: PaymentOrderResult = {
      ...order,
      id: order.gatewayOrderId,
      amount: order.amountPaise,
    };

    return {
      payment: this.mapRowToResponse(record, assignment.opportunity_title),
      order: normalizedOrder,
      razorpayOrder: normalizedOrder,
    } as any;
  }

  // ──────────────────────────────────────────────────
  // 2. CASH PAYMENT: INITIATE & GENERATE PAYMENT PIN
  // ──────────────────────────────────────────────────

  async initiateCashPayment(
    payerUserId: string,
    assignmentId: string,
    input: InitiateCashPaymentInput
  ): Promise<{ payment: PaymentRecordResponse; paymentPin: string; message: string }> {
    const assignment = await this.validateAssignmentForPayment(assignmentId, payerUserId);

    const agreedWageFloat = Number(assignment.agreed_wage);
    const amountPaise = Math.round(agreedWageFloat * 100);
    const amountINR = amountPaise / 100;
    const platformFeePaise = 0;
    const netPayoutPaise = amountPaise - platformFeePaise;

    // Generate secure 4-digit Payment PIN (1000 - 9999)
    const paymentPin = String(Math.floor(1000 + Math.random() * 9000));

    const result = await withTransaction(async (client) => {
      // Check if existing pending cash payment record exists
      const existingPay = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM payment_records WHERE assignment_id = $1 FOR UPDATE`,
        [assignmentId]
      );

      let record: any;
      const firstExisting = existingPay.rows[0];
      if (firstExisting) {
        if (firstExisting.status === "CONFIRMED") {
          throw new AppError(
            "Payment for this assignment is already confirmed",
            400,
            ErrorCode.PAYMENT_ALREADY_CONFIRMED
          );
        }

        const updateRes = await client.query(
          `UPDATE payment_records
           SET amount = $1,
               amount_paise = $2,
               platform_fee = 0.00,
               platform_fee_paise = $3,
               net_payout = $1,
               net_payout_paise = $4,
               status = 'PENDING',
               payment_method = 'CASH',
               payment_pin = $5,
               payment_pin_attempts = 0,
               cash_confirmed_by_payer_at = NOW(),
               notes = $6,
               updated_at = NOW()
           WHERE id = $7
           RETURNING *`,
          [
            amountINR,
            amountPaise,
            platformFeePaise,
            netPayoutPaise,
            paymentPin,
            input.notes || `Cash payment initiated by employer for ${assignment.opportunity_title}`,
            firstExisting.id,
          ]
        );
        record = updateRes.rows[0];
      } else {
        const insertRes = await client.query(
          `INSERT INTO payment_records (
             assignment_id, payer_id, payee_id, amount, amount_paise, platform_fee, platform_fee_paise,
             net_payout, net_payout_paise, currency, status, payment_method, transaction_ref,
             payment_pin, payment_pin_attempts, cash_confirmed_by_payer_at, notes
           ) VALUES ($1, $2, $3, $4, $5, 0.00, $6, $4, $7, 'INR', 'PENDING', 'CASH', $8, $9, 0, NOW(), $10)
           RETURNING *`,
          [
            assignmentId,
            payerUserId,
            assignment.worker_user_id,
            amountINR,
            amountPaise,
            platformFeePaise,
            netPayoutPaise,
            `cash_${Date.now()}`,
            paymentPin,
            input.notes || `Cash payment initiated by employer for ${assignment.opportunity_title}`,
          ]
        );
        record = insertRes.rows[0];
      }

      // Update assignment method and keep status as PENDING until worker confirms receipt
      await client.query(
        `UPDATE assignments
         SET payment_status = 'PENDING',
             payment_method = 'CASH',
             updated_at = NOW()
         WHERE id = $1`,
        [assignmentId]
      );

      return record;
    });

    // Notify worker
    try {
      await query(
        `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
        [
          assignment.worker_user_id,
          "CASH_PAYMENT_INITIATED",
          "Cash Payment Handover",
          `Employer has prepared cash payment of ₹${amountINR.toFixed(2)}. Please ask employer for the 4-digit Payment PIN upon receiving cash.`,
          JSON.stringify({ assignmentId, amountINR, paymentId: result.id }),
        ]
      );
    } catch {}

    try {
      await logAuditEvent({
        actorId: payerUserId,
        action: "CASH_PAYMENT_INITIATED",
        targetEntity: "payment_records",
        targetId: result.id,
        newValues: { assignmentId, amountINR, paymentMethod: "CASH" },
      });
    } catch {}

    const resp = this.mapRowToResponse(result, assignment.opportunity_title);
    resp.paymentPin = paymentPin; // Provider sees PIN to give to worker

    return {
      payment: resp,
      paymentPin,
      message: "Cash payment initiated. Hand over physical cash to the worker and provide the 4-digit Payment PIN to confirm receipt.",
    };
  }

  // ──────────────────────────────────────────────────
  // 3. CASH PAYMENT: WORKER CONFIRMS RECEIPT WITH PIN
  // ──────────────────────────────────────────────────

  async confirmCashPayment(
    workerUserId: string,
    assignmentId: string,
    input: ConfirmCashPaymentInput
  ): Promise<PaymentRecordResponse> {
    return await withTransaction(async (client) => {
      // 1. Fetch assignment details
      const assignRes = await client.query<{
        id: string;
        status: string;
        agreed_wage: number;
        payment_status: string;
        work_opportunity_id: string;
        worker_user_id: string;
        provider_user_id: string;
        opportunity_title: string;
      }>(
        `SELECT 
           a.id, a.status, a.agreed_wage, a.payment_status, a.work_opportunity_id,
           w.user_id AS worker_user_id,
           p.user_id AS provider_user_id,
           wo.title AS opportunity_title
         FROM assignments a
         JOIN worker_profiles w ON a.worker_id = w.id
         JOIN provider_profiles p ON a.provider_id = p.id
         JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
         WHERE a.id = $1`,
        [assignmentId]
      );

      const assignment = assignRes.rows[0];
      if (!assignment) {
        throw new AppError("Assignment not found", 404, ErrorCode.NOT_FOUND);
      }

      // Authorization: caller must be the assigned worker
      if (assignment.worker_user_id !== workerUserId) {
        throw new AppError(
          "Only the assigned worker can confirm cash receipt",
          403,
          ErrorCode.UNAUTHORIZED_PAYMENT_ACTION
        );
      }

      // Ensure assignment is not under active dispute
      if (assignment.payment_status === "DISPUTED") {
        throw new AppError(
          "Cannot confirm cash payment for an assignment under active dispute. Dispute must be resolved first.",
          409,
          ErrorCode.PAYMENT_DISPUTED
        );
      }

      const openDispute = await client.query(
        `SELECT id FROM disputes WHERE assignment_id = $1 AND status IN ('OPEN', 'INVESTIGATING', 'UNDER_REVIEW') LIMIT 1`,
        [assignmentId]
      );
      if (openDispute?.rows && openDispute.rows.length > 0) {
        throw new AppError(
          "Cannot confirm cash payment for an assignment with an open dispute. Dispute must be resolved first.",
          409,
          ErrorCode.PAYMENT_DISPUTED
        );
      }

      // 2. Fetch pending cash payment record
      const payRes = await client.query<{
        id: string;
        payment_pin: string | null;
        payment_pin_attempts: number;
        status: string;
        amount: number;
      }>(
        `SELECT id, payment_pin, payment_pin_attempts, status, amount
         FROM payment_records
         WHERE assignment_id = $1`,
        [assignmentId]
      );

      const payment = payRes.rows[0];
      if (!payment) {
        throw new AppError(
          "No cash payment transaction initiated for this assignment",
          404,
          ErrorCode.NOT_FOUND
        );
      }

      if (payment.status === "CONFIRMED") {
        throw new AppError(
          "Cash payment has already been confirmed",
          400,
          ErrorCode.PAYMENT_ALREADY_CONFIRMED
        );
      }

      // Check existing attempts limit
      if ((payment.payment_pin_attempts || 0) >= 3) {
        throw new AppError(
          "Too many failed PIN attempts. Maximum PIN verification attempts exceeded (3/3). Please re-initiate cash payment.",
          429,
          ErrorCode.PAYMENT_PIN_MAX_ATTEMPTS_EXCEEDED
        );
      }

      // Validate PIN
      const pinToVerify = (input.paymentPin || (input as any).pin || "").trim();
      if (!payment.payment_pin || payment.payment_pin !== pinToVerify) {
        const updateAttempts = await client.query<{ payment_pin_attempts: number }>(
          `UPDATE payment_records
           SET payment_pin_attempts = payment_pin_attempts + 1,
               updated_at = NOW()
           WHERE id = $1
           RETURNING payment_pin_attempts`,
          [payment.id]
        );

        const nextAttempts = updateAttempts?.rows?.[0]?.payment_pin_attempts ?? 1;
        if (nextAttempts >= 3) {
          throw new AppError(
            "Too many failed PIN attempts. Maximum PIN verification attempts exceeded (3/3). Please re-initiate cash payment.",
            429,
            ErrorCode.PAYMENT_PIN_MAX_ATTEMPTS_EXCEEDED
          );
        }

        throw new AppError(
          `Invalid Payment PIN. ${3 - nextAttempts} attempt(s) remaining.`,
          400,
          ErrorCode.INVALID_PAYMENT_PIN
        );
      }

      // 3. PIN matches -> Execute atomic settlement in transaction
      const txRef = `cash_settled_${Date.now()}`;
      // Update payment record to CONFIRMED
      const updatePayRes = await client.query(
        `UPDATE payment_records
         SET status = 'CONFIRMED',
             payment_pin_verified_at = NOW(),
             cash_confirmed_by_payee_at = NOW(),
             transaction_ref = $1,
             notes = COALESCE(notes, '') || ' | Cash receipt confirmed by worker with PIN.',
             recorded_at = NOW(),
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [txRef, payment.id]
      );

      // Update assignment to CONFIRMED and CLOSED
      await client.query(
        `UPDATE assignments
         SET payment_status = 'CONFIRMED',
             status = 'CLOSED',
             final_wage_paid = $1,
             payment_method = 'CASH',
             payment_reference = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [payment.amount, txRef, assignmentId]
      );

      // Check if all active assignments for this opportunity are completed/closed
      const jobCheck = await client.query<{ unclosed: number }>(
        `SELECT COUNT(*) AS unclosed
         FROM assignments
         WHERE work_opportunity_id = $1
           AND status NOT IN ('CLOSED', 'CANCELLED', 'NO_SHOW')`,
        [assignment.work_opportunity_id]
      );
      if (Number(jobCheck.rows[0]?.unclosed || 0) === 0) {
        await client.query(
          `UPDATE work_opportunities
           SET status = 'PAID',
               updated_at = NOW()
           WHERE id = $1`,
          [assignment.work_opportunity_id]
        );
      }

      // Notifications
      const amountINR = Number(payment.amount);
      await client.query(
        `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES 
         ($1, 'PAYMENT_SUCCESS', 'Cash Receipt Confirmed', 'You have confirmed receipt of ₹' || $3::text || ' cash.', $4),
         ($2, 'PAYMENT_RECORDED', 'Cash Payment Confirmed', 'Worker has verified and confirmed cash payment of ₹' || $3::text || '.', $4)`,
        [
          workerUserId,
          assignment.provider_user_id,
          amountINR.toFixed(2),
          JSON.stringify({ assignmentId, amountINR, paymentId: payment.id, method: "CASH" }),
        ]
      );

      try {
        await logAuditEvent({
          actorId: workerUserId,
          action: "CASH_PAYMENT_CONFIRMED",
          targetEntity: "payment_records",
          targetId: payment.id,
          newValues: { assignmentId, amountINR, paymentMethod: "CASH", verifiedBy: "WORKER_PIN" },
        });
      } catch {}

      const resp = this.mapRowToResponse(updatePayRes.rows[0], assignment.opportunity_title);
      resp.disclaimer = "Cash payment was confirmed directly between provider and worker. NEARVIA does not hold custody of physical cash.";
      return resp;
    });
  }

  // ──────────────────────────────────────────────────
  // 4. DIRECT CONFIRMATION (Sandbox / Client Checkout)
  // ──────────────────────────────────────────────────

  async confirmPaymentDirect(
    payerUserId: string,
    paymentId: string,
    input: ConfirmPaymentInput
  ): Promise<PaymentRecordResponse> {
    return await withTransaction(async (client) => {
      // 1. Lock payment record
      const payRes = await client.query<{
        id: string;
        assignment_id: string;
        payer_id: string;
        payee_id: string;
        amount: number;
        amount_paise: number;
        status: string;
        gateway_order_id: string | null;
      }>(
        `SELECT id, assignment_id, payer_id, payee_id, amount, amount_paise, status, gateway_order_id
         FROM payment_records
         WHERE id = $1 FOR UPDATE`,
        [paymentId]
      );

      const payment = payRes.rows[0];
      if (!payment) {
        throw new AppError("Payment record not found", 404, ErrorCode.NOT_FOUND);
      }

      if (payment.payer_id !== payerUserId) {
        throw new AppError("You are not authorized to confirm this payment", 403, ErrorCode.FORBIDDEN);
      }

      if (payment.status === "CONFIRMED") {
        return this.getPaymentDetail(payerUserId, paymentId);
      }

      // Check if assignment is under active dispute
      const assignCheck = await client.query<{ payment_status: string }>(
        `SELECT payment_status FROM assignments WHERE id = $1`,
        [payment.assignment_id]
      );
      if (assignCheck.rows[0]?.payment_status === "DISPUTED") {
        throw new AppError(
          "Cannot confirm payment for an assignment under active dispute. Dispute must be resolved first.",
          409,
          ErrorCode.PAYMENT_DISPUTED
        );
      }

      const openDispute = await client.query(
        `SELECT id FROM disputes WHERE assignment_id = $1 AND status IN ('OPEN', 'INVESTIGATING', 'UNDER_REVIEW') LIMIT 1`,
        [payment.assignment_id]
      );
      if (openDispute?.rows && openDispute.rows.length > 0) {
        throw new AppError(
          "Cannot confirm payment for an assignment with an open dispute. Dispute must be resolved first.",
          409,
          ErrorCode.PAYMENT_DISPUTED
        );
      }

      const txRef = input.transactionRef || input.razorpayPaymentId || `tx_sb_${Date.now()}`;
      const method = input.paymentMethod || "UPI";

      // Verify Razorpay signature if provided
      if (input.razorpaySignature) {
        const orderId = input.razorpayOrderId || payment.gateway_order_id || "";
        const paymentId = input.razorpayPaymentId || txRef;
        const razorpayProvider = defaultRazorpayProvider as RazorpayPaymentProvider;
        const isValidSig = razorpayProvider.verifyPaymentSignature({
          orderId,
          paymentId,
          signature: input.razorpaySignature,
        });

        if (!isValidSig) {
          throw new AppError("Invalid Razorpay payment signature", 400, ErrorCode.UNAUTHORIZED);
        }
      }

      // 2. Update payment record to CONFIRMED
      const updateRes = await client.query(
        `UPDATE payment_records
         SET status = 'CONFIRMED',
             payment_method = $1,
             transaction_ref = $2,
             gateway_payment_id = COALESCE($4, gateway_payment_id),
             gateway_signature = COALESCE($5, gateway_signature),
             recorded_at = NOW(),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [method, txRef, paymentId, input.razorpayPaymentId || null, input.razorpaySignature || null]
      );

      // 3. Atomically update assignment payment status and close assignment
      await client.query(
        `UPDATE assignments
         SET payment_status = 'CONFIRMED',
             status = 'CLOSED',
             final_wage_paid = $1,
             payment_method = $2,
             payment_reference = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [payment.amount, method, txRef, payment.assignment_id]
      );

      // Check if all active assignments for this opportunity are completed/closed
      const jobCheck = await client.query<{ unclosed: number }>(
        `SELECT COUNT(*) AS unclosed
         FROM assignments
         WHERE work_opportunity_id = (SELECT work_opportunity_id FROM assignments WHERE id = $1)
           AND status NOT IN ('CLOSED', 'CANCELLED', 'NO_SHOW')`,
        [payment.assignment_id]
      );
      if (Number(jobCheck.rows[0]?.unclosed || 0) === 0) {
        await client.query(
          `UPDATE work_opportunities
           SET status = 'PAID',
               updated_at = NOW()
           WHERE id = (SELECT work_opportunity_id FROM assignments WHERE id = $1)`,
          [payment.assignment_id]
        );
      }

      // 4. Notifications
      const amountINR = Number(payment.amount);
      await client.query(
        `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
        [
          payment.payee_id,
          "PAYMENT_SUCCESS",
          "Payment Received!",
          `You have received ₹${amountINR.toFixed(2)} for your completed work.`,
          JSON.stringify({ paymentId, amountINR, transactionRef: txRef }),
        ]
      );

      try {
        await logAuditEvent({
          actorId: payerUserId,
          action: "ONLINE_PAYMENT_CONFIRMED",
          targetEntity: "payment_records",
          targetId: payment.id,
          newValues: { amount: amountINR, method, transactionRef: txRef },
        });
      } catch {}

      return this.mapRowToResponse(updateRes.rows[0]);
    });
  }

  // ──────────────────────────────────────────────────
  // 5. WEBHOOK RECONCILIATION (Razorpay Sandbox)
  // ──────────────────────────────────────────────────

  async processWebhook(
    rawBody: string | Buffer,
    signature: string
  ): Promise<{ processed: boolean; event?: string; duplicate?: boolean }> {
    const verified = await this.provider.verifyWebhook(rawBody, signature);
    if (!verified.isValid || !verified.gatewayOrderId) {
      throw new AppError("Invalid webhook signature or payload", 400, ErrorCode.UNAUTHORIZED);
    }

    // Idempotency check using webhook_events table
    const eventId = `${verified.gatewayPaymentId || verified.gatewayOrderId}_${verified.event}`;
    try {
      await query(
        `INSERT INTO webhook_events (provider, event_id, event_type, status)
         VALUES ($1, $2, $3, 'PROCESSED')`,
        [this.provider.name, eventId, verified.event]
      );
    } catch (err: any) {
      if (err.code === "23505") {
        // Duplicate webhook event already processed safely
        return { processed: true, event: verified.event, duplicate: true };
      }
    }

    if (verified.event === "PAYMENT_FAILED") {
      await query(
        `UPDATE payment_records
         SET status = 'FAILED',
             notes = COALESCE(notes, '') || ' | Gateway webhook reported payment failure.',
             updated_at = NOW()
         WHERE gateway_order_id = $1 AND status != 'CONFIRMED'`,
        [verified.gatewayOrderId]
      );
      await query(
        `UPDATE assignments
         SET payment_status = 'FAILED',
             updated_at = NOW()
         WHERE id = (SELECT assignment_id FROM payment_records WHERE gateway_order_id = $1 LIMIT 1)`,
        [verified.gatewayOrderId]
      );
      return { processed: true, event: verified.event };
    }

    if (verified.event === "PAYMENT_CONFIRMED") {
      let settledPayerId = "";
      let settledPayeeId = "";
      let settledAmount = 0;
      let settledAssignmentId = "";

      await withTransaction(async (client) => {
        const payRes = await client.query<{
          id: string;
          assignment_id: string;
          payer_id: string;
          payee_id: string;
          amount: number;
          amount_paise: number;
          status: string;
        }>(
          `SELECT id, assignment_id, payer_id, payee_id, amount, amount_paise, status
           FROM payment_records
           WHERE gateway_order_id = $1 FOR UPDATE`,
          [verified.gatewayOrderId]
        );

        const payment = payRes.rows[0];
        if (!payment || payment.status === "CONFIRMED") {
          return; // Idempotent: already confirmed
        }

        // Check for webhook amount tampering against authoritative payment record
        if (verified.amountPaise && payment.amount_paise && Number(verified.amountPaise) !== Number(payment.amount_paise)) {
          await client.query(
            `UPDATE payment_records
             SET status = 'FAILED',
                 notes = COALESCE(notes, '') || ' | Gateway webhook amount mismatch: possible tampering detected.',
                 updated_at = NOW()
             WHERE id = $1`,
            [payment.id]
          );
          throw new AppError(
            `Webhook amount mismatch: expected ${payment.amount_paise} paise, received ${verified.amountPaise} paise`,
            400,
            ErrorCode.PAYMENT_AMOUNT_MISMATCH
          );
        }

        // Check if assignment is under active dispute
        const assignCheck = await client.query<{ payment_status: string }>(
          `SELECT payment_status FROM assignments WHERE id = $1`,
          [payment.assignment_id]
        );
        if (assignCheck.rows[0]?.payment_status === "DISPUTED") {
          await client.query(
            `UPDATE payment_records
             SET notes = COALESCE(notes, '') || ' | Webhook received during active dispute. Settlement held pending dispute resolution.',
                 updated_at = NOW()
             WHERE id = $1`,
            [payment.id]
          );
          return;
        }

        settledPayerId = payment.payer_id;
        settledPayeeId = payment.payee_id;
        settledAmount = payment.amount;
        settledAssignmentId = payment.assignment_id;

        const txRef = verified.gatewayPaymentId || `tx_${Date.now()}`;

        await client.query(
          `UPDATE payment_records
           SET status = 'CONFIRMED',
               gateway_payment_id = $1,
               transaction_ref = $2,
               recorded_at = NOW(),
               updated_at = NOW()
           WHERE id = $3`,
          [verified.gatewayPaymentId, txRef, payment.id]
        );

        await client.query(
          `UPDATE assignments
           SET payment_status = 'CONFIRMED',
               status = 'CLOSED',
               final_wage_paid = $1,
               payment_reference = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [payment.amount, txRef, payment.assignment_id]
        );

        // Check if all active assignments for this opportunity are completed/closed
        const jobCheck = await client.query<{ unclosed: number }>(
          `SELECT COUNT(*) AS unclosed
           FROM assignments
           WHERE work_opportunity_id = (SELECT work_opportunity_id FROM assignments WHERE id = $1)
             AND status NOT IN ('CLOSED', 'CANCELLED', 'NO_SHOW')`,
          [payment.assignment_id]
        );
        if (Number(jobCheck.rows[0]?.unclosed || 0) === 0) {
          await client.query(
            `UPDATE work_opportunities
             SET status = 'PAID',
                 updated_at = NOW()
             WHERE id = (SELECT work_opportunity_id FROM assignments WHERE id = $1)`,
            [payment.assignment_id]
          );
        }
      });

      // Send notifications outside transaction
      if (settledPayeeId) {
        try {
          await query(
            `INSERT INTO notifications (recipient_id, type, title, message, data)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              settledPayeeId,
              "PAYMENT_RECORDED",
              "Shift Payment Settled",
              `₹${settledAmount} wage payment has been verified and settled for your completed shift.`,
              JSON.stringify({ assignmentId: settledAssignmentId }),
            ]
          );
        } catch {}

        try {
          await logAuditEvent({
            actorId: settledPayerId,
            action: "PAYMENT_SETTLED_WEBHOOK",
            targetEntity: "payment_records",
            targetId: settledAssignmentId,
            newValues: { amount: settledAmount, gatewayOrderId: verified.gatewayOrderId },
          });
        } catch {}
      }
    }

    return { processed: true, event: verified.event };
  }

  // ──────────────────────────────────────────────────
  // 6. PAYMENT RECEIPTS
  // ──────────────────────────────────────────────────

  async getPaymentReceipt(userId: string, paymentId: string): Promise<PaymentReceipt> {
    const res = await query(
      `SELECT 
         pr.id, pr.assignment_id, pr.payer_id, pr.payee_id, pr.amount, pr.currency,
         pr.platform_fee, pr.net_payout, pr.status, pr.payment_method, pr.transaction_ref,
         pr.cash_confirmed_by_payer_at, pr.cash_confirmed_by_payee_at,
         pr.recorded_at,
         payer.full_name AS payer_name,
         pp.business_name AS payer_business_name,
         payee.full_name AS payee_name,
         wo.title AS opportunity_title,
         wo.work_type,
         wo.work_date
       FROM payment_records pr
       JOIN users payer ON pr.payer_id = payer.id
       LEFT JOIN provider_profiles pp ON payer.id = pp.user_id
       JOIN users payee ON pr.payee_id = payee.id
       JOIN assignments a ON pr.assignment_id = a.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE pr.id = $1`,
      [paymentId]
    );

    const row = res.rows[0];
    if (!row) {
      throw new AppError("Payment record not found", 404, ErrorCode.NOT_FOUND);
    }

    if (row.payer_id !== userId && row.payee_id !== userId) {
      throw new AppError("You are not authorized to view this payment receipt", 403, ErrorCode.FORBIDDEN);
    }

    const isCash = (row.payment_method || "").toUpperCase() === "CASH";
    const disclaimer = isCash
      ? "Cash payment was confirmed directly between employer and worker. NEARVIA is a software platform and does not hold custody or transfer physical cash."
      : "DEMO / TEST PAYMENT: Verified and processed in Razorpay Sandbox mode. No real financial settlement occurs in this educational prototype.";

    const amountFloat = Number(row.amount);
    const feeFloat = Number(row.platform_fee || 0);
    const netFloat = Number(row.net_payout || amountFloat - feeFloat);

    return {
      id: row.id,
      receiptNumber: `REC-${row.id.substring(0, 8).toUpperCase()}`,
      assignmentId: row.assignment_id,
      opportunityTitle: row.opportunity_title,
      workType: row.work_type,
      workDate: row.work_date,
      payerName: row.payer_name,
      payerBusinessName: row.payer_business_name,
      payeeName: row.payee_name,
      amount: amountFloat,
      platformFee: feeFloat,
      netPayout: netFloat,
      currency: row.currency || "INR",
      paymentMethod: row.payment_method || "ONLINE",
      status: row.status,
      transactionRef: row.transaction_ref || `tx_${row.id.substring(0, 8)}`,
      recordedAt: row.recorded_at,
      cashConfirmedByPayerAt: row.cash_confirmed_by_payer_at,
      cashConfirmedByPayeeAt: row.cash_confirmed_by_payee_at,
      disclaimer,
      isSandboxTest: !isCash,
    };
  }

  async getAssignmentPaymentReceipt(userId: string, assignmentId: string): Promise<PaymentReceipt> {
    const res = await query<{ id: string }>(
      `SELECT id FROM payment_records WHERE assignment_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [assignmentId]
    );

    if (!res.rows[0]) {
      throw new AppError("No payment record found for this assignment", 404, ErrorCode.NOT_FOUND);
    }

    return this.getPaymentReceipt(userId, res.rows[0].id);
  }

  // ──────────────────────────────────────────────────
  // 7. PAYMENT DISPUTE INTEGRATION
  // ──────────────────────────────────────────────────

  async disputePayment(
    userId: string,
    assignmentId: string,
    input: DisputePaymentInput
  ): Promise<{ disputeId: string; status: string; message: string }> {
    return await withTransaction(async (client) => {
      const assignRes = await client.query<{
        id: string;
        provider_user_id: string;
        worker_user_id: string;
        opportunity_title: string;
        payment_status: string;
      }>(
        `SELECT 
           a.id, a.payment_status,
           p.user_id AS provider_user_id,
           w.user_id AS worker_user_id,
           wo.title AS opportunity_title
         FROM assignments a
         JOIN provider_profiles p ON a.provider_id = p.id
         JOIN worker_profiles w ON a.worker_id = w.id
         JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
         WHERE a.id = $1 FOR UPDATE`,
        [assignmentId]
      );

      const assignment = assignRes.rows[0];
      if (!assignment) {
        throw new AppError("Assignment not found", 404, ErrorCode.NOT_FOUND);
      }

      const isWorker = assignment.worker_user_id === userId;
      const isProvider = assignment.provider_user_id === userId;

      if (!isWorker && !isProvider) {
        throw new AppError("You are not authorized to dispute this payment", 403, ErrorCode.FORBIDDEN);
      }

      const respondentId = isWorker ? assignment.provider_user_id : assignment.worker_user_id;

      // 1. Create entry in disputes table
      const disputeRes = await client.query(
        `INSERT INTO disputes (assignment_id, initiator_id, respondent_id, reason, description, status)
         VALUES ($1, $2, $3, $4, $5, 'OPEN')
         RETURNING id`,
        [assignmentId, userId, respondentId, input.reason, input.description]
      );

      const disputeRecord = disputeRes.rows[0];
      if (!disputeRecord) {
        throw new AppError("Failed to file dispute record", 500, ErrorCode.INTERNAL_SERVER_ERROR);
      }
      const disputeId = disputeRecord.id;

      // 2. Mark payment_records as DISPUTED
      await client.query(
        `UPDATE payment_records
         SET status = 'DISPUTED',
             reconciliation_status = 'DISPUTED',
             reconciliation_notes = $1,
             updated_at = NOW()
         WHERE assignment_id = $2`,
        [`Dispute opened by ${isWorker ? "Worker" : "Employer"}: ${input.reason}`, assignmentId]
      );

      // 3. Mark assignment as DISPUTED
      await client.query(
        `UPDATE assignments
         SET payment_status = 'DISPUTED',
             updated_at = NOW()
         WHERE id = $1`,
        [assignmentId]
      );

      // 4. Notifications
      await client.query(
        `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES 
         ($1, 'DISPUTE_OPENED', 'Payment Dispute Filed', 'You filed a payment dispute for ' || $3 || '.', $4),
         ($2, 'DISPUTE_OPENED', 'Payment Dispute Opened', 'A payment dispute has been opened for ' || $3 || '.', $4)`,
        [
          userId,
          respondentId,
          assignment.opportunity_title,
          JSON.stringify({ assignmentId, disputeId, reason: input.reason }),
        ]
      );

      try {
        await logAuditEvent({
          actorId: userId,
          action: "PAYMENT_DISPUTED",
          targetEntity: "disputes",
          targetId: disputeId,
          newValues: { assignmentId, reason: input.reason },
        });
      } catch {}

      return {
        disputeId,
        status: "DISPUTED",
        message: "Payment dispute has been filed and routed to Trust & Safety for review.",
      };
    });
  }

  // ──────────────────────────────────────────────────
  // 8. WORKER EARNINGS BREAKDOWN & TRANSACTIONS
  // ──────────────────────────────────────────────────

  async getWorkerEarnings(workerUserId: string): Promise<WorkerEarningsSummary> {
    const res = await query<{
      status: string;
      payment_method: string | null;
      is_today: boolean;
      is_this_week: boolean;
      is_this_month: boolean;
      count: string;
      total_paise: string;
    }>(
      `SELECT 
         status,
         payment_method,
         (recorded_at >= CURRENT_DATE) AS is_today,
         (recorded_at >= DATE_TRUNC('week', CURRENT_DATE)) AS is_this_week,
         (recorded_at >= DATE_TRUNC('month', CURRENT_DATE)) AS is_this_month,
         COUNT(*) AS count,
         COALESCE(SUM(ROUND(amount * 100)), 0) AS total_paise
       FROM payment_records
       WHERE payee_id = $1
       GROUP BY status, payment_method, is_today, is_this_week, is_this_month`,
      [workerUserId]
    );

    let totalEarnedPaise = 0;
    let todayEarningsPaise = 0;
    let weekEarningsPaise = 0;
    let monthEarningsPaise = 0;
    let pendingSettlementPaise = 0;
    let cashEarningsPaise = 0;
    let onlineEarningsPaise = 0;
    let disputedEarningsPaise = 0;
    let completedPaymentsCount = 0;
    let pendingPaymentsCount = 0;

    for (const r of res.rows) {
      const paise = parseInt(r.total_paise, 10) || 0;
      const count = parseInt(r.count, 10) || 0;

      if (r.status === "CONFIRMED") {
        totalEarnedPaise += paise;
        completedPaymentsCount += count;
        if (r.payment_method === "CASH") {
          cashEarningsPaise += paise;
        } else {
          onlineEarningsPaise += paise;
        }
        if (r.is_today) todayEarningsPaise += paise;
        if (r.is_this_week) weekEarningsPaise += paise;
        if (r.is_this_month) monthEarningsPaise += paise;
      } else if (r.status === "PENDING") {
        pendingSettlementPaise += paise;
        pendingPaymentsCount += count;
      } else if (r.status === "DISPUTED") {
        disputedEarningsPaise += paise;
      }
    }

    return {
      todayEarnings: todayEarningsPaise / 100,
      todayEarningsPaise,
      weekEarnings: weekEarningsPaise / 100,
      weekEarningsPaise,
      monthEarnings: monthEarningsPaise / 100,
      monthEarningsPaise,
      totalEarned: totalEarnedPaise / 100,
      totalEarnedPaise,
      pendingSettlement: pendingSettlementPaise / 100,
      pendingSettlementPaise,
      cashEarnings: cashEarningsPaise / 100,
      cashEarningsPaise,
      onlineEarnings: onlineEarningsPaise / 100,
      onlineEarningsPaise,
      disputedEarnings: disputedEarningsPaise / 100,
      disputedEarningsPaise,
      completedPaymentsCount,
      pendingPaymentsCount,
    };
  }

  async getWorkerTransactions(
    workerUserId: string,
    page = 1,
    limit = 20,
    filters?: { status?: string; paymentMethod?: string; fromDate?: string; toDate?: string }
  ): Promise<{ transactions: PaymentRecordResponse[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [`pr.payee_id = $1`];
    const params: unknown[] = [workerUserId];

    if (filters?.status) {
      params.push(filters.status);
      conditions.push(`pr.status = $${params.length}`);
    }

    if (filters?.paymentMethod) {
      params.push(filters.paymentMethod);
      conditions.push(`pr.payment_method = $${params.length}`);
    }

    if (filters?.fromDate) {
      params.push(filters.fromDate);
      conditions.push(`pr.recorded_at >= $${params.length}`);
    }

    if (filters?.toDate) {
      params.push(filters.toDate);
      conditions.push(`pr.recorded_at <= $${params.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await query(`SELECT COUNT(*) FROM payment_records pr WHERE ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const res = await query(
      `SELECT 
         pr.id, pr.assignment_id, pr.payer_id, pr.payee_id, pr.amount, pr.currency,
         pr.platform_fee, pr.net_payout, pr.status, pr.payment_method, pr.transaction_ref,
         pr.gateway_order_id, pr.cash_confirmed_by_payer_at, pr.cash_confirmed_by_payee_at,
         pr.notes, pr.recorded_at, pr.created_at,
         u.full_name AS payer_name,
         pp.business_name AS payer_business_name,
         wo.title AS opportunity_title,
         wo.work_type,
         wo.work_date
       FROM payment_records pr
       JOIN users u ON pr.payer_id = u.id
       LEFT JOIN provider_profiles pp ON u.id = pp.user_id
       JOIN assignments a ON pr.assignment_id = a.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE ${whereClause}
       ORDER BY pr.recorded_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return {
      transactions: res.rows.map((r) => this.mapRowToResponse(r)),
      total,
      page,
      limit,
    };
  }

  // ──────────────────────────────────────────────────
  // 9. PROVIDER PAYMENTS HISTORY & SUMMARY
  // ──────────────────────────────────────────────────

  async getProviderPaymentsSummary(providerUserId: string): Promise<ProviderPaymentsSummary> {
    const res = await query<{
      status: string;
      count: string;
      total_paise: string;
    }>(
      `SELECT 
         status,
         COUNT(*) AS count,
         COALESCE(SUM(ROUND(amount * 100)), 0) AS total_paise
       FROM payment_records
       WHERE payer_id = $1
       GROUP BY status`,
      [providerUserId]
    );

    let totalPaidPaise = 0;
    let completedCount = 0;

    for (const r of res.rows) {
      const paise = parseInt(r.total_paise, 10) || 0;
      const count = parseInt(r.count, 10) || 0;
      if (r.status === "CONFIRMED") {
        totalPaidPaise += paise;
        completedCount += count;
      }
    }

    const payableRes = await query<{ count: string; total_paise: string }>(
      `SELECT 
         COUNT(*) AS count,
         COALESCE(SUM(ROUND(a.agreed_wage * 100)), 0) AS total_paise
       FROM assignments a
       JOIN provider_profiles p ON a.provider_id = p.id
       WHERE p.user_id = $1 
         AND a.status = 'COMPLETED' 
         AND a.payment_status = 'PENDING'`,
      [providerUserId]
    );

    const pendingPayablePaise = parseInt(payableRes.rows[0]?.total_paise || "0", 10);
    const pendingPayableCount = parseInt(payableRes.rows[0]?.count || "0", 10);

    return {
      totalPaid: totalPaidPaise / 100,
      totalPaidPaise,
      pendingPayable: pendingPayablePaise / 100,
      pendingPayablePaise,
      completedCount,
      pendingPayableCount,
    };
  }

  async getProviderPaymentsHistory(
    providerUserId: string,
    page = 1,
    limit = 20,
    filters?: { status?: string; paymentMethod?: string; fromDate?: string; toDate?: string }
  ): Promise<{ payments: PaymentRecordResponse[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [`pr.payer_id = $1`];
    const params: unknown[] = [providerUserId];

    if (filters?.status) {
      params.push(filters.status);
      conditions.push(`pr.status = $${params.length}`);
    }

    if (filters?.paymentMethod) {
      params.push(filters.paymentMethod);
      conditions.push(`pr.payment_method = $${params.length}`);
    }

    if (filters?.fromDate) {
      params.push(filters.fromDate);
      conditions.push(`pr.recorded_at >= $${params.length}`);
    }

    if (filters?.toDate) {
      params.push(filters.toDate);
      conditions.push(`pr.recorded_at <= $${params.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countRes = await query(`SELECT COUNT(*) FROM payment_records pr WHERE ${whereClause}`, params);
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const res = await query(
      `SELECT 
         pr.id, pr.assignment_id, pr.payer_id, pr.payee_id, pr.amount, pr.currency,
         pr.platform_fee, pr.net_payout, pr.status, pr.payment_method, pr.transaction_ref,
         pr.gateway_order_id, pr.payment_pin, pr.cash_confirmed_by_payer_at, pr.cash_confirmed_by_payee_at,
         pr.notes, pr.recorded_at, pr.created_at,
         u.full_name AS payee_name,
         wo.title AS opportunity_title,
         wo.work_type,
         wo.work_date
       FROM payment_records pr
       JOIN users u ON pr.payee_id = u.id
       JOIN assignments a ON pr.assignment_id = a.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE ${whereClause}
       ORDER BY pr.recorded_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return {
      payments: res.rows.map((r) => this.mapRowToResponse(r)),
      total,
      page,
      limit,
    };
  }

  async getProviderPayableAssignments(providerUserId: string): Promise<PayableAssignmentItem[]> {
    const res = await query(
      `SELECT 
         a.id AS assignment_id,
         a.work_opportunity_id,
         wo.title,
         wo.work_type,
         wo.work_date,
         a.worker_id,
         w.user_id AS worker_user_id,
         u.full_name AS worker_name,
         u.phone AS worker_phone,
         a.agreed_wage,
         a.completed_at,
         a.payment_status
       FROM assignments a
       JOIN provider_profiles p ON a.provider_id = p.id
       JOIN worker_profiles w ON a.worker_id = w.id
       JOIN users u ON w.user_id = u.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE p.user_id = $1 
         AND a.status = 'COMPLETED' 
         AND a.payment_status IN ('PENDING', 'CASH_PROVIDER_CONFIRMED')
       ORDER BY a.completed_at DESC`,
      [providerUserId]
    );

    return res.rows.map((r) => {
      const wageFloat = Number(r.agreed_wage);
      const wagePaise = Math.round(wageFloat * 100);
      return {
        assignmentId: r.assignment_id,
        workOpportunityId: r.work_opportunity_id,
        title: r.title,
        workType: r.work_type,
        workDate: r.work_date,
        workerId: r.worker_id,
        workerUserId: r.worker_user_id,
        workerName: r.worker_name,
        workerPhone: r.worker_phone,
        agreedWage: wageFloat,
        agreedWagePaise: wagePaise,
        completedAt: r.completed_at,
        paymentStatus: r.payment_status,
      };
    });
  }

  // ──────────────────────────────────────────────────
  // 10. PAYMENT DETAIL
  // ──────────────────────────────────────────────────

  async getPaymentDetail(userId: string, paymentId: string): Promise<PaymentRecordResponse> {
    const res = await query(
      `SELECT 
         pr.id, pr.assignment_id, pr.payer_id, pr.payee_id, pr.amount, pr.currency,
         pr.platform_fee, pr.net_payout, pr.status, pr.payment_method, pr.transaction_ref,
         pr.gateway_order_id, pr.payment_pin, pr.payment_pin_attempts, pr.payment_pin_verified_at,
         pr.cash_confirmed_by_payer_at, pr.cash_confirmed_by_payee_at, pr.reconciliation_status,
         pr.notes, pr.recorded_at, pr.created_at, pr.updated_at,
         payer.full_name AS payer_name,
         pp.business_name AS payer_business_name,
         payee.full_name AS payee_name,
         wo.title AS opportunity_title,
         wo.work_type,
         wo.work_date
       FROM payment_records pr
       JOIN users payer ON pr.payer_id = payer.id
       LEFT JOIN provider_profiles pp ON payer.id = pp.user_id
       JOIN users payee ON pr.payee_id = payee.id
       JOIN assignments a ON pr.assignment_id = a.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE pr.id = $1`,
      [paymentId]
    );

    const row = res.rows[0];
    if (!row) {
      throw new AppError("Payment record not found", 404, ErrorCode.NOT_FOUND);
    }

    if (row.payer_id !== userId && row.payee_id !== userId) {
      throw new AppError("You are not authorized to view this payment receipt", 403, ErrorCode.FORBIDDEN);
    }

    const resp = this.mapRowToResponse(row);
    // Only payer can see unverified payment PIN
    if (row.payer_id !== userId && !row.payment_pin_verified_at) {
      delete resp.paymentPin;
    }

    return resp;
  }

  // ──────────────────────────────────────────────────
  // 11. REFUND PROCESSING (Online only)
  // ──────────────────────────────────────────────────

  async refundPayment(
    userId: string,
    paymentId: string,
    input: RefundPaymentInput
  ): Promise<PaymentRecordResponse> {
    return await withTransaction(async (client) => {
      const payRes = await client.query<{
        id: string;
        assignment_id: string;
        payer_id: string;
        payee_id: string;
        amount: number;
        amount_paise: number;
        status: string;
        payment_method: string;
        gateway_payment_id: string | null;
      }>(
        `SELECT id, assignment_id, payer_id, payee_id, amount, amount_paise, status, payment_method, gateway_payment_id
         FROM payment_records
         WHERE id = $1 FOR UPDATE`,
        [paymentId]
      );

      const payment = payRes.rows[0];
      if (!payment) {
        throw new AppError("Payment record not found", 404, ErrorCode.NOT_FOUND);
      }

      if (payment.payer_id !== userId) {
        throw new AppError("Only the payer can initiate a refund", 403, ErrorCode.FORBIDDEN);
      }

      if (payment.payment_method === "CASH") {
        throw new AppError(
          "NEARVIA cannot automatically process cash refunds. Please coordinate directly or open a dispute with Trust & Safety.",
          400,
          ErrorCode.VALIDATION_ERROR
        );
      }

      if (payment.status !== "CONFIRMED") {
        throw new AppError(
          `Cannot refund a payment with status '${payment.status}'. Only CONFIRMED payments can be refunded.`,
          400,
          ErrorCode.ASSIGNMENT_INVALID_STATE
        );
      }

      // Process with gateway
      const paise = Math.round(Number(payment.amount) * 100);
      await this.provider.processRefund(
        payment.gateway_payment_id || `pay_${payment.id}`,
        paise,
        input.reason
      );

      // Update payment record to REFUNDED
      const updateRes = await client.query(
        `UPDATE payment_records
         SET status = 'REFUNDED',
             notes = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [`Refund Reason: ${input.reason}`, paymentId]
      );

      // Update assignment
      await client.query(
        `UPDATE assignments
         SET payment_status = 'REFUNDED',
             updated_at = NOW()
         WHERE id = $1`,
        [payment.assignment_id]
      );

      // Notifications
      const amountINR = Number(payment.amount);
      await client.query(
        `INSERT INTO notifications (recipient_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)`,
        [
          payment.payee_id,
          "PAYMENT_REFUNDED",
          "Payment Refunded",
          `A payment of ₹${amountINR.toFixed(2)} has been refunded. Reason: ${input.reason}`,
          JSON.stringify({ paymentId, amountINR, reason: input.reason }),
        ]
      );

      try {
        await logAuditEvent({
          actorId: userId,
          action: "PAYMENT_REFUNDED",
          targetEntity: "payment_records",
          targetId: payment.id,
          newValues: { amount: amountINR, reason: input.reason },
        });
      } catch {}

      return this.mapRowToResponse(updateRes.rows[0]);
    });
  }

  // ──────────────────────────────────────────────────
  // 12. AUTOMATED PAYMENT RECONCILIATION ENGINE
  // ──────────────────────────────────────────────────

  async reconcilePayments(): Promise<PaymentReconciliationReport> {
    const issues: Array<{
      paymentId: string;
      assignmentId: string;
      issueType: string;
      description: string;
      actionRequired: string;
    }> = [];

    // 1. Audit unconfirmed cash payments older than 24 hours
    const staleCashRes = await query<{
      id: string;
      assignment_id: string;
      created_at: string;
      amount: number;
    }>(
      `SELECT id, assignment_id, created_at, amount
       FROM payment_records
       WHERE payment_method = 'CASH'
         AND status = 'PENDING'
         AND created_at < NOW() - INTERVAL '24 hours'`
    );

    for (const r of staleCashRes.rows) {
      issues.push({
        paymentId: r.id,
        assignmentId: r.assignment_id,
        issueType: "UNCONFIRMED_CASH_PAYMENT",
        description: `Cash payment of ₹${r.amount} initiated >24h ago has not been verified with Worker PIN.`,
        actionRequired: "Prompt worker and employer to complete PIN verification or open a dispute.",
      });
    }

    // 2. Audit completed assignments without any payment record
    const missingPayRes = await query<{
      id: string;
      completed_at: string;
      agreed_wage: number;
    }>(
      `SELECT a.id, a.completed_at, a.agreed_wage
       FROM assignments a
       LEFT JOIN payment_records pr ON a.id = pr.assignment_id
       WHERE a.status = 'COMPLETED'
         AND a.payment_status = 'PENDING'
         AND pr.id IS NULL
         AND a.completed_at < NOW() - INTERVAL '48 hours'`
    );

    for (const a of missingPayRes.rows) {
      issues.push({
        paymentId: "NONE",
        assignmentId: a.id,
        issueType: "OVERDUE_COMPLETED_PAYMENT",
        description: `Assignment completed on ${a.completed_at} for ₹${a.agreed_wage} has no initiated payment record.`,
        actionRequired: "Notify employer of overdue settlement.",
      });
    }

    // 3. Audit disputed payments
    const disputedRes = await query<{
      id: string;
      assignment_id: string;
      amount: number;
    }>(
      `SELECT id, assignment_id, amount
       FROM payment_records
       WHERE status = 'DISPUTED'`
    );

    const disputedCount = disputedRes.rows.length;
    for (const d of disputedRes.rows) {
      issues.push({
        paymentId: d.id,
        assignmentId: d.assignment_id,
        issueType: "ACTIVE_DISPUTE",
        description: `Payment of ₹${d.amount} is flagged as DISPUTED.`,
        actionRequired: "Requires manual Trust & Safety dispute resolution.",
      });
    }

    const totalCountRes = await query(`SELECT COUNT(*) FROM payment_records`);
    const totalChecked = parseInt(totalCountRes.rows[0]?.count || "0", 10);
    const matchedCount = Math.max(0, totalChecked - issues.length);

    return {
      totalChecked,
      matchedCount,
      discrepanciesCount: issues.length,
      disputedCount,
      unreconciledCount: staleCashRes.rows.length,
      issues,
      reconciledAt: new Date().toISOString(),
    };
  }

  // ──────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ──────────────────────────────────────────────────

  private async validateAssignmentForPayment(
    assignmentId: string,
    payerUserId: string
  ): Promise<{
    id: string;
    status: string;
    agreed_wage: number;
    payment_status: string;
    provider_user_id: string;
    worker_user_id: string;
    opportunity_title: string;
  }> {
    const assignRes = await query<{
      id: string;
      status: string;
      agreed_wage: number;
      payment_status: string;
      provider_user_id: string;
      worker_user_id: string;
      opportunity_title: string;
    }>(
      `SELECT 
         a.id, 
         a.status, 
         a.agreed_wage, 
         a.payment_status,
         p.user_id AS provider_user_id,
         w.user_id AS worker_user_id,
         wo.title AS opportunity_title
       FROM assignments a
       JOIN provider_profiles p ON a.provider_id = p.id
       JOIN worker_profiles w ON a.worker_id = w.id
       JOIN work_opportunities wo ON a.work_opportunity_id = wo.id
       WHERE a.id = $1`,
      [assignmentId]
    );

    const assignment = assignRes.rows[0];
    if (!assignment) {
      throw new AppError("Assignment not found", 404, ErrorCode.NOT_FOUND);
    }

    if (assignment.provider_user_id !== payerUserId) {
      throw new AppError(
        "You are not authorized to initiate payment for this assignment",
        403,
        ErrorCode.FORBIDDEN
      );
    }

    if (assignment.status !== "COMPLETED" && assignment.status !== "SETTLEMENT_PENDING") {
      throw new AppError(
        `Cannot initiate payment for assignment in '${assignment.status}' status. Work must be verified as COMPLETED or SETTLEMENT_PENDING first.`,
        400,
        ErrorCode.PAYMENT_NOT_ELIGIBLE
      );
    }

    if (assignment.payment_status === "DISPUTED") {
      throw new AppError(
        "Cannot initiate payment for an assignment under active dispute. The dispute must be resolved first.",
        409,
        ErrorCode.PAYMENT_DISPUTED
      );
    }

    if (assignment.payment_status === "CONFIRMED") {
      throw new AppError(
        "This assignment has already been successfully paid and confirmed",
        400,
        ErrorCode.PAYMENT_ALREADY_CONFIRMED
      );
    }

    // Check for any active open dispute in the disputes table
    const openDispute = await query(
      `SELECT id FROM disputes WHERE assignment_id = $1 AND status IN ('OPEN', 'INVESTIGATING', 'UNDER_REVIEW') LIMIT 1`,
      [assignmentId]
    );
    if (openDispute?.rows && openDispute.rows.length > 0) {
      throw new AppError(
        "Cannot initiate payment for an assignment with an open dispute. The dispute must be resolved first.",
        409,
        ErrorCode.PAYMENT_DISPUTED
      );
    }

    // Check if there is already a CONFIRMED payment record for this assignment
    const confirmedRecord = await query(
      `SELECT id FROM payment_records WHERE assignment_id = $1 AND status = 'CONFIRMED' LIMIT 1`,
      [assignmentId]
    );
    if (confirmedRecord?.rows && confirmedRecord.rows.length > 0) {
      throw new AppError(
        "This assignment has already been successfully paid and confirmed",
        400,
        ErrorCode.PAYMENT_ALREADY_CONFIRMED
      );
    }

    return assignment;
  }

  private mapRowToResponse(row: any, fallbackTitle?: string): PaymentRecordResponse {
    const amountFloat = Number(row.amount);
    const amountPaise = row.amount_paise ? parseInt(row.amount_paise, 10) : Math.round(amountFloat * 100);
    const feeFloat = Number(row.platform_fee || 0);
    const feePaise = row.platform_fee_paise ? parseInt(row.platform_fee_paise, 10) : Math.round(feeFloat * 100);
    const netFloat = Number(row.net_payout || amountFloat - feeFloat);
    const netPaise = row.net_payout_paise ? parseInt(row.net_payout_paise, 10) : Math.round(netFloat * 100);

    return {
      id: row.id,
      assignmentId: row.assignment_id,
      payerId: row.payer_id,
      payeeId: row.payee_id,
      payerName: row.payer_name,
      payerBusinessName: row.payer_business_name,
      payeeName: row.payee_name,
      opportunityTitle: row.opportunity_title || fallbackTitle,
      workType: row.work_type,
      workDate: row.work_date,
      amount: amountFloat,
      amountPaise,
      platformFee: feeFloat,
      platformFeePaise: feePaise,
      netPayout: netFloat,
      netPayoutPaise: netPaise,
      currency: row.currency || "INR",
      status: row.status,
      paymentMethod: row.payment_method,
      transactionRef: row.transaction_ref,
      gatewayOrderId: row.gateway_order_id,
      paymentPin: row.payment_pin_verified_at ? row.payment_pin : undefined,
      paymentPinAttempts: row.payment_pin_attempts,
      paymentPinVerifiedAt: row.payment_pin_verified_at,
      cashConfirmedByPayerAt: row.cash_confirmed_by_payer_at,
      cashConfirmedByPayeeAt: row.cash_confirmed_by_payee_at,
      reconciliationStatus: row.reconciliation_status,
      notes: row.notes,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const paymentsService = new PaymentsService();
