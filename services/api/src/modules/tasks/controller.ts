/**
 * Tasks Controller
 * Micro-tasks and short-duration work assignment definitions
 */

import { Request, Response, NextFunction } from "express";
import { tasksService } from "./service";
import { ApiSuccessResponse } from "@nearvia/config";

export class TasksController {
  public async getStatus(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const status = await tasksService.getStatus();
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

export const tasksController = new TasksController();
