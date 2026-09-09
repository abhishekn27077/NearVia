/**
 * Matching Controller
 * Handles HTTP requests for Intelligent Multi-Factor Matching and Explainable Breakdowns.
 */

import { Request, Response, NextFunction } from "express";
import { matchingService } from "./service";
import { smartMatchingService } from "./smartMatching.service";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import { AppError } from "../../middleware/errorHandler";
import {
  DiscoveryQueryParams,
  MatchedWorkOpportunity,
  MatchExplanation,
  JobMatchesResponse,
  UserRole,
} from "@nearvia/types";

export class MatchingController {
  /**
   * GET /api/v1/matching/work
   * Returns ranked, suitable opportunities with compatibility scores and reasons.
   */
  public async getMatchedWork(
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

      const parsedQuery: DiscoveryQueryParams = {
        latitude: req.query.latitude ? Number(req.query.latitude) : undefined,
        longitude: req.query.longitude
          ? Number(req.query.longitude)
          : undefined,
        radiusKm: req.query.radiusKm ? Number(req.query.radiusKm) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        workType: req.query.workType as any,
        categoryId: req.query.categoryId
          ? String(req.query.categoryId)
          : undefined,
        urgency: req.query.urgency as any,
        dateFilter: req.query.dateFilter as any,
        durationFilter: req.query.durationFilter as any,
        minPayment: req.query.minPayment
          ? Number(req.query.minPayment)
          : undefined,
        maxPayment: req.query.maxPayment
          ? Number(req.query.maxPayment)
          : undefined,
        sort: (req.query.sort as any) || "RECOMMENDED",
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await matchingService.matchWorkOpportunitiesForWorker(
        req.user.id,
        parsedQuery,
      );

      const response: ApiResponse<MatchedWorkOpportunity[]> = {
        success: true,
        data: result.opportunities as MatchedWorkOpportunity[],
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          searchCenter: result.searchCenter,
          radiusKm: result.radiusKm,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/matching/work/:id/explain
   * Returns detailed compatibility score breakdown and reasons for a specific opportunity.
   */
  public async getMatchExplanation(
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
          "Work opportunity ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const explanation: MatchExplanation = await matchingService.explainMatch(
        req.user.id,
        id,
      );

      const response: ApiResponse<MatchExplanation> = {
        success: true,
        data: explanation,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/jobs/:jobId/matches
   * Returns deterministic smart matches for an employer's job.
   * Provider/Admin authorization only.
   */
  public async getJobMatches(
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

      const rawJobId = req.params.jobId || req.params.id;
      const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
      if (!jobId) {
        throw new AppError(
          "Job ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const isAdmin = req.user.role === UserRole.ADMIN;
      const result = await smartMatchingService.getMatchesForJob(
        jobId,
        req.user.id,
        isAdmin,
        { radiusKm, limit }
      );

      const response: ApiResponse<JobMatchesResponse> = {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          total: result.totalMatches,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const matchingController = new MatchingController();
