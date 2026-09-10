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
import { validateUuid, clampPagination } from "../../utils/security";

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

      const { page, limit } = clampPagination(req.query, 20, 50);

      let latitude: number | undefined;
      let longitude: number | undefined;

      if (req.query.latitude !== undefined || req.query.longitude !== undefined) {
        if (req.query.latitude === undefined || req.query.longitude === undefined) {
          throw new AppError(
            "Both latitude and longitude must be provided together.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
        latitude = Number(req.query.latitude);
        longitude = Number(req.query.longitude);
        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
          throw new AppError(
            "Latitude must be a valid number between -90 and 90 degrees.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
          throw new AppError(
            "Longitude must be a valid number between -180 and 180 degrees.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
      }

      let radiusKm: number | undefined;
      if (req.query.radiusKm !== undefined) {
        radiusKm = Number(req.query.radiusKm);
        if (isNaN(radiusKm) || radiusKm < 0.5 || radiusKm > 15) {
          throw new AppError(
            "Search radius must be between 0.5 km and 15 km.",
            400,
            ErrorCode.VALIDATION_ERROR,
          );
        }
      }

      const parsedQuery: DiscoveryQueryParams = {
        latitude,
        longitude,
        radiusKm,
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
        page,
        limit,
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

      const id = validateUuid(req.params.id, "Work opportunity ID");

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

      const jobId = validateUuid(req.params.jobId || req.params.id, "Job ID");

      const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : undefined;
      const { limit } = clampPagination(req.query, 10, 50);

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
