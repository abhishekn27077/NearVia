/**
 * Matching Domain Routes
 * Mounted at /api/v1/matching
 */

import { Router } from "express";
import { UserRole } from "@nearvia/types";
import {
  authenticateUser,
  requireRole,
} from "../../middleware/auth.middleware";
import { matchingController } from "./controller";

const router = Router();

/**
 * @route GET /api/v1/matching/work
 * @desc Get ranked matching opportunities for authenticated worker
 */
router.get(
  "/work",
  authenticateUser,
  requireRole([UserRole.WORKER, UserRole.ADMIN]),
  (req, res, next) => matchingController.getMatchedWork(req, res, next),
);

/**
 * @route GET /api/v1/matching/work/:id/explain
 * @desc Get detailed compatibility breakdown and reasons for a specific opportunity
 */
router.get(
  "/work/:id/explain",
  authenticateUser,
  requireRole([UserRole.WORKER, UserRole.ADMIN]),
  (req, res, next) => matchingController.getMatchExplanation(req, res, next),
);

export const matchingRouter: Router = router;
