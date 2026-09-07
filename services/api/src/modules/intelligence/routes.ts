/**
 * Intelligence Domain Routes
 * Mounted at /api/v1/intelligence
 */

import { Router } from "express";
import { UserRole } from "@nearvia/types";
import {
  authenticateUser,
  requireRole,
} from "../../middleware/auth.middleware";
import { aiLimiter } from "../../middleware/rateLimiter";
import { intelligenceController } from "./controller";

const router = Router();

// 1. Natural-Language Job Creation Drafter (Open to authenticated Employers & Admins, optional auth for drafts)
router.post(
  "/jobs/parse-nl",
  aiLimiter,
  (req, res, next) => intelligenceController.parseNLJob(req, res).catch(next)
);

// 2. Voice Assistance & Low-Literacy Ingestion (Optional auth to link to profile)
router.post(
  "/voice/process",
  aiLimiter,
  (req, res, next) => intelligenceController.processVoice(req, res).catch(next)
);

// 3. Provider-side Candidate Recommendations
router.get(
  "/jobs/:id/candidates",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => intelligenceController.getRecommendedCandidates(req, res).catch(next)
);

// 4. Worker-side Personalized Job Recommendations
router.get(
  "/workers/recommendations",
  authenticateUser,
  requireRole([UserRole.WORKER, UserRole.ADMIN]),
  (req, res, next) => intelligenceController.getWorkerRecommendedJobs(req, res).catch(next)
);

// 5. Market Wage Benchmarks (Public / authenticated)
router.get(
  "/market/wages",
  (req, res, next) => intelligenceController.getWageBenchmarks(req, res).catch(next)
);

// 6. Hyperlocal Demand & Supply Hotspots (Public / authenticated)
router.get(
  "/market/hotspots",
  (req, res, next) => intelligenceController.getDemandHotspots(req, res).catch(next)
);

export const intelligenceRouter: Router = router;
