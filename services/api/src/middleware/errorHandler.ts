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

function sanitizeErrorDetails(details: unknown): unknown {
  if (!details) return undefined;
  if (typeof details === "string") {
    if (details.includes("pg_") || details.includes("SELECT ") || details.toLowerCase().includes("password")) {
      return undefined;
    }
    return details;
  }
  if (typeof details === "object" && details !== null) {
    const obj = details as Record<string, any>;
    if (obj.routine || obj.table || obj.constraint || obj.schema || obj.file || obj.line || obj.detail || obj.where) {
      return undefined;
    }
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (lower.includes("secret") || lower.includes("password") || lower.includes("token") || lower.includes("key")) {
        continue;
      }
      clean[k] = v;
    }
    return clean;
  }
  return details;
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
    const safeDetails = isProduction ? sanitizeErrorDetails(err.details) : err.details;
    const safeMessage =
      isProduction &&
      (err.message.includes("SELECT ") ||
        err.message.includes("FROM ") ||
        err.message.includes("relation \"") ||
        err.message.includes("syntax error at or near"))
        ? "A database operation failed"
        : err.message;

    const errorResponse: ApiErrorResponse & { requestId?: string } = {
      success: false,
      error: {
        code: err.code,
        message: safeMessage,
        ...(safeDetails !== undefined ? { details: safeDetails } : {}),
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
