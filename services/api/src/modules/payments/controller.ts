/**
 * Payments Controller (Phase 7)
 * Request handlers for wage settlement, cash confirmation, worker earnings,
 * provider payments, receipts, disputes, webhooks, and reconciliation.
 */

import { Request, Response, NextFunction } from "express";
import { paymentsService } from "./service";
import {
  initiatePaymentSchema,
  initiateCashPaymentSchema,
  confirmCashPaymentSchema,
  confirmPaymentSchema,
  refundPaymentSchema,
  disputePaymentSchema,
} from "./types";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { validateUuid, clampPagination } from "../../utils/security";

export class PaymentsController {
  // ── Initiate Online Payment (Provider) ──
  async initiatePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const assignmentId = validateUuid(req.params.id, "Assignment ID");
      const data = initiatePaymentSchema.parse(req.body);
      const result = await paymentsService.initiatePayment(req.user!.id, assignmentId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Initiate Cash Payment (Provider) ──
  async initiateCashPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const assignmentId = validateUuid(req.params.id, "Assignment ID");
      const data = initiateCashPaymentSchema.parse(req.body);
      const result = await paymentsService.initiateCashPayment(req.user!.id, assignmentId, data);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Confirm Cash Payment (Worker with PIN) ──
  async confirmCashPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const assignmentId = validateUuid(req.params.id, "Assignment ID");
      const data = confirmCashPaymentSchema.parse(req.body);
      const result = await paymentsService.confirmCashPayment(req.user!.id, assignmentId, data);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Confirm Payment Direct / Sandbox (Provider) ──
  async confirmPaymentDirect(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = validateUuid(req.params.id, "Payment ID");
      const data = confirmPaymentSchema.parse(req.body);
      const payment = await paymentsService.confirmPaymentDirect(req.user!.id, paymentId, data);
      res.status(200).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }

  // ── Payment Gateway Webhook (Public, signature-verified) ──
  async processWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = (req.headers["x-nearvia-signature"] ||
        req.headers["x-razorpay-signature"] ||
        req.headers["x-webhook-signature"]) as string;

      if (!signature) {
        throw new AppError("Missing webhook signature header", 401, ErrorCode.UNAUTHORIZED);
      }

      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const result = await paymentsService.processWebhook(rawBody, signature);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Payment Receipt ──
  async getPaymentReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = validateUuid(req.params.id, "Payment ID");
      const receipt = await paymentsService.getPaymentReceipt(req.user!.id, paymentId);
      res.status(200).json({ success: true, data: receipt });
    } catch (error) {
      next(error);
    }
  }

  async getAssignmentPaymentReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const assignmentId = validateUuid(req.params.id, "Assignment ID");
      const receipt = await paymentsService.getAssignmentPaymentReceipt(req.user!.id, assignmentId);
      res.status(200).json({ success: true, data: receipt });
    } catch (error) {
      next(error);
    }
  }

  // ── Dispute Payment ──
  async disputePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const assignmentId = validateUuid(req.params.id, "Assignment ID");
      const data = disputePaymentSchema.parse(req.body);
      const result = await paymentsService.disputePayment(req.user!.id, assignmentId, data);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Reconcile Payments (Admin / Automated) ──
  async reconcilePayments(_req: Request, res: Response, next: NextFunction) {
    try {
      const report = await paymentsService.reconcilePayments();
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  // ── Worker Earnings Summary ──
  async getWorkerEarnings(req: Request, res: Response, next: NextFunction) {
    try {
      const earnings = await paymentsService.getWorkerEarnings(req.user!.id);
      res.status(200).json({ success: true, data: earnings });
    } catch (error) {
      next(error);
    }
  }

  // ── Worker Transactions ──
  async getWorkerTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = clampPagination(req.query, 20, 50);
      const status = req.query.status as string | undefined;
      const paymentMethod = req.query.paymentMethod as string | undefined;
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;

      const result = await paymentsService.getWorkerTransactions(req.user!.id, page, limit, {
        status,
        paymentMethod,
        fromDate,
        toDate,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Provider Payments Summary & History ──
  async getProviderPaymentsSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await paymentsService.getProviderPaymentsSummary(req.user!.id);
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async getProviderPaymentsHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = clampPagination(req.query, 20, 50);
      const status = req.query.status as string | undefined;
      const paymentMethod = req.query.paymentMethod as string | undefined;
      const fromDate = req.query.fromDate as string | undefined;
      const toDate = req.query.toDate as string | undefined;

      const result = await paymentsService.getProviderPaymentsHistory(req.user!.id, page, limit, {
        status,
        paymentMethod,
        fromDate,
        toDate,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getProviderPayableAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const list = await paymentsService.getProviderPayableAssignments(req.user!.id);
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  }

  // ── Payment Detail ──
  async getPaymentDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = validateUuid(req.params.id, "Payment ID");
      const payment = await paymentsService.getPaymentDetail(req.user!.id, paymentId);
      res.status(200).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }

  // ── Refund Payment ──
  async refundPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = validateUuid(req.params.id, "Payment ID");
      const data = refundPaymentSchema.parse(req.body);
      const payment = await paymentsService.refundPayment(req.user!.id, paymentId, data);
      res.status(200).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(_req: Request, res: Response) {
    res.status(200).json({
      module: "payments",
      status: "initialized",
      description: "Wage records, cash PIN dual-confirmation, Razorpay sandbox, receipts, and reconciliation",
    });
  }
}

export const paymentsController = new PaymentsController();
