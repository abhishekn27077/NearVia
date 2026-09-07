import { Router } from "express";
import { reviewsController } from "./controller";
import { authenticateUser } from "../../middleware/auth.middleware";

const router = Router();

// Get trust profile for a user
router.get("/users/:id/trust", reviewsController.getTrustProfile);

// Get public reviews of a user
router.get("/users/:id/reviews", reviewsController.getUserReviews);

// Protected routes
router.use(authenticateUser);

// Get my given and received reviews
router.get("/mine", reviewsController.getMyReviews);

// Submit a review for an assignment
router.post("/assignments/:id", reviewsController.submitReview);

export const reviewsRouter = router;
