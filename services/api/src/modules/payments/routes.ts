/**
 * Payments Routes (Phase 7)
 * /api/v1/payments/*
 */

import { Router } from "express";
import { authenticateUser, requireRole } from "../../middleware/auth.middleware";
import { webhookLimiter, paymentLimiter } from "../../middleware/rateLimiter";
import { UserRole } from "@nearvia/types";
import { paymentsController } from "./controller";

const router = Router();

// ── Public Webhook Endpoint (Protected by HMAC & IP/Webhook Rate Limiter) ──
router.post("/webhook", webhookLimiter, (req, res, next) =>
  paymentsController.processWebhook(req, res, next)
);

// ── Status ──
router.get("/status", (req, res) => paymentsController.getStatus(req, res));

// ── Protected Routes (Require JWT) ──
router.use(authenticateUser);

// ── Worker Earnings & Transactions ──
router.get(
  "/worker/earnings",
  requireRole(UserRole.WORKER),
  (req, res, next) => paymentsController.getWorkerEarnings(req, res, next)
);

router.get(
  "/worker/transactions",
  requireRole(UserRole.WORKER),
  (req, res, next) => paymentsController.getWorkerTransactions(req, res, next)
);

// ── Cash Confirmation & PIN Verification (Worker) ──
router.post(
  "/assignments/:id/cash/confirm",
  requireRole(UserRole.WORKER),
  paymentLimiter,
  (req, res, next) => paymentsController.confirmCashPayment(req, res, next)
);

// ── Provider Payments & Settlement ──
router.post(
  "/assignments/:id/pay",
  requireRole(UserRole.PROVIDER),
  paymentLimiter,
  (req, res, next) => paymentsController.initiatePayment(req, res, next)
);

router.post(
  "/assignments/:id/cash/initiate",
  requireRole(UserRole.PROVIDER),
  paymentLimiter,
  (req, res, next) => paymentsController.initiateCashPayment(req, res, next)
);

router.post(
  "/:id/confirm",
  requireRole(UserRole.PROVIDER),
  paymentLimiter,
  (req, res, next) => paymentsController.confirmPaymentDirect(req, res, next)
);

router.get(
  "/provider/summary",
  requireRole(UserRole.PROVIDER),
  (req, res, next) => paymentsController.getProviderPaymentsSummary(req, res, next)
);

router.get(
  "/provider/history",
  requireRole(UserRole.PROVIDER),
  (req, res, next) => paymentsController.getProviderPaymentsHistory(req, res, next)
);

router.get(
  "/provider/payable",
  requireRole(UserRole.PROVIDER),
  (req, res, next) => paymentsController.getProviderPayableAssignments(req, res, next)
);

// ── Payment Disputes ──
router.post(
  "/assignments/:id/dispute",
  (req, res, next) => paymentsController.disputePayment(req, res, next)
);

// ── Payment Receipts ──
router.get(
  "/assignments/:id/receipt",
  (req, res, next) => paymentsController.getAssignmentPaymentReceipt(req, res, next)
);

router.get(
  "/:id/receipt",
  (req, res, next) => paymentsController.getPaymentReceipt(req, res, next)
);

// ── Automated Reconciliation (Admin / Cron) ──
router.post(
  "/reconcile",
  requireRole(UserRole.ADMIN),
  (req, res, next) => paymentsController.reconcilePayments(req, res, next)
);

// ── Shared Payment Details & Refunds ──
router.get("/:id", (req, res, next) =>
  paymentsController.getPaymentDetail(req, res, next)
);

router.post("/:id/refund", (req, res, next) =>
  paymentsController.refundPayment(req, res, next)
);

export default router;
