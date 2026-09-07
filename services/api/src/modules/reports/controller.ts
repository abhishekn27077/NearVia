/**
 * Reports Controller (Phase 15)
 */

import { Request, Response, NextFunction } from "express";
import { submitReportSchema, updateReportStatusSchema } from "./types";
import { reportsService } from "./service";

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
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await reportsService.getMyReports(reporterId, page, limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Get Single Report by ID ──
  public async getReportById(req: Request, res: Response, next: NextFunction) {
    try {
      const reportId = req.params.id as string;
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
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
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
      const reportId = req.params.id as string;
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
