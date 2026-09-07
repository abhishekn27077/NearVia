/**
 * Assignments Controller (Phase 10)
 * Handles HTTP requests for assignment lifecycle:
 * confirm, check-in, start, complete, provider confirm completion, no-show, and cancel.
 */

import { Request, Response, NextFunction } from "express";
import { assignmentsService } from "./service";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { AppError } from "../../middleware/errorHandler";
import {
  AssignmentDetail,
  UserRole,
  CheckInInput,
  StartWorkInput,
  CompleteWorkInput,
  ConfirmCompletionInput,
  CancelAssignmentInput,
  NoShowInput,
} from "@nearvia/types";
import {
  checkInSchema,
  startWorkSchema,
  completeWorkSchema,
  confirmCompletionSchema,
  cancelAssignmentSchema,
  noShowSchema,
} from "@nearvia/validation";

export class AssignmentsController {
  /**
   * Helper to safely extract single string ID from params
   */
  private getAssignmentId(req: Request): string {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      throw new AppError(
        "Assignment ID is required.",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }
    return id;
  }

  /**
   * GET /api/v1/assignments/mine
   * Retrieves all assignments for authenticated user.
   */
  public async getMyAssignments(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const role = (req.user.role as UserRole) || UserRole.WORKER;
      const assignments = await assignmentsService.getMyAssignments(
        req.user.id,
        role,
      );

      const response: ApiResponse<AssignmentDetail[]> = {
        success: true,
        data: assignments,
        meta: {
          total: assignments.length,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assignments/:id
   * Retrieves single assignment by ID with unlocked provider/worker details.
   */
  public async getAssignmentById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const id = this.getAssignmentId(req);
      const assignment = await assignmentsService.getAssignmentById(
        req.user.id,
        id,
      );

      const response: ApiResponse<AssignmentDetail> = {
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/confirm
   * Worker confirms assignment (ASSIGNED -> CONFIRMED).
   */
  public async confirmAssignment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const id = this.getAssignmentId(req);
      const assignment = await assignmentsService.confirmAssignment(
        req.user.id,
        id,
      );

      const response: ApiResponse<AssignmentDetail> = {
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/check-in
   * Worker checks in at work location (CONFIRMED -> CHECKED_IN).
   */
  public async checkIn(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const id = this.getAssignmentId(req);
      const parseResult = checkInSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          "Invalid check-in parameters.",
          400,
          ErrorCode.VALIDATION_ERROR,
          parseResult.error.flatten().fieldErrors,
        );
      }

      const input: CheckInInput = parseResult.data;
      const assignment = await assignmentsService.checkIn(
        req.user.id,
        id,
        input,
      );

      const response: ApiResponse<AssignmentDetail> = {
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/start
   * Worker begins execution of assigned work (CHECKED_IN -> IN_PROGRESS).
   */
  public async startWork(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const id = this.getAssignmentId(req);
      const parseResult = startWorkSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          "Invalid start work parameters.",
          400,
          ErrorCode.VALIDATION_ERROR,
          parseResult.error.flatten().fieldErrors,
        );
      }

      const input: StartWorkInput = parseResult.data;
      const assignment = await assignmentsService.startWork(
        req.user.id,
        id,
        input,
      );

      const response: ApiResponse<AssignmentDetail> = {
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/complete
   * Worker indicates work completion (IN_PROGRESS -> COMPLETED).
   */
  public async completeWork(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const id = this.getAssignmentId(req);
      const parseResult = completeWorkSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          "Invalid completion parameters.",
          400,
          ErrorCode.VALIDATION_ERROR,
          parseResult.error.flatten().fieldErrors,
        );
      }

      const input: CompleteWorkInput = parseResult.data;
      const assignment = await assignmentsService.completeWork(
        req.user.id,
        id,
        input,
      );

      const response: ApiResponse<AssignmentDetail> = {
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/confirm-completion
   * Provider confirms work completion and validates payment records (Provider action).
   */
  public async confirmCompletion(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const id = this.getAssignmentId(req);
      const parseResult = confirmCompletionSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          "Invalid confirm completion parameters.",
          400,
          ErrorCode.VALIDATION_ERROR,
          parseResult.error.flatten().fieldErrors,
        );
      }

      const input: ConfirmCompletionInput = parseResult.data;
      const assignment = await assignmentsService.confirmCompletion(
        req.user.id,
        id,
        input,
      );

      const response: ApiResponse<AssignmentDetail> = {
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/no-show
   * Provider reports worker no-show past grace period (Provider/Admin action).
   */
  public async reportNoShow(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const id = this.getAssignmentId(req);
      const parseResult = noShowSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          "Invalid no-show parameters.",
          400,
          ErrorCode.VALIDATION_ERROR,
          parseResult.error.flatten().fieldErrors,
        );
      }

      const input: NoShowInput = parseResult.data;
      const assignment = await assignmentsService.reportNoShow(
        req.user.id,
        id,
        input,
      );

      const response: ApiResponse<AssignmentDetail> = {
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/cancel
   * Worker or Provider cancels assignment before active work starts.
   */
  public async cancelAssignment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required.",
          401,
          ErrorCode.UNAUTHORIZED,
        );
      }

      const id = this.getAssignmentId(req);
      const parseResult = cancelAssignmentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError(
          "Invalid cancellation parameters.",
          400,
          ErrorCode.VALIDATION_ERROR,
          parseResult.error.flatten().fieldErrors,
        );
      }

      const role = (req.user.role as UserRole) || UserRole.WORKER;
      const input: CancelAssignmentInput = parseResult.data;
      const assignment = await assignmentsService.cancelAssignment(
        req.user.id,
        role,
        id,
        input,
      );

      const response: ApiResponse<AssignmentDetail> = {
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/replacement
   * Provider requests replacement worker.
   */
  public async requestReplacement(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const id = this.getAssignmentId(req);
      const result = await assignmentsService.requestReplacementWorker(id, req.user.id, req.body.reason);

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/verify-pin
   * Worker verifies on-site Job PIN provided by employer.
   */
  public async verifyJobPin(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const id = this.getAssignmentId(req);
      const pin = req.body.jobPin || req.body.pin;
      if (!pin) {
        throw new AppError("Job PIN is required.", 400, ErrorCode.VALIDATION_ERROR);
      }

      const assignment = await assignmentsService.verifyJobPin(req.user.id, id, {
        jobPin: String(pin),
      });

      res.status(200).json({
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/check-out
   * Worker checks out at shift completion.
   */
  public async checkOut(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const id = this.getAssignmentId(req);
      const assignment = await assignmentsService.checkOut(req.user.id, id, {
        completionNotes: req.body.completionNotes,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
      });

      res.status(200).json({
        success: true,
        data: assignment,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/assignments/:id/evidence
   * Uploads job photo evidence (Before/After/Issue/Receipt).
   */
  public async uploadEvidence(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const id = this.getAssignmentId(req);
      const { evidenceType, fileUrl, notes } = req.body;
      if (!evidenceType || !fileUrl) {
        throw new AppError(
          "Evidence type and file URL are required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const evidence = await assignmentsService.uploadJobEvidence(req.user.id, id, {
        evidenceType,
        fileUrl,
        notes,
      });

      res.status(201).json({
        success: true,
        data: evidence,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assignments/:id/evidence
   * Retrieves all evidence photos for an assignment.
   */
  public async getEvidence(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const id = this.getAssignmentId(req);
      const evidence = await assignmentsService.getJobEvidence(req.user.id, id);

      res.status(200).json({
        success: true,
        data: evidence,
        meta: { total: evidence.length, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/assignments/:id/share-view
   * Public / Safe Active Job Snapshot for Emergency Contact Sharing.
   */
  public async getSharedActiveJob(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const id = this.getAssignmentId(req);
      const snapshot = await assignmentsService.getSharedActiveJob(id);

      res.status(200).json({
        success: true,
        data: snapshot,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const assignmentsController = new AssignmentsController();
