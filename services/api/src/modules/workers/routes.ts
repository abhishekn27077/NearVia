/**
 * Workers Routes
 * /api/v1/workers/*
 */

import { Router } from "express";
import { UserRole } from "@nearvia/types";
import {
  updateWorkerProfileSchema,
  updateWorkerLocationSchema,
  addWorkerSkillSchema,
  toggleAvailableNowSchema,
  createAvailabilitySlotSchema,
} from "@nearvia/validation";
import {
  authenticateUser,
  requireRole,
  validateRequest,
} from "../../middleware";
import { workersController } from "./controller";

const router = Router();

// 1. Worker Profile Management
router.get(
  "/me",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.getMe(req, res, next),
);

router.patch(
  "/me",
  authenticateUser,
  requireRole(UserRole.WORKER),
  validateRequest(updateWorkerProfileSchema),
  (req, res, next) => workersController.updateMe(req, res, next),
);

router.patch(
  "/me/location",
  authenticateUser,
  requireRole(UserRole.WORKER),
  validateRequest(updateWorkerLocationSchema),
  (req, res, next) => workersController.updateLocation(req, res, next),
);

// 2. Worker Skills Management
router.get(
  "/me/skills",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.getMySkills(req, res, next),
);

router.post(
  "/me/skills",
  authenticateUser,
  requireRole(UserRole.WORKER),
  validateRequest(addWorkerSkillSchema),
  (req, res, next) => workersController.addMySkill(req, res, next),
);

router.delete(
  "/me/skills/:skillId",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.removeMySkill(req, res, next),
);

// 3. Worker Availability & Available-Now Management
router.get(
  "/me/availability",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.getAvailability(req, res, next),
);

router.patch(
  "/me/availability/now",
  authenticateUser,
  requireRole(UserRole.WORKER),
  validateRequest(toggleAvailableNowSchema),
  (req, res, next) => workersController.toggleAvailableNow(req, res, next),
);

router.post(
  "/me/availability",
  authenticateUser,
  requireRole(UserRole.WORKER),
  validateRequest(createAvailabilitySlotSchema),
  (req, res, next) => workersController.createAvailabilitySlot(req, res, next),
);

router.delete(
  "/me/availability/:id",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.deleteAvailabilitySlot(req, res, next),
);

// 4. Worker Agent Consent Management
router.get(
  "/me/agents",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.getAgentRequests(req, res, next),
);

router.post(
  "/me/agents/:id/accept",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.acceptAgentRequest(req, res, next),
);

router.post(
  "/me/agents/:id/revoke",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.revokeAgent(req, res, next),
);

router.delete(
  "/me/agents/:id",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.revokeAgent(req, res, next),
);

// 5. Phase 5: Worker Dashboard Real-Time Stats & Preferred Providers
router.get(
  "/dashboard-stats",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.getDashboardStats(req, res, next),
);

router.get(
  "/preferred-providers",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.getPreferredProviders(req, res, next),
);

router.post(
  "/preferred-providers/:providerId",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.addPreferredProvider(req, res, next),
);

router.delete(
  "/preferred-providers/:providerId",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => workersController.removePreferredProvider(req, res, next),
);

export const workersRouter: Router = router;
