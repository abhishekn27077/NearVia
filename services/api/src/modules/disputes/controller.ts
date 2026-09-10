/**
 * Disputes Controller (Phase 15)
 */

import { Request, Response, NextFunction } from "express";
import { createDisputeSchema, updateDisputeStatusSchema } from "./types";
import { disputesService } from "./service";
import { validateUuid, clampPagination } from "../../utils/security";

export class DisputesController {
  // ── Status ──
  public async getStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const status = await disputesService.getStatus();
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  // ── Create Dispute (Worker or Provider participant) ──
  public async createDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const initiatorId = req.user!.id;
      const validatedData = createDisputeSchema.parse(req.body);
      const dispute = await disputesService.createDispute(
        initiatorId,
        validatedData,
        req.ip,
        req.get("user-agent")
      );
      res.status(201).json({ success: true, data: dispute });
    } catch (error) {
      next(error);
    }
  }

  // ── Get My Disputes ──
  public async getMyDisputes(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { page, limit } = clampPagination(req.query, 20, 100);

      const result = await disputesService.getMyDisputes(userId, page, limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Get Dispute Detail by ID ──
  public async getDisputeById(req: Request, res: Response, next: NextFunction) {
    try {
      const disputeId = validateUuid(req.params.id, "Dispute ID");
      const dispute = await disputesService.getDisputeById(
        req.user!.id,
        req.user!.role,
        disputeId
      );
      res.status(200).json({ success: true, data: dispute });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin: List All Disputes ──
  public async getAllDisputes(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = clampPagination(req.query, 20, 100);
      const status = req.query.status as string | undefined;

      const result = await disputesService.getAllDisputes(page, limit, status);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin: Update Dispute Status & Resolution ──
  public async updateDisputeStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user!.id;
      const disputeId = validateUuid(req.params.id, "Dispute ID");
      const validatedData = updateDisputeStatusSchema.parse(req.body);

      const result = await disputesService.updateDisputeStatus(
        adminUserId,
        disputeId,
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

export const disputesController = new DisputesController();
