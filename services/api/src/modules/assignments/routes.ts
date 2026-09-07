/**
 * Assignments Routes (Phase 10)
 * Mounted at /api/v1/assignments
 */

import { Router } from "express";
import {
  authenticateUser,
  requireRole,
} from "../../middleware/auth.middleware";
import { assignmentsController } from "./controller";
import { UserRole } from "@nearvia/types";

const router = Router();

// Retrieve assignments
router.get("/mine", authenticateUser, (req, res, next) =>
  assignmentsController.getMyAssignments(req, res, next),
);

router.get("/:id", authenticateUser, (req, res, next) =>
  assignmentsController.getAssignmentById(req, res, next),
);

// Worker execution lifecycle
router.post(
  "/:id/confirm",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => assignmentsController.confirmAssignment(req, res, next),
);

router.post(
  "/:id/check-in",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => assignmentsController.checkIn(req, res, next),
);

router.post(
  "/:id/start",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => assignmentsController.startWork(req, res, next),
);

router.post(
  "/:id/complete",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => assignmentsController.completeWork(req, res, next),
);

// Provider confirmation & supervision
router.post(
  "/:id/confirm-completion",
  authenticateUser,
  requireRole(UserRole.PROVIDER),
  (req, res, next) => assignmentsController.confirmCompletion(req, res, next),
);

router.post(
  "/:id/no-show",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => assignmentsController.reportNoShow(req, res, next),
);

router.post(
  "/:id/replacement",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => assignmentsController.requestReplacement(req, res, next),
);

// Cancellation (Worker, Provider, or Admin)
router.post("/:id/cancel", authenticateUser, (req, res, next) =>
  assignmentsController.cancelAssignment(req, res, next),
);

// Phase 6: Job PIN Verification
router.post(
  "/:id/verify-pin",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => assignmentsController.verifyJobPin(req, res, next),
);

// Phase 6: Check-Out
router.post(
  "/:id/check-out",
  authenticateUser,
  requireRole(UserRole.WORKER),
  (req, res, next) => assignmentsController.checkOut(req, res, next),
);

// Phase 6: Job Photo Evidence (Upload & Retrieve)
router.post(
  "/:id/evidence",
  authenticateUser,
  (req, res, next) => assignmentsController.uploadEvidence(req, res, next),
);

router.get(
  "/:id/evidence",
  authenticateUser,
  (req, res, next) => assignmentsController.getEvidence(req, res, next),
);

// Phase 6: Public / Safe Active Job Snapshot (No auth required for emergency share)
router.get(
  "/:id/share-view",
  (req, res, next) => assignmentsController.getSharedActiveJob(req, res, next),
);

export const assignmentsRouter: Router = router;
