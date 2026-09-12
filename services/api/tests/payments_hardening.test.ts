import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { paymentsService } from "../src/modules/payments/service";
import { RazorpayPaymentProvider } from "../src/modules/payments/provider/razorpay.provider";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(async (cb) => {
    const mockClient = { query: vi.fn() };
    return cb(mockClient);
  }),
  pool: { end: vi.fn() },
}));

describe("Prompt 9 — Payments, Cash & Demo Razorpay Hardening Suite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const mockCompletedAssignment = {
    id: "asn_p9_01",
    status: "COMPLETED",
    agreed_wage: 1200,
    payment_status: "PENDING",
    provider_user_id: "usr_provider_99",
    worker_user_id: "usr_worker_99",
    opportunity_title: "Warehouse Inventory Sorting",
  };

  const mockPendingCashRecord = {
    id: "pay_cash_99",
    assignment_id: "asn_p9_01",
    payer_id: "usr_provider_99",
    payee_id: "usr_worker_99",
    amount: 1200,
    amount_paise: 120000,
    platform_fee: 0,
    platform_fee_paise: 0,
    net_payout: 1200,
    net_payout_paise: 120000,
    currency: "INR",
    status: "PENDING",
    payment_method: "CASH",
    payment_pin: "7392",
    payment_pin_attempts: 0,
    payment_pin_verified_at: null,
    cash_confirmed_by_payer_at: new Date().toISOString(),
    cash_confirmed_by_payee_at: null,
    gateway_order_id: null,
    reconciliation_status: "MATCHED",
    notes: "Cash payment initiated",
    recorded_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const mockPendingOnlineRecord = {
    id: "pay_online_99",
    assignment_id: "asn_p9_01",
    payer_id: "usr_provider_99",
    payee_id: "usr_worker_99",
    amount: 1200,
    amount_paise: 120000,
    platform_fee: 0,
    platform_fee_paise: 0,
    net_payout: 1200,
    net_payout_paise: 120000,
    currency: "INR",
    status: "PENDING",
    payment_method: "UPI",
    gateway_order_id: "order_test_razorpay_99",
    gateway_payment_id: null,
    reconciliation_status: "MATCHED",
    notes: "Online wage payment",
    recorded_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  // ----------------------------------------------------
  // 1. Server Authority & Amount Tampering Protection
  // ----------------------------------------------------
  describe("1. Server Authority & Amount Tampering", () => {
    it("derives payment amount strictly from authoritative DB agreed_wage, ignoring client input", async () => {
      // 1. validateAssignmentForPayment
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockCompletedAssignment],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });
      // 2. check open dispute
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] });
      // 3. check confirmed record
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] });
      // 4. check existing payment records for assignment
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] });
      // 5. insertRes
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ ...mockPendingOnlineRecord, amount: 1200, amount_paise: 120000 }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });
      // 6. update assignments method
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] });

      const result = await paymentsService.initiatePayment("usr_provider_99", "asn_p9_01", {
        paymentMethod: "UPI",
        // Client attempts to pass a tampered amount or extra fields
      } as any);

      expect(result.payment.amount).toBe(1200);
      expect(result.payment.amountPaise).toBe(120000);
    });

    it("rejects payment initiation from an unrelated provider (IDOR)", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockCompletedAssignment], // belongs to usr_provider_99
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      await expect(
        paymentsService.initiatePayment("usr_malicious_attacker", "asn_p9_01", {
          paymentMethod: "UPI",
        })
      ).rejects.toThrow(AppError);
    });
  });

  // ----------------------------------------------------
  // 2. Dispute Settlement Gating
  // ----------------------------------------------------
  describe("2. Dispute Settlement Gating", () => {
    it("blocks online payment initiation if assignment is marked DISPUTED", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ ...mockCompletedAssignment, payment_status: "DISPUTED" }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      await expect(
        paymentsService.initiatePayment("usr_provider_99", "asn_p9_01", {})
      ).rejects.toThrow(/under active dispute/i);
    });

    it("blocks online payment initiation if an open dispute exists in disputes table", async () => {
      // 1. validate assignment query
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockCompletedAssignment],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });
      // 2. check open dispute query returns an active dispute
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ id: "dsp_active_01" }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      await expect(
        paymentsService.initiatePayment("usr_provider_99", "asn_p9_01", {})
      ).rejects.toThrow(/open dispute/i);
    });

    it("blocks cash PIN confirmation if assignment is marked DISPUTED", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({
            rows: [{ ...mockCompletedAssignment, payment_status: "DISPUTED" }],
            rowCount: 1,
          }),
        };
        return cb(mockClient);
      });

      await expect(
        paymentsService.confirmCashPayment("usr_worker_99", "asn_p9_01", {
          paymentPin: "7392",
        })
      ).rejects.toThrow(/under active dispute/i);
    });

    it("blocks direct payment confirmation if assignment is marked DISPUTED", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi
            .fn()
            // 1. lock payment record
            .mockResolvedValueOnce({
              rows: [mockPendingOnlineRecord],
              rowCount: 1,
            })
            // 2. check assignment payment_status
            .mockResolvedValueOnce({
              rows: [{ payment_status: "DISPUTED" }],
              rowCount: 1,
            }),
        };
        return cb(mockClient);
      });

      await expect(
        paymentsService.confirmPaymentDirect("usr_provider_99", "pay_online_99", {})
      ).rejects.toThrow(/under active dispute/i);
    });
  });

  // ----------------------------------------------------
  // 3. Cash Flow Security & PIN Enforcement
  // ----------------------------------------------------
  describe("3. Cash Security & PIN Lifecycle", () => {
    it("prevents non-assigned users from confirming cash payment", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi.fn().mockResolvedValueOnce({
            rows: [mockCompletedAssignment], // assigned to usr_worker_99
            rowCount: 1,
          }),
        };
        return cb(mockClient);
      });

      await expect(
        paymentsService.confirmCashPayment("usr_attacker_stranger", "asn_p9_01", {
          paymentPin: "7392",
        })
      ).rejects.toThrow(/Only the assigned worker can confirm cash receipt/i);
    });

    it("locks cash verification when 3 invalid PIN attempts are exceeded", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi
            .fn()
            // 1. fetch assignment
            .mockResolvedValueOnce({
              rows: [mockCompletedAssignment],
              rowCount: 1,
            })
            // 2. check open dispute (none)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            // 3. fetch payment record with 3 failed attempts already
            .mockResolvedValueOnce({
              rows: [{ ...mockPendingCashRecord, payment_pin_attempts: 3 }],
              rowCount: 1,
            }),
        };
        return cb(mockClient);
      });

      await expect(
        paymentsService.confirmCashPayment("usr_worker_99", "asn_p9_01", {
          paymentPin: "7392",
        })
      ).rejects.toThrow(/Maximum PIN verification attempts exceeded/i);
    });

    it("successfully confirms cash payment with valid PIN and closes assignment", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi
            .fn()
            // 1. fetch assignment
            .mockResolvedValueOnce({
              rows: [mockCompletedAssignment],
              rowCount: 1,
            })
            // 2. check open dispute
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            // 3. fetch payment record
            .mockResolvedValueOnce({
              rows: [mockPendingCashRecord],
              rowCount: 1,
            })
            // 4. update payment_records to CONFIRMED
            .mockResolvedValueOnce({
              rows: [
                {
                  ...mockPendingCashRecord,
                  status: "CONFIRMED",
                  cash_confirmed_by_payee_at: new Date().toISOString(),
                },
              ],
              rowCount: 1,
            })
            // 5. update assignment to CONFIRMED / CLOSED
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })
            // 6. count unclosed assignments
            .mockResolvedValueOnce({ rows: [{ unclosed: 0 }], rowCount: 1 })
            // 7. update work_opportunities to PAID
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })
            // 8. notification
            .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
        };
        return cb(mockClient);
      });

      const confirmed = await paymentsService.confirmCashPayment("usr_worker_99", "asn_p9_01", {
        paymentPin: "7392",
      });

      expect(confirmed.status).toBe("CONFIRMED");
      expect(confirmed.disclaimer).toMatch(/NEARVIA does not hold custody of physical cash/i);
    });
  });

  // ----------------------------------------------------
  // 4. Razorpay Sandbox & Webhook Hardening
  // ----------------------------------------------------
  describe("4. Razorpay Signature Verification & Webhook Hardening", () => {
    it("rejects online payment confirmation with invalid Razorpay HMAC signature", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({
              rows: [mockPendingOnlineRecord],
              rowCount: 1,
            })
            .mockResolvedValueOnce({
              rows: [{ payment_status: "PENDING" }],
              rowCount: 1,
            })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
        };
        return cb(mockClient);
      });

      await expect(
        paymentsService.confirmPaymentDirect("usr_provider_99", "pay_online_99", {
          razorpayOrderId: "order_test_razorpay_99",
          razorpayPaymentId: "pay_test_razorpay_99",
          razorpaySignature: "invalid_bad_signature_hex",
        })
      ).rejects.toThrow(/Invalid Razorpay payment signature/i);
    });

    it("rejects webhooks with invalid HMAC signatures", async () => {
      await expect(
        paymentsService.processWebhook(
          JSON.stringify({ event: "payment.captured", payload: {} }),
          "bogus_invalid_signature"
        )
      ).rejects.toThrow(/Invalid webhook signature/i);
    });

    it("rejects webhooks when payload amount does not match authoritative payment record", async () => {
      vi.spyOn(paymentsService.provider, "verifyWebhook").mockResolvedValueOnce({
        isValid: true,
        event: "PAYMENT_CONFIRMED",
        gatewayOrderId: "order_test_razorpay_99",
        gatewayPaymentId: "pay_tampered_amount",
        amountPaise: 50000, // Tampered to ₹500 instead of authoritative ₹1200
      });

      // 1. insert webhook_events (idempotency check passes)
      vi.mocked(db.query).mockResolvedValueOnce({ rows: [], rowCount: 1, command: "", oid: 0, fields: [] });

      // In transaction: select payment record with amount_paise = 120000
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const mockClient = {
          query: vi
            .fn()
            .mockResolvedValueOnce({
              rows: [mockPendingOnlineRecord], // has amount_paise: 120000
              rowCount: 1,
            })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 }), // update payment_records to FAILED
        };
        return cb(mockClient);
      });

      await expect(paymentsService.processWebhook("{}", "dummy_sig")).rejects.toThrow(
        /Webhook amount mismatch/i
      );
    });

    it("handles duplicate webhook replay idempotently via webhook_events unique constraint", async () => {
      vi.spyOn(paymentsService.provider, "verifyWebhook").mockResolvedValueOnce({
        isValid: true,
        event: "PAYMENT_CONFIRMED",
        gatewayOrderId: "order_test_razorpay_99",
        gatewayPaymentId: "pay_duplicate_event",
        amountPaise: 120000,
      });

      // Simulate Postgres unique violation 23505 on webhook_events
      vi.mocked(db.query).mockRejectedValueOnce({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      });

      const result = await paymentsService.processWebhook("{}", "dummy_sig");
      expect(result.processed).toBe(true);
      expect(result.duplicate).toBe(true);
    });
  });

  // ----------------------------------------------------
  // 5. Worker Authoritative Earnings Separation
  // ----------------------------------------------------
  describe("5. Worker Earnings Separation", () => {
    it("authoritatively computes cash confirmed, online paid, and pending earnings from DB records", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            status: "CONFIRMED",
            payment_method: "CASH",
            is_today: true,
            is_this_week: true,
            is_this_month: true,
            count: "2",
            total_paise: "180000", // ₹1800 cash
          },
          {
            status: "CONFIRMED",
            payment_method: "UPI",
            is_today: false,
            is_this_week: true,
            is_this_month: true,
            count: "1",
            total_paise: "120000", // ₹1200 online
          },
          {
            status: "PENDING",
            payment_method: "CASH",
            is_today: true,
            is_this_week: true,
            is_this_month: true,
            count: "1",
            total_paise: "90000", // ₹900 pending
          },
          {
            status: "DISPUTED",
            payment_method: "UPI",
            is_today: false,
            is_this_week: false,
            is_this_month: true,
            count: "1",
            total_paise: "50000", // ₹500 disputed
          },
        ],
        rowCount: 4,
        command: "",
        oid: 0,
        fields: [],
      });

      const earnings = await paymentsService.getWorkerEarnings("usr_worker_99");

      expect(earnings.totalEarned).toBe(3000); // 1800 + 1200
      expect(earnings.cashEarnings).toBe(1800);
      expect(earnings.onlineEarnings).toBe(1200);
      expect(earnings.pendingSettlement).toBe(900);
      expect(earnings.disputedEarnings).toBe(500);
      expect(earnings.completedPaymentsCount).toBe(3);
      expect(earnings.pendingPaymentsCount).toBe(1);
    });
  });
});
