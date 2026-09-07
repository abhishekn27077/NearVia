import { Router } from "express";
import { UserRole } from "@nearvia/types";
import { authenticateUser, requireRole } from "../../middleware/auth.middleware";
import { adminController } from "./controller";

const adminRouter = Router();

// Apply auth and admin role requirements to all admin routes
adminRouter.use(authenticateUser);
adminRouter.use(requireRole(UserRole.ADMIN));

// Platform overview, metrics, and search
adminRouter.get("/dashboard", (req, res, next) =>
  adminController.getDashboardMetrics(req, res, next),
);
adminRouter.get("/status", (req, res, next) =>
  adminController.getStatus(req, res, next),
);
adminRouter.get("/search", (req, res, next) =>
  adminController.searchPlatform(req, res, next),
);

// User Management
adminRouter.get("/users", (req, res, next) =>
  adminController.getUsers(req, res, next),
);
adminRouter.get("/users/:id", (req, res, next) =>
  adminController.getUserById(req, res, next),
);
adminRouter.put("/users/:id/status", (req, res, next) =>
  adminController.updateUserStatus(req, res, next),
);
adminRouter.put("/users/:id/role", (req, res, next) =>
  adminController.updateUserRole(req, res, next),
);

// Work Opportunities Moderation
adminRouter.get("/work-opportunities", (req, res, next) =>
  adminController.getWorkOpportunities(req, res, next),
);
adminRouter.post("/work-opportunities/:id/cancel", (req, res, next) =>
  adminController.moderateCancelWork(req, res, next),
);
adminRouter.get("/work", (req, res, next) =>
  adminController.getWorkOpportunities(req, res, next),
);
adminRouter.post("/work/:id/cancel", (req, res, next) =>
  adminController.moderateCancelWork(req, res, next),
);

// Verifications Queue
adminRouter.get("/verifications", (req, res, next) =>
  adminController.getVerifications(req, res, next),
);
adminRouter.post("/verifications/:id/approve", (req, res, next) =>
  adminController.approveVerification(req, res, next),
);
adminRouter.post("/verifications/:id/reject", (req, res, next) =>
  adminController.rejectVerification(req, res, next),
);

// Settlements / Payments
adminRouter.get("/payments", (req, res, next) =>
  adminController.getPayments(req, res, next),
);

// Audit Trails
adminRouter.get("/audit-logs", (req, res, next) =>
  adminController.getAuditLogs(req, res, next),
);

// Platform Analytics & Telemetry
adminRouter.get("/analytics/overview", (req, res, next) =>
  adminController.getOverviewAnalytics(req, res, next),
);
adminRouter.get("/analytics/health", (req, res, next) =>
  adminController.getMarketplaceHealth(req, res, next),
);
adminRouter.get("/analytics/events", (req, res, next) =>
  adminController.getPlatformEvents(req, res, next),
);

export { adminRouter };