import { Request, Response, NextFunction } from "express";
import { reviewSchema } from "./types";
import { reviewsService } from "./service";

export class ReviewsController {
  public async submitReview(req: Request, res: Response, next: NextFunction) {
    try {
      const assignmentId = req.params.id as string;
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
      const userId = req.params.id as string;
      const trustProfile = await reviewsService.getTrustProfile(userId);
      res.status(200).json({ success: true, data: trustProfile });
    } catch (error) {
      next(error);
    }
  }

  public async getUserReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id as string;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      
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
