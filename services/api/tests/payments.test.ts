import { describe, it, expect, vi, beforeEach } from "vitest";
import { paymentsService } from "../src/modules/payments/service";
import { defaultPaymentProvider } from "../src/modules/payments/provider/sandbox.provider";
import * as db from "../src/db";
import { AppError } from "../src/middleware/errorHandler";
import crypto from "crypto";

// Mock the db module
vi.mock("../src/db", () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

describe("Phase 14: Payments, Earnings & Settlement Module", () => {
  const providerUserId = "prov-user-100";
  const otherProviderUserId = "prov-user-200";
  const workerUserId = "work-user-300";
  const otherWorkerUserId = "work-user-400";
  const assignmentId = "assign-uuid-001";
  const paymentId = "pay-uuid-001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Payment Initiation & Trigger Validation", () => {
    it("should allow provider to initiate payment for a COMPLETED assignment", async () => {
      vi.mocked(db.query).mockImplementation(async (sql: string, params: any) => {
        if (sql.includes("FROM assignments a")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: assignmentId,
                status: "COMPLETED",
                agreed_wage: 650.0,
                payment_status: "PENDING",
                provider_user_id: providerUserId,
                worker_user_id: workerUserId,
                opportunity_title: "Event Kitchen Helper",
              },
            ],
          } as any;
        }
        if (sql.includes("SELECT id FROM payment_records WHERE assignment_id")) {
          return { rowCount: 0, rows: [] } as any;
        }
        if (sql.includes("INSERT INTO payment_records")) {
          return {
            rowCount: 1,
            rows: [
              {
                id: paymentId,
                assignment_id: assignmentId,
                payer_id: providerUserId,
                payee_id: workerUserId,
                amount: 650.0,
                amount_paise: 65000,
                currency: "INR",
                status: "PENDING",
                payment_method: "UPI",
                transaction_ref: "order_sb_test",
                gateway_order_id: "order_sb_test",
                notes: "Wage payment",
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          } as any;
        }
        if (sql.includes("INSERT INTO notifications")) {
          return { rowCount: 1, rows: [] } as any;
        }
        return { rowCount: 0, rows: [] } as any;
      });

      const result = await paymentsService.initiatePayment(providerUserId, assignmentId, {
        paymentMethod: "UPI",
      });

      expect(result.payment.id).toBe(paymentId);
      expect(result.payment.amount).toBe(650.0);
      expect(result.payment.amountPaise).toBe(65000);
      expect(result.order.gatewayOrderId).toBeDefined();
    });

    it("should reject payment initiation if assignment is NOT COMPLETED", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: assignmentId,
            status: "IN_PROGRESS", // Work not finished!
            agreed_wage: 650.0,
            payment_status: "PENDING",
            provider_user_id: providerUserId,
            worker_user_id: workerUserId,
            opportunity_title: "Event Kitchen Helper",
          },
        ],
      } as any);

      await expect(
        paymentsService.initiatePayment(providerUserId, assignmentId, {})
      ).rejects.toThrow(/COMPLETED first/);
    });

    it("should reject payment initiation if assignment is already CONFIRMED", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: assignmentId,
            status: "COMPLETED",
            agreed_wage: 650.0,
            payment_status: "CONFIRMED", // Already settled!
            provider_user_id: providerUserId,
            worker_user_id: workerUserId,
            opportunity_title: "Event Kitchen Helper",
          },
        ],
      } as any);

      await expect(
        paymentsService.initiatePayment(providerUserId, assignmentId, {})
      ).rejects.toThrow(/already been successfully paid/);
    });

    it("should reject payment initiation if unauthorized user attempts to pay", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: assignmentId,
            status: "COMPLETED",
            agreed_wage: 650.0,
            payment_status: "PENDING",
            provider_user_id: providerUserId, // Actual employer is providerUserId
            worker_user_id: workerUserId,
            opportunity_title: "Event Kitchen Helper",
          },
        ],
      } as any);

      await expect(
        paymentsService.initiatePayment(otherProviderUserId, assignmentId, {})
      ).rejects.toThrow(/not authorized/);
    });
  });

  describe("2. Direct Confirmation & Settlement", () => {
    it("should confirm payment atomically and update assignment status", async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string, params: any) => {
            if (sql.includes("SELECT id, assignment_id")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: paymentId,
                    assignment_id: assignmentId,
                    payer_id: providerUserId,
                    payee_id: workerUserId,
                    amount: 650.0,
                    amount_paise: 65000,
                    status: "PENDING",
                  },
                ],
              };
            }
            if (sql.includes("UPDATE payment_records")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: paymentId,
                    assignment_id: assignmentId,
                    payer_id: providerUserId,
                    payee_id: workerUserId,
                    amount: 650.0,
                    amount_paise: 65000,
                    status: "CONFIRMED",
                    payment_method: "UPI",
                    transaction_ref: "tx_12345",
                    recorded_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                  },
                ],
              };
            }
            if (sql.includes("UPDATE assignments")) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes("INSERT INTO notifications")) {
              return { rowCount: 1, rows: [] };
            }
            return { rowCount: 0, rows: [] };
          }),
        };
        return await cb(mockClient as any);
      });

      const confirmed = await paymentsService.confirmPaymentDirect(providerUserId, paymentId, {
        paymentMethod: "UPI",
        transactionRef: "tx_12345",
      });

      expect(confirmed.status).toBe("CONFIRMED");
      expect(confirmed.amount).toBe(650.0);
    });
  });

  describe("3. Webhook Signature & Idempotency", () => {
    const defaultSecret = "nearvia_sandbox_webhook_secret_key_2026";

    it("should accept valid HMAC-SHA256 signature and confirm payment idempotently", async () => {
      const payload = JSON.stringify({
        event: "PAYMENT_CONFIRMED",
        gatewayOrderId: "order_sb_test1",
        gatewayPaymentId: "pay_sb_test1",
        amountPaise: 50000,
      });

      const signature = crypto
        .createHmac("sha256", defaultSecret)
        .update(payload)
        .digest("hex");

      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("SELECT id, assignment_id")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: "pay-1",
                    assignment_id: "asg-1",
                    payer_id: providerUserId,
                    payee_id: workerUserId,
                    amount: 500.0,
                    status: "PENDING",
                  },
                ],
              };
            }
            return { rowCount: 1, rows: [] };
          }),
        };
        return await cb(mockClient as any);
      });

      const result = await paymentsService.processWebhook(payload, signature);
      expect(result.processed).toBe(true);
      expect(result.event).toBe("PAYMENT_CONFIRMED");
    });

    it("should reject webhook with invalid signature", async () => {
      const payload = JSON.stringify({ event: "PAYMENT_CONFIRMED" });
      const badSignature = "0000000000000000000000000000000000000000000000000000000000000000";

      await expect(paymentsService.processWebhook(payload, badSignature)).rejects.toThrow(
        /Invalid webhook signature/
      );
    });
  });

  describe("4. Worker Earnings & Financial Calculations", () => {
    it("should calculate worker earnings accurately in paise with zero floating-point error", async () => {
      vi.mocked(db.query).mockResolvedValueOnce({
        rowCount: 2,
        rows: [
          { status: "CONFIRMED", count: "3", total_paise: "155050" }, // ₹1550.50
          { status: "PENDING", count: "1", total_paise: "40000" }, // ₹400.00
        ],
      } as any);

      const earnings = await paymentsService.getWorkerEarnings(workerUserId);
      expect(earnings.totalEarned).toBe(1550.5);
      expect(earnings.totalEarnedPaise).toBe(155050);
      expect(earnings.pendingSettlement).toBe(400);
      expect(earnings.completedPaymentsCount).toBe(3);
      expect(earnings.pendingPaymentsCount).toBe(1);
    });
  });

  describe("5. Refund Foundation", () => {
    it("should allow payer to refund a CONFIRMED payment", async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes("SELECT id, assignment_id")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: paymentId,
                    assignment_id: assignmentId,
                    payer_id: providerUserId,
                    payee_id: workerUserId,
                    amount: 650.0,
                    amount_paise: 65000,
                    status: "CONFIRMED",
                    gateway_payment_id: "pay_test",
                  },
                ],
              };
            }
            if (sql.includes("UPDATE payment_records")) {
              return {
                rowCount: 1,
                rows: [
                  {
                    id: paymentId,
                    assignment_id: assignmentId,
                    payer_id: providerUserId,
                    payee_id: workerUserId,
                    amount: 650.0,
                    status: "REFUNDED",
                    notes: "Refund Reason: Duplicate billing",
                    recorded_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                  },
                ],
              };
            }
            return { rowCount: 1, rows: [] };
          }),
        };
        return await cb(mockClient as any);
      });

      const refunded = await paymentsService.refundPayment(providerUserId, paymentId, {
        reason: "Duplicate billing",
      });

      expect(refunded.status).toBe("REFUNDED");
    });

    it("should reject refund if payment is NOT CONFIRMED", async () => {
      vi.mocked(db.withTransaction).mockImplementation(async (cb) => {
        const mockClient = {
          query: vi.fn().mockResolvedValue({
            rowCount: 1,
            rows: [
              {
                id: paymentId,
                payer_id: providerUserId,
                status: "PENDING", // Cannot refund an unsettled payment!
              },
            ],
          }),
        };
        return await cb(mockClient as any);
      });

      await expect(
        paymentsService.refundPayment(providerUserId, paymentId, { reason: "Cancelled" })
      ).rejects.toThrow(/Only CONFIRMED payments can be refunded/);
    });
  });
});
