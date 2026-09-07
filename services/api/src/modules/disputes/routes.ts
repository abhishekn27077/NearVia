/**
 * Disputes Routes (Phase 15)
 * /api/v1/disputes/*
 */

import { Router } from "express";
import { authenticateUser, requireRole } from "../../middleware/auth.middleware";
import { UserRole } from "@nearvia/types";
import { disputesController } from "./controller";

const router = Router();

// Public status
router.get("/status", (req, res, next) => disputesController.getStatus(req, res, next));

// Protected routes
router.use(authenticateUser);

// Participant Endpoints
router.post("/", (req, res, next) => disputesController.createDispute(req, res, next));
router.get("/mine", (req, res, next) => disputesController.getMyDisputes(req, res, next));
router.get("/:id", (req, res, next) => disputesController.getDisputeById(req, res, next));

// Admin Endpoints
router.get(
  "/admin/all",
  requireRole(UserRole.ADMIN),
  (req, res, next) => disputesController.getAllDisputes(req, res, next)
);

router.patch(
  "/admin/:id",
  requireRole(UserRole.ADMIN),
  (req, res, next) => disputesController.updateDisputeStatus(req, res, next)
);

export const disputesRouter = router;
