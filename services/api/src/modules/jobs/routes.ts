/**
 * Work Opportunities Domain Routes
 * Mounted at /api/v1/jobs and /api/v1/work-opportunities
 */

import { Router } from "express";
import { UserRole } from "@nearvia/types";
import {
  createWorkOpportunitySchema,
  updateWorkOpportunitySchema,
} from "@nearvia/validation";
import {
  authenticateUser,
  requireRole,
} from "../../middleware/auth.middleware";
import { validateRequest } from "../../middleware/validateRequest";
import { workOpportunitiesController } from "./controller";
import { applicationsController } from "../applications/controller";
import { matchingController } from "../matching/controller";

const router = Router();

/**
 * @route GET /api/v1/work-opportunities/summary
 * @desc Live statistics, counts, and category breakdown for a radius
 */
router.get("/summary", (req, res, next) =>
  workOpportunitiesController.getSummary(req, res, next),
);

/**
 * @route GET /api/v1/work-opportunities/nearby
 * @desc Discover published work opportunities within 5 km radius (authenticated worker)
 */
router.get("/nearby", authenticateUser, (req, res, next) =>
  workOpportunitiesController.discover(req, res, next),
);

/**
 * @route GET /api/v1/work-opportunities/discover
 * @desc Discover published work opportunities with explicit coordinates or guest search
 */
router.get("/discover", (req, res, next) =>
  workOpportunitiesController.discover(req, res, next),
);

/**
 * @route GET /api/v1/work-opportunities/mine
 * @desc List opportunities posted by authenticated provider
 */
router.get(
  "/mine",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => workOpportunitiesController.getMine(req, res, next),
);

/**
 * @route POST /api/v1/work-opportunities
 * @desc Create new work opportunity (defaults to DRAFT or PUBLISHED)
 */
router.post(
  "/",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  validateRequest(createWorkOpportunitySchema),
  (req, res, next) => workOpportunitiesController.create(req, res, next),
);

/**
 * @route POST /api/v1/work-opportunities/instant
 * @desc Create Instant Work Opportunity ("Need someone now")
 */
router.post(
  "/instant",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => workOpportunitiesController.createInstant(req, res, next),
);

/**
 * @route GET /api/v1/work-opportunities/:id
 * @desc Retrieve full work opportunity details (enforces draft isolation)
 */
router.get("/:id", (req, res, next) =>
  workOpportunitiesController.getById(req, res, next),
);

/**
 * @route PATCH /api/v1/work-opportunities/:id
 * @desc Update draft work opportunity
 */
router.patch(
  "/:id",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  validateRequest(updateWorkOpportunitySchema),
  (req, res, next) => workOpportunitiesController.update(req, res, next),
);

/**
 * @route POST /api/v1/work-opportunities/:id/publish
 * @desc Transition draft opportunity to PUBLISHED
 */
router.post(
  "/:id/publish",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => workOpportunitiesController.publish(req, res, next),
);

/**
 * @route POST /api/v1/work-opportunities/:id/cancel
 * @desc Cancel an active or published work opportunity
 */
router.post(
  "/:id/cancel",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => workOpportunitiesController.cancel(req, res, next),
);

/**
 * @route POST /api/v1/work-opportunities/:id/applications
 * @desc Worker submits application for this work opportunity
 */
router.post(
  "/:id/applications",
  authenticateUser,
  requireRole([UserRole.WORKER, UserRole.ADMIN]),
  (req, res, next) => applicationsController.applyForWork(req, res, next),
);

/**
 * @route GET /api/v1/work-opportunities/:id/applicants
 * @desc Provider views applicants for this work opportunity
 */
router.get(
  "/:id/applicants",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) =>
    applicationsController.getOpportunityApplicants(req, res, next),
);

/**
 * @route GET /api/v1/jobs/:jobId/matches
 * @route GET /api/v1/work-opportunities/:jobId/matches
 * @desc Retrieve deterministic smart matches for this work opportunity
 * @access Provider (Job Owner) or Admin
 */
router.get(
  "/:jobId/matches",
  authenticateUser,
  requireRole([UserRole.PROVIDER, UserRole.ADMIN]),
  (req, res, next) => matchingController.getJobMatches(req, res, next),
);

/**
 * @route GET /api/v1/work-opportunities/:id/lifecycle
 * @route GET /api/v1/jobs/:id/lifecycle
 * @desc Get authoritative lifecycle state, milestones timeline, and next actions for job
 */
router.get("/:id/lifecycle", authenticateUser, (req, res, next) =>
  workOpportunitiesController.getLifecycle(req, res, next),
);

export const jobsRouter: Router = router;
