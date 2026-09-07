import { describe, it, expect, vi, beforeEach } from "vitest";
import { paymentsService } from "../src/modules/payments/service";
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

describe("Phase 7 — Payment Operations, Cash, Receipts & Reconciliation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCompletedAssignment = {
    id: "asn_p7_01",
    status: "COMPLETED",
    agreed_wage: 900,
    payment_status: "PENDING",
    provider_user_id: "usr_provider_01",
    worker_user_id: "usr_worker_01",
    opportunity_title: "Festival Sweet Packing",
  };

  const mockPaymentRecord = {
    id: "pay_01",
    assignment_id: "asn_p7_01",
    payer_id: "usr_provider_01",
    payee_id: "usr_worker_01",
    amount: 900,
    amount_paise: 90000,
    platform_fee: 0,
    platform_fee_paise: 0,
    net_payout: 900,
    net_payout_paise: 90000,
    currency: "INR",
    status: "PENDING",
    payment_method: "CASH",
    transaction_ref: "cash_1725280000",
    gateway_order_id: null,
    payment_pin: "4821",
    payment_pin_attempts: 0,
    payment_pin_verified_at: null,
    cash_confirmed_by_payer_at: new Date().toISOString(),
    cash_confirmed_by_payee_at: null,
    reconciliation_status: "MATCHED",
    notes: "Cash payment initiated",
    recorded_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  // ----------------------------------------------------
  // 1. Payment Eligibility & Ownership
  // ----------------------------------------------------
  describe("Payment Eligibility & Validation", () => {
    it("rejects payment initiation if work is not COMPLETED", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [{ ...mockCompletedAssignment, status: "IN_PROGRESS" }],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      await expect(
        paymentsService.initiateCashPayment("usr_provider_01", "asn_p7_01", {})
      ).rejects.toThrow(/COMPLETED/);
    });

    it("rejects payment initiation by unauthorized user", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockCompletedAssignment],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      await expect(
        paymentsService.initiateCashPayment("usr_intruder_99", "asn_p7_01", {})
      ).rejects.toThrow(/not authorized/);
    });
  });

  // ----------------------------------------------------
  // 2. Cash Workflow & PIN Security
  // ----------------------------------------------------
  describe("Cash Payment Lifecycle", () => {
    it("initiates cash payment, generates 4-digit PIN, and returns PIN to provider", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [mockCompletedAssignment],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("payment_records")) {
              return { rows: [] };
            }
            if (text.includes("INSERT INTO payment_records")) {
              return { rows: [mockPaymentRecord] };
            }
            if (text.includes("UPDATE assignments")) {
              return { rowCount: 1 };
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      const result = await paymentsService.initiateCashPayment("usr_provider_01", "asn_p7_01", {});

      expect(result.paymentPin).toBeDefined();
      expect(result.paymentPin.length).toBe(4);
      expect(result.payment.paymentMethod).toBe("CASH");
      expect(result.message).toContain("Hand over physical cash");
    });

    it("allows assigned worker to verify correct PIN and confirms cash receipt", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [mockCompletedAssignment] };
            }
            if (text.includes("SELECT") && text.includes("payment_records")) {
              return { rows: [mockPaymentRecord] };
            }
            if (text.includes("UPDATE payment_records")) {
              return {
                rows: [
                  {
                    ...mockPaymentRecord,
                    status: "CONFIRMED",
                    payment_pin_verified_at: new Date().toISOString(),
                    cash_confirmed_by_payee_at: new Date().toISOString(),
                  },
                ],
              };
            }
            return { rowCount: 1, rows: [] };
          }),
        };
        return cb(client);
      });

      const result = await paymentsService.confirmCashPayment("usr_worker_01", "asn_p7_01", {
        paymentPin: "4821",
      });

      expect(result.status).toBe("CONFIRMED");
      expect(result.disclaimer).toContain("NEARVIA does not hold custody");
    });

    it("rejects invalid PIN and tracks failed attempts", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [mockCompletedAssignment] };
            }
            if (text.includes("SELECT") && text.includes("payment_records")) {
              return { rows: [mockPaymentRecord] };
            }
            if (text.includes("UPDATE payment_records")) {
              return { rowCount: 1 };
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      await expect(
        paymentsService.confirmCashPayment("usr_worker_01", "asn_p7_01", {
          paymentPin: "0000",
        })
      ).rejects.toThrow(/Invalid Payment PIN/);
    });

    it("locks out confirmation when max attempts (5) exceeded", async () => {
      const lockedRecord = { ...mockPaymentRecord, payment_pin_attempts: 5 };
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [mockCompletedAssignment] };
            }
            if (text.includes("SELECT") && text.includes("payment_records")) {
              return { rows: [lockedRecord] };
            }
            return { rows: [] };
          }),
        };
        return cb(client);
      });

      await expect(
        paymentsService.confirmCashPayment("usr_worker_01", "asn_p7_01", {
          paymentPin: "4821",
        })
      ).rejects.toThrow(/Maximum PIN verification attempts exceeded/);
    });
  });

  // ----------------------------------------------------
  // 3. Receipts & Disclaimers
  // ----------------------------------------------------
  describe("Payment Receipts", () => {
    it("generates canonical receipt with legal disclaimer and fee breakdown", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rows: [
          {
            id: "pay_01",
            assignment_id: "asn_p7_01",
            payer_id: "usr_provider_01",
            payee_id: "usr_worker_01",
            amount: 900,
            currency: "INR",
            platform_fee: 0,
            net_payout: 900,
            status: "CONFIRMED",
            payment_method: "CASH",
            transaction_ref: "cash_settled_1725280000",
            recorded_at: new Date().toISOString(),
            payer_name: "Anand Kumar",
            payer_business_name: "Anand Sweets",
            payee_name: "Sunil Verma",
            opportunity_title: "Festival Sweet Packing",
            work_type: "TASK",
            work_date: "2026-09-02",
          },
        ],
        rowCount: 1,
        command: "",
        oid: 0,
        fields: [],
      });

      const receipt = await paymentsService.getPaymentReceipt("usr_worker_01", "pay_01");

      expect(receipt.amount).toBe(900);
      expect(receipt.platformFee).toBe(0);
      expect(receipt.netPayout).toBe(900);
      expect(receipt.receiptNumber).toMatch(/^REC-/);
      expect(receipt.disclaimer).toContain("directly between employer and worker");
    });
  });

  // ----------------------------------------------------
  // 4. Disputes & Automated Reconciliation
  // ----------------------------------------------------
  describe("Disputes & Reconciliation", () => {
    it("allows disputing payment and marks status as DISPUTED", async () => {
      vi.mocked(db.withTransaction).mockImplementationOnce(async (cb: any) => {
        const client = {
          query: vi.fn().mockImplementation((text: string) => {
            if (text.includes("SELECT") && text.includes("assignments")) {
              return { rows: [mockCompletedAssignment] };
            }
            if (text.includes("INSERT INTO disputes")) {
              return { rows: [{ id: "disp_01" }] };
            }
            return { rowCount: 1, rows: [] };
          }),
        };
        return cb(client);
      });

      const result = await paymentsService.disputePayment("usr_worker_01", "asn_p7_01", {
        reason: "CASH_NOT_RECEIVED",
        description: "Cash was never handed over by employer.",
      });

      expect(result.disputeId).toBe("disp_01");
      expect(result.status).toBe("DISPUTED");
    });

    it("runs reconciliation audit across payment records", async () => {
      vi.mocked(db.query)
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] }) // stale cash
        .mockResolvedValueOnce({ rows: [], rowCount: 0, command: "", oid: 0, fields: [] }) // missing pay
        .mockResolvedValueOnce({
          rows: [{ id: "pay_disp_01", assignment_id: "asn_01", amount: 500 }],
          rowCount: 1,
          command: "",
          oid: 0,
          fields: [],
        }) // disputed
        .mockResolvedValueOnce({
          rows: [{ count: "25" }],
          rowCount: 1,
          command: "",
          oid: 0,
          fields: [],
        }); // total

      const report = await paymentsService.reconcilePayments();

      expect(report.totalChecked).toBe(25);
      expect(report.disputedCount).toBe(1);
      expect(report.discrepanciesCount).toBe(1);
      expect(report.issues[0].issueType).toBe("ACTIVE_DISPUTE");
    });
  });
});
