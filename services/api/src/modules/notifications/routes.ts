/**
 * Notifications Routes
 * /api/v1/notifications/*
 */

import { Router } from "express";
import { authenticateUser } from "../../middleware";
import { notificationsController } from "./controller";

const router = Router();

// 1. Get user notifications
router.get(
  "/",
  authenticateUser,
  (req, res, next) => notificationsController.getMyNotifications(req, res, next),
);

// 2. Get unread notification count
router.get(
  "/unread-count",
  authenticateUser,
  (req, res, next) => notificationsController.getUnreadCount(req, res, next),
);

// 3. Mark all as read (support both POST and PATCH)
router.post(
  "/read-all",
  authenticateUser,
  (req, res, next) => notificationsController.markAllAsRead(req, res, next),
);
router.patch(
  "/read-all",
  authenticateUser,
  (req, res, next) => notificationsController.markAllAsRead(req, res, next),
);

// 4. Mark single notification as read (support both PATCH and POST)
router.patch(
  "/:id/read",
  authenticateUser,
  (req, res, next) => notificationsController.markAsRead(req, res, next),
);
router.post(
  "/:id/read",
  authenticateUser,
  (req, res, next) => notificationsController.markAsRead(req, res, next),
);

export const notificationsRouter: Router = router;
