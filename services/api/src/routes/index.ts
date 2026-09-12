import { Router } from "express";
import { healthRouter } from "./health.routes";
import {
  authLimiter,
  sensitiveActionLimiter,
  adminLimiter,
} from "../middleware/rateLimiter";
import { authenticateUser } from "../middleware/auth.middleware";

// Import domain module routers
import { authRouter } from "../modules/auth";
import { usersRouter } from "../modules/users";
import { workersRouter, workersController } from "../modules/workers";
import { providersRouter } from "../modules/providers";
import { agentsRouter } from "../modules/agents";
import { jobsRouter, workOpportunitiesController } from "../modules/jobs";
import { tasksRouter } from "../modules/tasks";
import { availabilityRouter } from "../modules/availability";
import { locationRouter } from "../modules/location";
import { matchingRouter } from "../modules/matching";
import { applicationsRouter } from "../modules/applications";
import { assignmentsRouter } from "../modules/assignments";
import { notificationsRouter } from "../modules/notifications";
import { verificationRouter } from "../modules/verification";
import { reviewsRouter } from "../modules/reviews";
import { paymentsRouter } from "../modules/payments";
import { disputesRouter } from "../modules/disputes";
import { reportsRouter } from "../modules/reports";
import { adminRouter } from "../modules/admin";
import { messagesRouter } from "../modules/messages";
import { intelligenceRouter, intelligenceController } from "../modules/intelligence";

const router = Router();

// Health check endpoints
router.use("/", healthRouter);

// Public Taxonomy endpoints
router.get("/skills", (req, res, next) =>
  workersController.getAllSkills(req, res, next),
);
router.get("/categories", (req, res, next) =>
  workOpportunitiesController.getCategories(req, res, next),
);

// Domain Module routes with security rate limiting
router.use("/auth", authLimiter, authRouter);
router.use("/users", usersRouter);
router.use("/workers", workersRouter);
router.use("/providers", providersRouter);
router.use("/agents", agentsRouter);
router.use("/jobs", jobsRouter);
router.use("/work-opportunities", jobsRouter);
router.use("/tasks", tasksRouter);
router.use("/availability", availabilityRouter);
router.use("/location", locationRouter);
router.use("/matching", matchingRouter);
router.use("/applications", sensitiveActionLimiter, applicationsRouter);
router.use("/assignments", assignmentsRouter);
router.use("/messages", sensitiveActionLimiter, messagesRouter);
router.use("/notifications", notificationsRouter);
router.use("/verification", sensitiveActionLimiter, verificationRouter);
router.use("/reviews", sensitiveActionLimiter, reviewsRouter);
router.use("/reports", sensitiveActionLimiter, reportsRouter);
router.use("/payments", sensitiveActionLimiter, paymentsRouter);
router.use("/disputes", sensitiveActionLimiter, disputesRouter);
router.use("/intelligence", intelligenceRouter);
router.use("/admin", adminLimiter, adminRouter);

// Unified, role-adaptive Workforce Radar & Demand Intelligence
router.get("/radar", authenticateUser, (req, res, next) =>
  intelligenceController.getRadar(req, res).catch(next),
);

export const apiRouter: Router = router;
