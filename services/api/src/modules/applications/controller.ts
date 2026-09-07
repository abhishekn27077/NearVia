/**
 * Applications Controller
 * Handles HTTP requests for submitting applications, managing withdrawals,
 * reviewing candidates, shortlisting, rejecting, and transactional hiring.
 */

import { Request, Response, NextFunction } from "express";
import { applicationsService } from "./service";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { AppError } from "../../middleware/errorHandler";
import {
  ApplicationDetail,
  ApplicantListItem,
  ApplyWorkInput,
  ApplicationDecisionInput,
} from "@nearvia/types";
import {
  applyWorkSchema,
  applicationDecisionSchema,
  withdrawApplicationSchema,
} from "@nearvia/validation";

export class ApplicationsController {
  /**
   * POST /api/v1/work-opportunities/:id/applications
   * Worker applies for a published work opportunity.
   */
  public async applyForWork(
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

      const rawId = req.params.id;
      const workOpportunityId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!workOpportunityId) {
        throw new AppError(
          "Work opportunity ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const validatedInput: ApplyWorkInput = applyWorkSchema.parse(req.body);

      const application = await applicationsService.applyForWork(
        req.user.id,
        workOpportunityId,
        validatedInput,
      );

      const response: ApiResponse<ApplicationDetail> = {
        success: true,
        data: application,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/applications/mine
   * Worker retrieves all their submitted applications.
   */
  public async getMyApplications(
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

      const applications = await applicationsService.getMyApplications(
        req.user.id,
      );

      const response: ApiResponse<ApplicationDetail[]> = {
        success: true,
        data: applications,
        meta: {
          total: applications.length,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/applications/:id
   * Worker or Provider retrieves details of a specific application.
   */
  public async getApplicationById(
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

      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        throw new AppError(
          "Application ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const application = await applicationsService.getApplicationById(
        req.user.id,
        id,
      );

      const response: ApiResponse<ApplicationDetail> = {
        success: true,
        data: application,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/applications/:id/withdraw
   * Worker withdraws their own application.
   */
  public async withdrawApplication(
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

      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        throw new AppError(
          "Application ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const validated = withdrawApplicationSchema.parse(req.body);

      const application = await applicationsService.withdrawApplication(
        req.user.id,
        id,
        validated.reason,
      );

      const response: ApiResponse<ApplicationDetail> = {
        success: true,
        data: application,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/work-opportunities/:id/applicants
   * Provider views all applicants for their work opportunity.
   */
  public async getOpportunityApplicants(
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

      const rawId = req.params.id;
      const workOpportunityId = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!workOpportunityId) {
        throw new AppError(
          "Work opportunity ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const applicants = await applicationsService.getOpportunityApplicants(
        req.user.id,
        workOpportunityId,
      );

      const response: ApiResponse<ApplicantListItem[]> = {
        success: true,
        data: applicants,
        meta: {
          total: applicants.length,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/applications/:id/shortlist
   * Provider shortlists an applicant.
   */
  public async shortlistApplication(
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

      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        throw new AppError(
          "Application ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const validated: ApplicationDecisionInput =
        applicationDecisionSchema.parse(req.body);

      const application = await applicationsService.shortlistApplication(
        req.user.id,
        id,
        validated.decisionNotes,
      );

      const response: ApiResponse<ApplicationDetail> = {
        success: true,
        data: application,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/applications/:id/reject
   * Provider rejects an applicant.
   */
  public async rejectApplication(
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

      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        throw new AppError(
          "Application ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const validated: ApplicationDecisionInput =
        applicationDecisionSchema.parse(req.body);

      const application = await applicationsService.rejectApplication(
        req.user.id,
        id,
        validated.decisionNotes,
      );

      const response: ApiResponse<ApplicationDetail> = {
        success: true,
        data: application,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/applications/:id/accept
   * Provider accepts applicant & creates assignment inside transaction.
   */
  public async acceptApplication(
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

      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        throw new AppError(
          "Application ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const validated: ApplicationDecisionInput =
        applicationDecisionSchema.parse(req.body);

      const result = await applicationsService.acceptApplication(
        req.user.id,
        id,
        validated.decisionNotes,
      );

      const response: ApiResponse<{
        application: ApplicationDetail;
        assignmentId: string;
      }> = {
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const applicationsController = new ApplicationsController();
