/**
 * Reports Controller (Phase 15)
 */

import { Request, Response, NextFunction } from "express";
import { submitReportSchema, updateReportStatusSchema } from "./types";
import { reportsService } from "./service";
import { validateUuid, clampPagination } from "../../utils/security";

export class ReportsController {
  // ── Submit Report (Any Authenticated User) ──
  public async submitReport(req: Request, res: Response, next: NextFunction) {
    try {
      const reporterId = req.user!.id;
      const validatedData = submitReportSchema.parse(req.body);
      const record = await reportsService.submitReport(
        reporterId,
        validatedData,
        req.ip,
        req.get("user-agent")
      );
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  // ── Get My Submitted Reports ──
  public async getMyReports(req: Request, res: Response, next: NextFunction) {
    try {
      const reporterId = req.user!.id;
      const { page, limit } = clampPagination(req.query, 20, 50);

      const result = await reportsService.getMyReports(reporterId, page, limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Get Single Report by ID ──
  public async getReportById(req: Request, res: Response, next: NextFunction) {
    try {
      const reportId = validateUuid(req.params.id, "Report ID");
      const result = await reportsService.getReportById(
        req.user!.id,
        req.user!.role,
        reportId
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin: List All Reports ──
  public async getAllReports(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = clampPagination(req.query, 20, 100);
      const status = req.query.status as string | undefined;
      const targetType = req.query.targetType as string | undefined;

      const result = await reportsService.getAllReports(page, limit, status, targetType);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin: Update Report Status & Resolution ──
  public async updateReportStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user!.id;
      const reportId = validateUuid(req.params.id, "Report ID");
      const validatedData = updateReportStatusSchema.parse(req.body);

      const result = await reportsService.updateReportStatus(
        adminUserId,
        reportId,
        validatedData,
        req.ip,
        req.get("user-agent")
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const reportsController = new ReportsController();
