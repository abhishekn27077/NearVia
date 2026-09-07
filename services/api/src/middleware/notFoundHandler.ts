import { Request, Response } from "express";
import { ApiErrorResponse, ErrorCode } from "@nearvia/config";

export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.NOT_FOUND,
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString(),
    },
  };
  res.status(404).json(errorResponse);
}
