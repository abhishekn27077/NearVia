/**
 * Intelligence Layer HTTP Controller
 */

import { Request, Response } from "express";
import { intelligenceService } from "./service";
import { radarService } from "./radar.service";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";
import { validateUuid, clampPagination } from "../../utils/security";

export class IntelligenceController {
  /**
   * POST /api/v1/intelligence/jobs/parse-nl
   * Natural-Language Job Creation Assistant
   */
  async parseNLJob(req: Request, res: Response): Promise<void> {
    const { text, languageHint, locationHint } = req.body;
    if (!text || typeof text !== "string") {
      throw new AppError("Text string is required for job parsing", 400, ErrorCode.VALIDATION_ERROR);
    }

    const result = await intelligenceService.parseNLJob({
      text,
      languageHint,
      locationHint,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * POST /api/v1/intelligence/voice/process
   * Voice Input & Low-Literacy Ingestion
   */
  async processVoice(req: Request, res: Response): Promise<void> {
    const { transcript, audioBase64, languageCode, mode } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!transcript && !audioBase64) {
      throw new AppError("Transcript or audio is required", 400, ErrorCode.VALIDATION_ERROR);
    }

    const result = await intelligenceService.processVoice(userId, {
      transcript: transcript || "",
      audioBase64,
      languageCode,
      mode,
      userRole,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * GET /api/v1/intelligence/jobs/:id/candidates
   * Provider-side Candidate Recommendations
   */
  async getRecommendedCandidates(req: Request, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "PROVIDER") {
      throw new AppError("Only employers can view recommended candidate rankings", 403, ErrorCode.FORBIDDEN);
    }

    const id = validateUuid(req.params.id, "Opportunity ID");
    const { limit } = clampPagination(req.query, 10, 50);

    const candidates = await intelligenceService.getRecommendedCandidates(
      req.user.id,
      id,
      limit
    );

    res.status(200).json({
      success: true,
      data: {
        candidates,
        total: candidates.length,
      },
    });
  }

  /**
   * GET /api/v1/intelligence/workers/recommendations
   * Worker-side Job Recommendations
   */
  async getWorkerRecommendedJobs(req: Request, res: Response): Promise<void> {
    if (!req.user || req.user.role !== "WORKER") {
      throw new AppError("Only workers can access personalized job recommendations", 403, ErrorCode.FORBIDDEN);
    }

    const { page, limit } = clampPagination(req.query, 20, 50);
    const search = req.query.search as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;

    const results = await intelligenceService.getWorkerRecommendedJobs(req.user.id, {
      page,
      limit,
      search,
      categoryId,
    });

    res.status(200).json({
      success: true,
      data: results,
    });
  }

  /**
   * GET /api/v1/intelligence/market/wages
   * Category Wage Benchmarks
   */
  async getWageBenchmarks(req: Request, res: Response): Promise<void> {
    const categoryId = req.query.categoryId as string | undefined;
    const benchmarks = await intelligenceService.getWageBenchmarks(categoryId);

    res.status(200).json({
      success: true,
      data: benchmarks,
    });
  }

  /**
   * GET /api/v1/intelligence/market/hotspots
   * Hyperlocal Demand Hotspots
   */
  async getDemandHotspots(req: Request, res: Response): Promise<void> {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = req.query.radiusKm ? parseFloat(req.query.radiusKm as string) : undefined;

    const hotspots = await intelligenceService.getDemandHotspots(lat, lng, radiusKm);

    res.status(200).json({
      success: true,
      data: hotspots,
    });
  }

  /**
   * GET /api/v1/intelligence/radar
   * GET /api/v1/radar
   * Workforce Radar & Demand Intelligence (Role-specific, privacy-safe)
   */
  async getRadar(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new AppError("Authentication required for workforce radar", 401, ErrorCode.UNAUTHORIZED);
    }

    const lat = req.query.latitude ? parseFloat(req.query.latitude as string) : req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.longitude ? parseFloat(req.query.longitude as string) : req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = req.query.radius ? parseFloat(req.query.radius as string) : req.query.radiusKm ? parseFloat(req.query.radiusKm as string) : 5.0;
    const categoryId = req.query.categoryId as string | undefined;

    const radar = await radarService.getRadar(
      { id: req.user.id, role: req.user.role },
      lat,
      lng,
      radiusKm,
      categoryId
    );

    res.status(200).json({
      success: true,
      data: radar,
    });
  }
}

export const intelligenceController = new IntelligenceController();
