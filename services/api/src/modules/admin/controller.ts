/**
 * Admin Controller (Phase 16)
 */

import { Request, Response, NextFunction } from "express";
import { adminService } from "./service";
import { analyticsService } from "./analytics.service";
import {
  updateUserStatusSchema,
  updateUserRoleSchema,
  approveVerificationSchema,
  rejectVerificationSchema,
  moderateWorkSchema,
} from "./types";
import { validateUuid, clampPagination } from "../../utils/security";

export class AdminController {
  public async getDashboardMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await adminService.getDashboardMetrics();
      res.json({ success: true, data: metrics });
    } catch (err) {
      next(err);
    }
  }

  public async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = clampPagination(req.query, 20, 100);
      const search = req.query.search as string | undefined;
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;

      const result = await adminService.getUsers(page, limit, search, role, status);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = validateUuid(req.params.id, "User ID");
      const user = await adminService.getUserById(userId);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  public async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateUserStatusSchema.parse(req.body);
      const adminId = (req as any).user.id;
      const userId = validateUuid(req.params.id, "User ID");
      const ip = req.ip;
      const ua = req.get("user-agent");

      const updated = await adminService.updateUserStatus(
        adminId,
        userId,
        parsed,
        ip,
        ua
      );
      res.json({ success: true, data: updated, message: "User status updated successfully" });
    } catch (err) {
      next(err);
    }
  }

  public async updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = updateUserRoleSchema.parse(req.body);
      const adminId = (req as any).user.id;
      const userId = validateUuid(req.params.id, "User ID");
      const ip = req.ip;
      const ua = req.get("user-agent");

      const updated = await adminService.updateUserRole(
        adminId,
        userId,
        parsed,
        ip,
        ua
      );
      res.json({ success: true, data: updated, message: "User role updated successfully" });
    } catch (err) {
      next(err);
    }
  }

  public async getWorkOpportunities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = clampPagination(req.query, 20, 100);
      const status = req.query.status as string | undefined;
      const workType = req.query.workType as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await adminService.getWorkOpportunities(page, limit, status, workType, search);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async moderateCancelWork(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = moderateWorkSchema.parse(req.body);
      const adminId = (req as any).user.id;
      const workId = validateUuid(req.params.id, "Work opportunity ID");
      const ip = req.ip;
      const ua = req.get("user-agent");

      const result = await adminService.moderateCancelWork(
        adminId,
        workId,
        parsed,
        ip,
        ua
      );
      res.json({ success: true, data: result, message: "Work opportunity cancelled and moderated" });
    } catch (err) {
      next(err);
    }
  }

  public async getVerifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = clampPagination(req.query, 20, 100);
      const status = req.query.status as string | undefined;
      const targetType = req.query.targetType as string | undefined;

      const result = await adminService.getVerifications(page, limit, status, targetType);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async approveVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = approveVerificationSchema.parse(req.body);
      const adminId = (req as any).user.id;
      const verificationId = validateUuid(req.params.id, "Verification ID");
      const ip = req.ip;
      const ua = req.get("user-agent");

      const result = await adminService.approveVerification(
        adminId,
        verificationId,
        parsed,
        ip,
        ua
      );
      res.json({ success: true, data: result, message: "Verification approved successfully" });
    } catch (err) {
      next(err);
    }
  }

  public async rejectVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = rejectVerificationSchema.parse(req.body);
      const adminId = (req as any).user.id;
      const verificationId = validateUuid(req.params.id, "Verification ID");
      const ip = req.ip;
      const ua = req.get("user-agent");

      const result = await adminService.rejectVerification(
        adminId,
        verificationId,
        parsed,
        ip,
        ua
      );
      res.json({ success: true, data: result, message: "Verification rejected" });
    } catch (err) {
      next(err);
    }
  }

  public async getPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = clampPagination(req.query, 20, 100);
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;

      const result = await adminService.getPayments(page, limit, status, search);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = clampPagination(req.query, 30, 100);
      const action = req.query.action as string | undefined;
      const targetEntity = req.query.targetEntity as string | undefined;

      const result = await adminService.getAuditLogs(page, limit, action, targetEntity);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async searchPlatform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = (req.query.q as string) || "";
      const result = await adminService.searchPlatform(q);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // ── Analytics Endpoints (Phase 17) ──
  public async getOverviewAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await analyticsService.getOverviewAnalytics();
      res.json({ success: true, data: analytics });
    } catch (err) {
      next(err);
    }
  }

  public async getMarketplaceHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await analyticsService.getMarketplaceHealth();
      res.json({ success: true, data: health });
    } catch (err) {
      next(err);
    }
  }

  public async getMarketplaceAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getMarketplaceAnalytics();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async getTrustAndSafetyAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getTrustAndSafetyAnalytics();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async getPaymentAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await analyticsService.getPaymentAnalytics();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public async getPlatformEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = clampPagination(req.query, 25, 100);
      const eventType = req.query.eventType as string | undefined;
      const userId = req.query.userId ? validateUuid(req.query.userId, "User ID") : undefined;

      const result = await analyticsService.getPlatformEvents(page, limit, eventType, userId);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  public async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await adminService.getStatus();
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
