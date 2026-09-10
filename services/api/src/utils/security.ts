import { z } from "zod";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "@nearvia/config";

/**
 * Validates that an input parameter is a strictly formatted UUID.
 * Throws an AppError with 400 Bad Request if invalid.
 */
export function validateUuid(val: unknown, paramName = "ID"): string {
  const str = Array.isArray(val) ? val[0] : val;
  if (typeof str !== "string" || !str.trim()) {
    throw new AppError(`${paramName} is required`, 400, ErrorCode.VALIDATION_ERROR);
  }
  const parsed = z.string().uuid().safeParse(str.trim());
  if (!parsed.success) {
    throw new AppError(`Invalid ${paramName} format: must be a valid UUID`, 400, ErrorCode.VALIDATION_ERROR);
  }
  return parsed.data;
}

/**
 * Safely sanitizes and clamps pagination parameters to prevent DoS via huge/negative limits.
 */
export function clampPagination(
  query: any,
  defaultLimit = 20,
  maxLimit = 100,
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query?.page || "1"), 10) || 1);
  const rawLimit = parseInt(String(query?.limit || defaultLimit), 10) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
