/**
 * Users Routes
 * User profile management, role verification, and account settings
 */

import { Router } from "express";
import { usersController } from "./controller";
import { reviewsController } from "../reviews/controller";

const router = Router();

router.get("/status", (req, res, next) =>
  usersController.getStatus(req, res, next),
);

// Trust profile and public reviews endpoints
router.get("/:id/trust", (req, res, next) =>
  reviewsController.getTrustProfile(req, res, next),
);

router.get("/:id/reviews", (req, res, next) =>
  reviewsController.getUserReviews(req, res, next),
);

export const usersRouter: Router = router;
