/**
 * @nearvia/types
 * Centralized TypeScript type definitions for the NEARVIA ecosystem.
 */

export type Environment = "development" | "test" | "production";

export interface ApiResponsePrimitive<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
  timestamp?: string;
}

export * from "./enums.js";
export * from "./models.js";
