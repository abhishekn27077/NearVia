import { describe, it, expect } from "vitest";
import { AppError } from "../src/middleware/errorHandler";
import { ErrorCode, NEARVIA_CONFIG } from "@nearvia/config";

describe("Configuration & Error Primitives", () => {
  it("should load default constants from @nearvia/config", () => {
    expect(NEARVIA_CONFIG.APP_NAME).toBe("NEARVIA");
    expect(NEARVIA_CONFIG.TAGLINE).toBe("Work Within Reach");
    expect(NEARVIA_CONFIG.HYPERLOCAL.DEFAULT_RADIUS_KM).toBe(5);
    expect(NEARVIA_CONFIG.API_PREFIX).toBe("/api/v1");
  });

  it("should instantiate AppError with code, message, and statusCode", () => {
    const error = new AppError(
      "Resource unavailable",
      404,
      ErrorCode.NOT_FOUND,
      { id: "123" },
    );
    expect(error.message).toBe("Resource unavailable");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.details).toEqual({ id: "123" });
  });
});
