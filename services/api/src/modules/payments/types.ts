/**
 * Payments Domain Module Types & Contracts (Phase 7)
 * Money operations strictly use integer minor units (paise) for financial accuracy.
 * Decoupled support for CASH and ONLINE payment methods with receipts, dual confirmation, and reconciliation.
 */

import { z } from "zod";

// ── Validation Schemas ──

export const initiatePaymentSchema = z.object({
  paymentMethod: z.enum(["CASH", "ONLINE", "UPI", "CARD", "NETBANKING"]).optional().default("UPI"),
  idempotencyKey: z.string().max(255).optional(),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;

export const initiateCashPaymentSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type InitiateCashPaymentInput = z.infer<typeof initiateCashPaymentSchema>;

export const confirmCashPaymentSchema = z.object({
  paymentPin: z.string().min(4).max(6),
  notes: z.string().max(500).optional(),
});

export type ConfirmCashPaymentInput = z.infer<typeof confirmCashPaymentSchema>;

export const confirmPaymentSchema = z.object({
  paymentMethod: z.string().max(50).optional().default("UPI"),
  transactionRef: z.string().max(255).optional(),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

export const refundPaymentSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

export const disputePaymentSchema = z.object({
  reason: z.string().min(3).max(255),
  description: z.string().min(10).max(1000),
});

export type DisputePaymentInput = z.infer<typeof disputePaymentSchema>;

// ── Domain Response Models ──

export interface PaymentRecordResponse {
  id: string;
  assignmentId: string;
  payerId: string;
  payeeId: string;
  payerName?: string;
  payerBusinessName?: string;
  payeeName?: string;
  opportunityTitle?: string;
  workType?: string;
  workDate?: string;
  amount: number; // In INR (e.g. 500.00)
  amountPaise: number; // In integer minor units (e.g. 50000)
  platformFee: number;
  platformFeePaise: number;
  netPayout: number;
  netPayoutPaise: number;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "DISPUTED" | "REFUNDED" | "SETTLED" | string;
  paymentMethod: string | null;
  transactionRef: string | null;
  gatewayOrderId: string | null;
  paymentPin?: string | null; // Only returned to authorized party (provider during initiation)
  paymentPinAttempts?: number;
  paymentPinVerifiedAt?: string | null;
  cashConfirmedByPayerAt?: string | null;
  cashConfirmedByPayeeAt?: string | null;
  reconciliationStatus?: string;
  notes: string | null;
  disclaimer?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  assignmentId: string;
  opportunityTitle: string;
  workType: string;
  workDate: string;
  payerName: string;
  payerBusinessName?: string;
  payeeName: string;
  amount: number;
  platformFee: number;
  netPayout: number;
  currency: string;
  paymentMethod: string;
  status: string;
  transactionRef: string;
  recordedAt: string;
  cashConfirmedByPayerAt?: string;
  cashConfirmedByPayeeAt?: string;
  disclaimer: string;
}

export interface WorkerEarningsSummary {
  todayEarnings: number;
  todayEarningsPaise: number;
  weekEarnings: number;
  weekEarningsPaise: number;
  monthEarnings: number;
  monthEarningsPaise: number;
  totalEarned: number; // In INR
  totalEarnedPaise: number;
  pendingSettlement: number; // In INR
  pendingSettlementPaise: number;
  completedPaymentsCount: number;
  pendingPaymentsCount: number;
}

export interface ProviderPaymentsSummary {
  totalPaid: number; // In INR
  totalPaidPaise: number;
  pendingPayable: number; // In INR
  pendingPayablePaise: number;
  completedCount: number;
  pendingPayableCount: number;
}

export interface PayableAssignmentItem {
  assignmentId: string;
  workOpportunityId: string;
  title: string;
  workType: string;
  workDate: string;
  workerId: string;
  workerUserId: string;
  workerName: string;
  workerPhone: string;
  agreedWage: number;
  agreedWagePaise: number;
  completedAt: string;
  paymentStatus: string;
}

export interface PaymentReconciliationReport {
  totalChecked: number;
  matchedCount: number;
  discrepanciesCount: number;
  disputedCount: number;
  unreconciledCount: number;
  issues: Array<{
    paymentId: string;
    assignmentId: string;
    issueType: string;
    description: string;
    actionRequired: string;
  }>;
  reconciledAt: string;
}

// ── Payment Provider Abstraction Contracts ──

export interface CreateOrderParams {
  orderId: string;
  assignmentId: string;
  amountPaise: number;
  currency: string;
  payerUserId: string;
  payeeUserId: string;
  description: string;
}

export interface PaymentOrderResult {
  gatewayOrderId: string;
  amountPaise: number;
  currency: string;
  checkoutUrl?: string;
  clientSecret?: string;
  provider: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  event?: "PAYMENT_CONFIRMED" | "PAYMENT_FAILED" | "REFUND_PROCESSED";
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  amountPaise?: number;
  errorReason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amountPaise: number;
}

export interface IPaymentsState {
  module: "payments";
  status: "initialized";
  description: string;
}
