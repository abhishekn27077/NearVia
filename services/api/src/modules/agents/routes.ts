/**
 * Agents Routes — Phase 13
 * All routes require AGENT role authentication.
 */

import { Router } from "express";
import { UserRole } from "@nearvia/types";
import { authenticateUser, requireRole } from "../../middleware/auth.middleware";
import { agentsController } from "./controller";

const router = Router();

// All agent routes require authentication + AGENT role
router.use(authenticateUser);
router.use(requireRole(UserRole.AGENT));

// ── Agent Profile ──
router.get("/me", (req, res, next) => agentsController.getMyProfile(req, res, next));
router.patch("/me", (req, res, next) => agentsController.updateMyProfile(req, res, next));

// ── Worker Relationships ──
router.get("/workers", (req, res, next) => agentsController.getMyWorkers(req, res, next));
router.post("/workers/request", (req, res, next) => agentsController.requestWorkerAccess(req, res, next));
router.post("/workers/:workerId/revoke", (req, res, next) => agentsController.revokeWorkerAccess(req, res, next));

// ── Assisted Worker View ──
router.get("/workers/:workerId", (req, res, next) => agentsController.getWorkerDetail(req, res, next));

// ── Assisted Discovery ──
router.get("/workers/:workerId/work", (req, res, next) => agentsController.getWorkForWorker(req, res, next));

// ── Assisted Application ──
router.post("/workers/:workerId/apply", (req, res, next) => agentsController.submitAssistedApplication(req, res, next));

// ── Worker Applications & Assignments (read-only) ──
router.get("/workers/:workerId/applications", (req, res, next) => agentsController.getWorkerApplications(req, res, next));
router.get("/workers/:workerId/assignments", (req, res, next) => agentsController.getWorkerAssignments(req, res, next));

export const agentsRouter: Router = router;
