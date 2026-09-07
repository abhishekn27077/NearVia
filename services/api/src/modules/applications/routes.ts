/**
 * Applications Routes
 * Mounted at /api/v1/applications and /api/v1/work-opportunities/:id/applications
 */

import { Router } from "express";
import { UserRole } from "@nearvia/types";
import {
  authenticateUser,
  requireRole,
} from "../../middleware/auth.middleware";
import { applicationsController } from "./controller";

const router = Router();

// Worker application management
router.get(
  "/mine",
  authenticateUser,
  requireRole([UserRole.WORKER, UserRole.ADMIN]),
  (req, res, next) => applicationsController.getMyApplications(req, res, next),
);

router.get("/:id", authenticateUser, (req, res, next) =>
  applicationsController.getApplicationById(req, res, next),
);

router.post(
  "/:id/withdraw",
  authenticateUser,
  requireRole([UserRole.WORKER, UserRole.ADMIN]),
  (req, res, next) =>
    applicationsController.withdrawApplication(req, res, next),
);

// Provider applicant actions
router.post(
  "/:id/shortlist",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) =>
    applicationsController.shortlistApplication(req, res, next),
);

router.post(
  "/:id/reject",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => applicationsController.rejectApplication(req, res, next),
);

router.post(
  "/:id/accept",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => applicationsController.acceptApplication(req, res, next),
);

export const applicationsRouter: Router = router;
