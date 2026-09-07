import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Health Check & System API Foundation", () => {
  it("GET / should return service info", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("nearvia-api");
    expect(res.body.health).toBe("/api/v1/health");
  });

  it("GET /health should return 200 with ok status and nearvia-api identifier", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("nearvia-api");
    expect(res.body.environment).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /api/v1/health should return 200 with ok status and nearvia-api identifier", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("nearvia-api");
    expect(res.body.environment).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /api/v1/non-existent-route should return 404 with structured error envelope", async () => {
    const res = await request(app).get("/api/v1/non-existent-route");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("Resource not found");
    expect(res.body.error.timestamp).toBeDefined();
  });
});
