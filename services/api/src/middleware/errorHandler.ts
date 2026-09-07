import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ApiErrorResponse, ErrorCode } from "@nearvia/config";
import { ZodError } from "zod";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode | string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isProduction = process.env.NODE_ENV === "production";
  const requestId = req.id;

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const errorResponse: ApiErrorResponse & { requestId?: string } = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Request validation failed",
        details: err.errors,
        timestamp: new Date().toISOString(),
      },
      ...(requestId ? { requestId } : {}),
    };
    res.status(400).json(errorResponse);
    return;
  }

  // Handle Known Application Domain Errors
  if (err instanceof AppError) {
    const errorResponse: ApiErrorResponse & { requestId?: string } = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString(),
      },
      ...(requestId ? { requestId } : {}),
    };
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // Handle Unexpected Internal Server Errors
  if (!isProduction) {
    console.error("❌ Unhandled Server Error:", err);
  } else {
    // Sanitized log without sensitive context
    console.error(
      `[${new Date().toISOString()}] [${requestId || "unknown"}] Server Error: ${err.name} - ${err.message}`,
    );
  }

  const fallbackResponse: ApiErrorResponse & { requestId?: string } = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: isProduction
        ? "An unexpected internal error occurred"
        : err.message,
      timestamp: new Date().toISOString(),
    },
    ...(requestId ? { requestId } : {}),
  };

  res.status(500).json(fallbackResponse);
};
