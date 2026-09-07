/**
 * Availability Routes
 * Protected endpoints for online/offline toggling & schedule preferences
 */

import { Router } from "express";
import { availabilityController } from "./controller";
import { authenticateUser, requireRole } from "../../middleware";
import { UserRole } from "@nearvia/types";

const router = Router();

// Protected: Worker Only endpoints
router.post(
  "/toggle",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => availabilityController.toggleAvailability(req, res, next),
);

router.get(
  "/me",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => availabilityController.getMyAvailability(req, res, next),
);

export const availabilityRouter: Router = router;
