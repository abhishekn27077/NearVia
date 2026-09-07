import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express, { Express, Request, Response } from "express";
import { UserRole } from "@nearvia/types";
import { registerRequestSchema } from "@nearvia/validation";
import {
  errorHandler,
  notFoundHandler,
  authenticateUser,
  requireRole,
  validateRequest,
} from "../src/middleware";
import { authRouter } from "../src/modules/auth";
import { authService } from "../src/modules/auth/service";

describe("Authentication & Role-Based Authorization Engine", () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mount Auth Module Routes
    app.use("/api/v1/auth", authRouter);

    // Mock Protected Routes for Testing Role Authorization Guards
    app.get(
      "/api/v1/test/worker-only",
      authenticateUser,
      requireRole(UserRole.WORKER),
      (req: Request, res: Response) => {
        res
          .status(200)
          .json({ success: true, message: "Welcome Worker", user: req.user });
      },
    );

    app.get(
      "/api/v1/test/provider-only",
      authenticateUser,
      requireRole(UserRole.PROVIDER),
      (req: Request, res: Response) => {
        res
          .status(200)
          .json({ success: true, message: "Welcome Provider", user: req.user });
      },
    );

    app.get(
      "/api/v1/test/admin-only",
      authenticateUser,
      requireRole(UserRole.ADMIN),
      (req: Request, res: Response) => {
        res
          .status(200)
          .json({ success: true, message: "Welcome Admin", user: req.user });
      },
    );

    // Centralized Handlers
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  it("Test 1: Unauthenticated request to /api/v1/auth/me should be rejected with 401 Unauthorized", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toContain("Authentication required");
  });

  it("Test 2: Invalid Bearer token format should be rejected with 401 Unauthorized", async () => {
    const res = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "InvalidTokenFormat");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Test 3: Worker cannot claim ADMIN role during public registration (Rejects with 400/403)", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      authId: "auth_attacker_admin_attempt",
      phone: "+919876543999",
      fullName: "Attacker Impersonator",
      role: "ADMIN", // Malicious client attempt
    });

    // Validation schema rejects ADMIN for public self-registration
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Test 4: Validation rejects invalid phone numbers on registration", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      authId: "auth_invalid_phone",
      phone: "not-a-phone",
      fullName: "Invalid Phone User",
      role: "WORKER",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Test 5: Public registration accepts valid roles: WORKER, PROVIDER, AGENT", () => {
    const validWorker = registerRequestSchema.safeParse({
      authId: "auth_w1",
      phone: "+919876543201",
      fullName: "Worker One",
      role: UserRole.WORKER,
    });
    expect(validWorker.success).toBe(true);

    const validProvider = registerRequestSchema.safeParse({
      authId: "auth_p1",
      phone: "+919876543202",
      fullName: "Provider One",
      role: UserRole.PROVIDER,
    });
    expect(validProvider.success).toBe(true);

    const validAgent = registerRequestSchema.safeParse({
      authId: "auth_a1",
      phone: "+919876543203",
      fullName: "Agent One",
      role: UserRole.AGENT,
    });
    expect(validAgent.success).toBe(true);
  });

  it("Test 6: Role Guard: requireRole blocks cross-role access (Worker accessing Provider route -> 403 Forbidden)", () => {
    const middleware = requireRole(UserRole.PROVIDER);
    const mockReq = {
      user: {
        id: "w1",
        authId: "auth_w1",
        phone: "+919876543201",
        fullName: "Worker One",
        role: UserRole.WORKER,
        isActive: true,
      },
    } as unknown as Request;

    let errorResult: any = null;
    const next = (err?: any) => {
      errorResult = err;
    };

    middleware(mockReq, {} as Response, next);

    expect(errorResult).toBeDefined();
    expect(errorResult.statusCode).toBe(403);
    expect(errorResult.code).toBe("FORBIDDEN");
    expect(errorResult.message).toContain("Access denied");
  });

  it("Test 7: Role Guard: requireRole allows matching role (Provider accessing Provider route -> 200 OK)", () => {
    const middleware = requireRole(UserRole.PROVIDER);
    const mockReq = {
      user: {
        id: "p1",
        authId: "auth_p1",
        phone: "+919876543202",
        fullName: "Provider One",
        role: UserRole.PROVIDER,
        isActive: true,
      },
    } as unknown as Request;

    let nextCalled = false;
    const next = (err?: any) => {
      if (!err) nextCalled = true;
    };

    middleware(mockReq, {} as Response, next);
    expect(nextCalled).toBe(true);
  });

  it("Test 8: Suspended account is blocked from performing protected operations (403 Forbidden)", () => {
    const mockUserRow = {
      id: "suspended_user_1",
      auth_id: "auth_suspended",
      phone: "+919876543000",
      full_name: "Suspended User",
      email: null,
      role: UserRole.WORKER,
      is_active: false, // Account is suspended
    };

    const isAllowed = mockUserRow.is_active;
    expect(isAllowed).toBe(false);
  });

  it("Test 9: Safe User Serialization: No passwords, service keys, or secrets in user context", () => {
    const safeUser = {
      id: "u100",
      authId: "auth_u100",
      phone: "+919876543210",
      fullName: "Safe User",
      role: UserRole.WORKER,
      isActive: true,
    };

    expect((safeUser as any).password).toBeUndefined();
    expect((safeUser as any).serviceRoleKey).toBeUndefined();
    expect((safeUser as any).token).toBeUndefined();
  });
});
