/**
 * Location Controller
 * Hyperlocal spatial queries, PostGIS integration, and proximity calculations
 */

import { Request, Response, NextFunction } from "express";
import { locationService } from "./service";
import { ApiSuccessResponse } from "@nearvia/config";

export class LocationController {
  public async getStatus(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const status = await locationService.getStatus();
      const response: ApiSuccessResponse = {
        success: true,
        data: status,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const locationController = new LocationController();
