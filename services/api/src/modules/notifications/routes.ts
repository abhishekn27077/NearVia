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

// 2. Mark all as read
router.post(
  "/read-all",
  authenticateUser,
  (req, res, next) => notificationsController.markAllAsRead(req, res, next),
);

// 3. Mark single notification as read
router.patch(
  "/:id/read",
  authenticateUser,
  (req, res, next) => notificationsController.markAsRead(req, res, next),
);

export const notificationsRouter: Router = router;
