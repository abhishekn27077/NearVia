/**
 * Reports Routes (Phase 15)
 * /api/v1/reports/*
 */

import { Router } from "express";
import { authenticateUser, requireRole } from "../../middleware/auth.middleware";
import { UserRole } from "@nearvia/types";
import { reportsController } from "./controller";

const router = Router();

router.use(authenticateUser);

// User Endpoints
router.post("/", (req, res, next) => reportsController.submitReport(req, res, next));
router.get("/mine", (req, res, next) => reportsController.getMyReports(req, res, next));
router.get("/:id", (req, res, next) => reportsController.getReportById(req, res, next));

// Admin Endpoints
router.get(
  "/admin/all",
  requireRole(UserRole.ADMIN),
  (req, res, next) => reportsController.getAllReports(req, res, next)
);

router.patch(
  "/admin/:id",
  requireRole(UserRole.ADMIN),
  (req, res, next) => reportsController.updateReportStatus(req, res, next)
);

export const reportsRouter = router;
