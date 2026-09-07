/**
 * Work Opportunities Module Controller
 * Handles HTTP requests for Work Opportunity Creation, Draft Management, Publishing, and Retrieval.
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import {
  WorkOpportunityDetail,
  WorkOpportunityStatus,
  Category,
  DiscoveryQueryParams,
  DiscoveredOpportunity,
  DiscoverySummaryResponse,
} from "@nearvia/types";
import { workOpportunitiesService } from "./service";
import { discoveryService } from "./discovery.service";
import { AppError } from "../../middleware/errorHandler";

export class WorkOpportunitiesController {
  /**
   * GET /api/v1/categories
   */
  public async getCategories(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const categories = await workOpportunitiesService.getAllCategories();
      const response: ApiResponse<Category[]> = {
        success: true,
        data: categories,
        meta: {
          total: categories.length,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/work-opportunities/summary
   */
  public async getSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const lat = req.query.latitude
        ? Number(req.query.latitude)
        : req.query.lat
        ? Number(req.query.lat)
        : 12.9716;
      const lng = req.query.longitude
        ? Number(req.query.longitude)
        : req.query.lng
        ? Number(req.query.lng)
        : 77.5946;
      const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 5;

      const summary = await workOpportunitiesService.getDiscoverySummary(
        lat,
        lng,
        radiusKm,
      );

      const response: ApiResponse<DiscoverySummaryResponse> = {
        success: true,
        data: summary,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/work-opportunities/nearby (or /api/v1/work-opportunities/discover)
   */
  public async discover(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const rawLat = req.query.latitude || req.query.lat;
      const rawLng = req.query.longitude || req.query.lng;
      const rawSearch = req.query.search || req.query.q;
      const rawDate = req.query.dateFilter || req.query.date;
      const rawDuration = req.query.durationFilter || req.query.duration;

      const parsedQuery: DiscoveryQueryParams = {
        latitude: rawLat ? Number(rawLat) : undefined,
        longitude: rawLng ? Number(rawLng) : undefined,
        radiusKm: req.query.radiusKm ? Number(req.query.radiusKm) : undefined,
        search: rawSearch ? String(rawSearch) : undefined,
        workType: req.query.workType as any,
        categoryId: req.query.categoryId
          ? String(req.query.categoryId)
          : undefined,
        urgency: req.query.urgency as any,
        dateFilter: rawDate as any,
        durationFilter: rawDuration as any,
        minPayment: req.query.minPayment
          ? Number(req.query.minPayment)
          : undefined,
        maxPayment: req.query.maxPayment
          ? Number(req.query.maxPayment)
          : undefined,
        sort: req.query.sort as any,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await discoveryService.discoverNearbyWork(
        req.user?.id,
        parsedQuery,
      );

      const response: ApiResponse<DiscoveredOpportunity[]> = {
        success: true,
        data: result.opportunities,
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
   * GET /api/v1/work-opportunities/mine (or /api/v1/jobs/mine)
   */
  public async getMine(
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

      const statusFilter =
        typeof req.query.status === "string"
          ? (req.query.status as WorkOpportunityStatus)
          : undefined;

      const list = await workOpportunitiesService.getProviderWorkOpportunities(
        req.user.id,
        statusFilter,
      );
      const response: ApiResponse<WorkOpportunityDetail[]> = {
        success: true,
        data: list,
        meta: {
          total: list.length,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/work-opportunities (or /api/v1/jobs)
   */
  public async create(
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

      const created = await workOpportunitiesService.createWorkOpportunity(
        req.user.id,
        req.body,
      );
      const response: ApiResponse<WorkOpportunityDetail> = {
        success: true,
        data: created,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/work-opportunities/:id (or /api/v1/jobs/:id)
   */
  public async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      if (!id) {
        throw new AppError(
          "Work opportunity ID is required.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const opportunity = await workOpportunitiesService.getWorkOpportunityById(
        id,
        req.user?.id,
        req.user?.role,
      );

      const response: ApiResponse<WorkOpportunityDetail> = {
        success: true,
        data: opportunity,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/work-opportunities/:id (or /api/v1/jobs/:id)
   */
  public async update(
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

      const updated = await workOpportunitiesService.updateWorkOpportunity(
        id,
        req.user.id,
        req.body,
      );
      const response: ApiResponse<WorkOpportunityDetail> = {
        success: true,
        data: updated,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/work-opportunities/:id/publish (or /api/v1/jobs/:id/publish)
   */
  public async publish(
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

      const published = await workOpportunitiesService.publishWorkOpportunity(
        id,
        req.user.id,
      );
      const response: ApiResponse<WorkOpportunityDetail> = {
        success: true,
        data: published,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/work-opportunities/:id/cancel (or /api/v1/jobs/:id/cancel)
   */
  public async cancel(
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

      const cancelled = await workOpportunitiesService.cancelWorkOpportunity(
        id,
        req.user.id,
      );
      const response: ApiResponse<WorkOpportunityDetail> = {
        success: true,
        data: cancelled,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/jobs/instant (or /api/v1/work-opportunities/instant)
   */
  public async createInstant(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const result = await workOpportunitiesService.createInstantJob(req.user.id, req.body);
      res.status(201).json({
        success: true,
        data: result.opportunity,
        meta: {
          notifiedWorkersCount: result.notifiedWorkersCount,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const workOpportunitiesController = new WorkOpportunitiesController();
