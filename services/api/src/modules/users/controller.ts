/**
 * Users Controller
 * User profile management, role verification, and account settings
 */

import { Request, Response, NextFunction } from "express";
import { usersService } from "./service";
import { ApiSuccessResponse } from "@nearvia/config";

export class UsersController {
  public async getStatus(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const status = await usersService.getStatus();
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

export const usersController = new UsersController();
