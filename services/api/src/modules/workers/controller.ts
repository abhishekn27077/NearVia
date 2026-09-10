/**
 * Workers Module Controller
 * Coordinates HTTP requests for Worker Profile, Skills, Location, and Availability.
 */

import { Request, Response, NextFunction } from "express";
import { ApiResponse, ErrorCode } from "@nearvia/config";
import {
  WorkerProfileDetail,
  WorkerSkillDetail,
  WorkerAvailability,
  Skill,
} from "@nearvia/types";
import { workersService } from "./service";
import { skillsService } from "./skills.service";
import { AppError } from "../../middleware/errorHandler";
import { validateUuid } from "../../utils/security";

export class WorkersController {
  /**
   * GET /api/v1/workers/me
   */
  public async getMe(
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

      const profile = await workersService.getWorkerProfileDetail(req.user.id);
      const response: ApiResponse<WorkerProfileDetail> = {
        success: true,
        data: profile,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/workers/me
   */
  public async updateMe(
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

      const updated = await workersService.updateWorkerProfile(
        req.user.id,
        req.body,
      );
      const response: ApiResponse<WorkerProfileDetail> = {
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
   * PATCH /api/v1/workers/me/location
   */
  public async updateLocation(
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

      const updated = await workersService.updateWorkerLocation(
        req.user.id,
        req.body,
      );
      const response: ApiResponse<WorkerProfileDetail> = {
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
   * GET /api/v1/skills
   */
  public async getAllSkills(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const categoryId =
        typeof req.query.categoryId === "string"
          ? req.query.categoryId
          : undefined;
      const search =
        typeof req.query.search === "string" ? req.query.search : undefined;

      const skills = await skillsService.getAllSkills(categoryId, search);
      const response: ApiResponse<Skill[]> = {
        success: true,
        data: skills,
        meta: {
          total: skills.length,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/workers/me/skills
   */
  public async getMySkills(
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

      const skills = await workersService.getWorkerSkills(req.user.id);
      const response: ApiResponse<WorkerSkillDetail[]> = {
        success: true,
        data: skills,
        meta: {
          total: skills.length,
          timestamp: new Date().toISOString(),
        },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/workers/me/skills
   */
  public async addMySkill(
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

      const skill = await workersService.addWorkerSkill(req.user.id, req.body);
      const response: ApiResponse<WorkerSkillDetail> = {
        success: true,
        data: skill,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/workers/me/skills/:skillId
   */
  public async removeMySkill(
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

      const skillId = validateUuid(req.params.skillId, "Skill ID");

      await workersService.removeWorkerSkill(req.user.id, skillId);
      res.status(200).json({
        success: true,
        data: { message: "Skill removed successfully from worker profile." },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/workers/me/availability
   */
  public async getAvailability(
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

      const availability = await workersService.getWorkerAvailability(
        req.user.id,
      );
      const response: ApiResponse<typeof availability> = {
        success: true,
        data: availability,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/workers/me/availability/now
   */
  public async toggleAvailableNow(
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

      const result = await workersService.toggleAvailableNow(
        req.user.id,
        req.body,
      );
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/workers/me/availability
   */
  public async createAvailabilitySlot(
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

      const slot = await workersService.createAvailabilitySlot(
        req.user.id,
        req.body,
      );
      const response: ApiResponse<WorkerAvailability> = {
        success: true,
        data: slot,
        meta: { timestamp: new Date().toISOString() },
      };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/workers/me/availability/:id
   */
  public async deleteAvailabilitySlot(
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

      const id = validateUuid(req.params.id, "Availability slot ID");

      await workersService.deleteAvailabilitySlot(req.user.id, id);
      res.status(200).json({
        success: true,
        data: { message: "Availability slot deleted successfully." },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/workers/me/agents
   */
  public async getAgentRequests(
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
      const agents = await workersService.getAgentRequests(req.user.id);
      res.status(200).json({ success: true, data: agents });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/workers/me/agents/:id/accept
   */
  public async acceptAgentRequest(
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
      const relationshipId = validateUuid(req.params.id, "Relationship ID");
      await workersService.acceptAgentRequest(req.user.id, relationshipId);
      res.status(200).json({ success: true, message: "Agent request accepted" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/workers/me/agents/:id/revoke
   */
  public async revokeAgent(
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
      const relationshipId = validateUuid(req.params.id, "Relationship ID");
      await workersService.revokeAgent(req.user.id, relationshipId);
      res.status(200).json({ success: true, message: "Agent access revoked" });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/workers/dashboard-stats
   */
  public async getDashboardStats(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const stats = await workersService.getWorkerDashboardStats(req.user.id);
      res.status(200).json({
        success: true,
        data: stats,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/workers/preferred-providers
   */
  public async getPreferredProviders(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const list = await workersService.getPreferredProviders(req.user.id);
      res.status(200).json({
        success: true,
        data: list,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/workers/preferred-providers/:providerId
   */
  public async addPreferredProvider(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const providerId = validateUuid(req.params.providerId, "Provider ID");
      const result = await workersService.addPreferredProvider(req.user.id, providerId);

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
   * DELETE /api/v1/workers/preferred-providers/:providerId
   */
  public async removePreferredProvider(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError("Authentication required.", 401, ErrorCode.UNAUTHORIZED);
      }

      const providerId = validateUuid(req.params.providerId, "Provider ID");
      const result = await workersService.removePreferredProvider(req.user.id, providerId);

      res.status(200).json({
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const workersController = new WorkersController();
