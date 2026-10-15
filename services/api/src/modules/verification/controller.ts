import { Request, Response, NextFunction } from "express";
import { verificationSubmitSchema, kycUploadUrlSchema } from "./types";
import { verificationService } from "./service";

export class VerificationController {
  public async createUploadUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const validatedData = kycUploadUrlSchema.parse(req.body);

      const result = await verificationService.createUploadUrl(userId, validatedData);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  public async submitVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id; // from auth middleware
      const validatedData = verificationSubmitSchema.parse(req.body);

      const record = await verificationService.submitVerification(userId, validatedData);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  public async getMyVerifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const records = await verificationService.getMyVerifications(userId);
      res.status(200).json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }
}

export const verificationController = new VerificationController();
