/**
 * Provider Domain Routes
 * Mounted at /api/v1/providers
 */

import { Router } from "express";
import { UserRole } from "@nearvia/types";
import {
  updateProviderProfileSchema,
  updateProviderLocationSchema,
} from "@nearvia/validation";
import {
  authenticateUser,
  requireRole,
} from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { providersController } from "./controller";

const router = Router();

// All provider endpoints require authentication + PROVIDER role
router.use(authenticateUser);
router.use(requireRole([UserRole.PROVIDER, UserRole.ADMIN]));

/**
 * @route GET /api/v1/providers/me
 * @desc Retrieve current authenticated provider profile with completion status
 */
router.get("/me", (req, res, next) =>
  providersController.getMe(req, res, next),
);

/**
 * @route PATCH /api/v1/providers/me
 * @desc Update provider profile info (business name, description, contact phone, etc.)
 */
router.patch(
  "/me",
  validateRequest(updateProviderProfileSchema),
  (req, res, next) => providersController.updateMe(req, res, next),
);

/**
 * @route PATCH /api/v1/providers/me/location
 * @desc Update provider spatial location
 */
router.patch(
  "/me/location",
  validateRequest(updateProviderLocationSchema),
  (req, res, next) => providersController.updateLocation(req, res, next),
);

/**
 * @route GET /api/v1/providers/workforce-radar
 * @desc Retrieve privacy-safe hyperlocal talent availability
 */
router.get("/workforce-radar", (req, res, next) =>
  providersController.getWorkforceRadar(req, res, next),
);

/**
 * @route GET /api/v1/providers/preferred-workers
 * @route GET /api/v1/providers/me/preferred-workers
 * @desc Retrieve list of provider's preferred workers
 */
router.get(["/preferred-workers", "/me/preferred-workers"], (req, res, next) =>
  providersController.getPreferredWorkers(req, res, next),
);

/**
 * @route POST /api/v1/providers/preferred-workers/:workerId
 * @route POST /api/v1/providers/me/preferred-workers/:workerId
 * @desc Add a worker to preferred list
 */
router.post(
  ["/preferred-workers/:workerId", "/me/preferred-workers/:workerId"],
  (req, res, next) => providersController.addPreferredWorker(req, res, next),
);

/**
 * @route DELETE /api/v1/providers/preferred-workers/:workerId
 * @route DELETE /api/v1/providers/me/preferred-workers/:workerId
 * @desc Remove a worker from preferred list
 */
router.delete(
  ["/preferred-workers/:workerId", "/me/preferred-workers/:workerId"],
  (req, res, next) => providersController.removePreferredWorker(req, res, next),
);

/**
 * @route GET /api/v1/providers/:providerId/reputation
 * @desc Retrieve provider reputation & completion rate
 */
router.get("/:providerId/reputation", (req, res, next) =>
  providersController.getProviderReputation(req, res, next),
);

export const providersRouter: Router = router;
