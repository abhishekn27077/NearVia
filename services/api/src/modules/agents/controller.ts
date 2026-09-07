/**
 * Agents Controller — Phase 13
 * Express request handlers for agent-assisted job access.
 */

import { Request, Response, NextFunction } from "express";
import { agentsService } from "./service";
import {
  agentProfileUpdateSchema,
  requestWorkerAccessSchema,
  assistedApplicationSchema,
} from "./types";

export class AgentsController {
  // ── Profile ──

  async getMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await agentsService.getMyProfile(req.user!.id);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  async updateMyProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const data = agentProfileUpdateSchema.parse(req.body);
      const profile = await agentsService.updateMyProfile(req.user!.id, data);
      res.status(200).json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  // ── Worker Relationships ──

  async getMyWorkers(req: Request, res: Response, next: NextFunction) {
    try {
      const workers = await agentsService.getMyWorkers(req.user!.id);
      res.status(200).json({ success: true, data: workers });
    } catch (error) {
      next(error);
    }
  }

  async requestWorkerAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const { workerPhone } = requestWorkerAccessSchema.parse(req.body);
      const relationship = await agentsService.requestWorkerAccess(req.user!.id, workerPhone);
      res.status(201).json({ success: true, data: relationship });
    } catch (error) {
      next(error);
    }
  }

  async revokeWorkerAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const workerId = req.params.workerId as string;
      await agentsService.revokeWorkerAccess(req.user!.id, workerId);
      res.status(200).json({ success: true, message: "Worker access revoked" });
    } catch (error) {
      next(error);
    }
  }

  // ── Assisted Worker View ──

  async getWorkerDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const workerId = req.params.workerId as string;
      const detail = await agentsService.getWorkerForAgent(req.user!.id, workerId);
      res.status(200).json({ success: true, data: detail });
    } catch (error) {
      next(error);
    }
  }

  // ── Assisted Discovery ──

  async getWorkForWorker(req: Request, res: Response, next: NextFunction) {
    try {
      const workerId = req.params.workerId as string;
      const queryParams = req.query as Record<string, string>;
      const result = await agentsService.getWorkForWorker(req.user!.id, workerId, queryParams);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Assisted Application ──

  async submitAssistedApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const workerId = req.params.workerId as string;
      const { workOpportunityId, proposedWage, workerNotes } = assistedApplicationSchema.parse(req.body);
      const application = await agentsService.submitAssistedApplication(
        req.user!.id, workerId, workOpportunityId, proposedWage, workerNotes
      );
      res.status(201).json({ success: true, data: application });
    } catch (error) {
      next(error);
    }
  }

  // ── Worker Applications & Assignments ──

  async getWorkerApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const workerId = req.params.workerId as string;
      const applications = await agentsService.getWorkerApplications(req.user!.id, workerId);
      res.status(200).json({ success: true, data: applications });
    } catch (error) {
      next(error);
    }
  }

  async getWorkerAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const workerId = req.params.workerId as string;
      const assignments = await agentsService.getWorkerAssignments(req.user!.id, workerId);
      res.status(200).json({ success: true, data: assignments });
    } catch (error) {
      next(error);
    }
  }
}

export const agentsController = new AgentsController();
