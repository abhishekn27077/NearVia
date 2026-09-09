/**
 * Availability Routes
 * Protected endpoints for online/offline toggling & schedule preferences
 */

import { Router } from "express";
import { availabilityController } from "./controller";
import { authenticateUser, requireRole, validateRequest } from "../../middleware";
import { UserRole } from "@nearvia/types";
import {
  goOnlineSchema,
  goOfflineSchema,
  toggleAvailabilitySchema,
} from "@nearvia/validation";

const router = Router();

// Protected: Worker Only endpoints
router.post(
  "/online",
  authenticateUser,
  requireRole(UserRole.WORKER),
  validateRequest(goOnlineSchema),
  (req, res, next) => availabilityController.goOnline(req, res, next),
);

router.post(
  "/offline",
  authenticateUser,
  requireRole(UserRole.WORKER),
  validateRequest(goOfflineSchema),
  (req, res, next) => availabilityController.goOffline(req, res, next),
);

router.post(
  "/toggle",
  authenticateUser,
  requireRole(UserRole.WORKER),
  validateRequest(toggleAvailabilitySchema),
  (req, res, next) => availabilityController.toggleAvailability(req, res, next),
);

router.get(
  "/me",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => availabilityController.getMyAvailability(req, res, next),
);

export const availabilityRouter: Router = router;
