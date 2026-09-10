import { Request, Response, NextFunction } from "express";
import { reviewSchema } from "./types";
import { reviewsService } from "./service";
import { validateUuid, clampPagination } from "../../utils/security";

export class ReviewsController {
  public async submitReview(req: Request, res: Response, next: NextFunction) {
    try {
      const assignmentId = validateUuid(req.params.id, "Assignment ID");
      const reviewerId = req.user!.id; // from auth middleware
      const validatedData = reviewSchema.parse(req.body);

      const review = await reviewsService.submitReview(assignmentId, reviewerId, validatedData);
      res.status(201).json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  public async getTrustProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = validateUuid(req.params.id, "User ID");
      const trustProfile = await reviewsService.getTrustProfile(userId);
      res.status(200).json({ success: true, data: trustProfile });
    } catch (error) {
      next(error);
    }
  }

  public async getUserReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = validateUuid(req.params.id, "User ID");
      const { page, limit } = clampPagination(req.query, 10, 50);
      
      const reviews = await reviewsService.getUserReviews(userId, page, limit);
      res.status(200).json({ success: true, data: reviews });
    } catch (error) {
      next(error);
    }
  }

  public async getMyReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const reviews = await reviewsService.getMyReviews(userId);
      res.status(200).json({ success: true, data: reviews });
    } catch (error) {
      next(error);
    }
  }
}

export const reviewsController = new ReviewsController();
