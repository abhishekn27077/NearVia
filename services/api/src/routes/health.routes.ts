import { Router, Request, Response } from "express";
import crypto from "crypto";
import { query } from "../db";
import { Sentry } from "../config/sentry";

const router = Router();

/**
 * Liveness Health Check Endpoint
 * Returns service status, environment, uptime, and memory usage.
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "nearvia-api",
    environment: process.env.NODE_ENV ?? "development",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness Health Check Endpoint
 * Verifies live database connectivity via SELECT 1 ping.
 */
router.get("/ready", async (_req: Request, res: Response) => {
  const start = Date.now();
  try {
    const result = await query("SELECT 1 AS ready");
    const latencyMs = Date.now() - start;

    if (result.rows && result.rows.length > 0) {
      res.status(200).json({
        status: "ready",
        database: "connected",
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "unhealthy",
        database: "no_response",
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      latencyMs,
      error: process.env.NODE_ENV === "development" ? err.message : "Database connection failed",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Deep Health Check Endpoint
 * Verifies API runtime, PostgreSQL connectivity, PostGIS spatial extension, and schema availability.
 */
router.get(["/health/deep", "/deep"], async (_req: Request, res: Response) => {
  const start = Date.now();
  const memory = process.memoryUsage();
  const memMb = {
    rss: (memory.rss / (1024 * 1024)).toFixed(2) + " MB",
    heapTotal: (memory.heapTotal / (1024 * 1024)).toFixed(2) + " MB",
    heapUsed: (memory.heapUsed / (1024 * 1024)).toFixed(2) + " MB",
  };

  try {
    // 1. Check DB connectivity & latency
    const dbStart = Date.now();
    await query("SELECT 1 AS ping");
    const dbLatencyMs = Date.now() - dbStart;

    // 2. Check PostGIS extension
    let postgisVersion = "unknown";
    try {
      const postgisRes = await query<{ version: string }>("SELECT PostGIS_Version() AS version");
      postgisVersion = postgisRes.rows[0]?.version || "enabled";
    } catch {
      postgisVersion = "unavailable";
    }

    // 3. Check public schema tables count
    const tablesRes = await query<{ count: string }>(
      "SELECT count(*)::text as count FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tableCount = parseInt(tablesRes.rows[0]?.count || "0", 10);

    const totalLatencyMs = Date.now() - start;

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "nearvia-api",
      environment: process.env.NODE_ENV ?? "development",
      uptimeSeconds: Math.floor(process.uptime()),
      latencyMs: totalLatencyMs,
      checks: {
        database: {
          status: "connected",
          latencyMs: dbLatencyMs,
        },
        spatial: {
          status: postgisVersion !== "unavailable" ? "ready" : "degraded",
          postgisVersion,
        },
        schema: {
          status: tableCount > 0 ? "ready" : "empty",
          tablesDiscovered: tableCount,
        },
        memory: memMb,
      },
    });
  } catch (err: any) {
    const totalLatencyMs = Date.now() - start;
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      service: "nearvia-api",
      environment: process.env.NODE_ENV ?? "development",
      uptimeSeconds: Math.floor(process.uptime()),
      latencyMs: totalLatencyMs,
      error: process.env.NODE_ENV === "development" ? err.message : "Service degraded",
      checks: {
        database: {
          status: "disconnected",
        },
        memory: memMb,
      },
    });
  }
});

let verificationDispatched = false;

/**
 * Temporary Protected Sentry Delivery Verification Endpoint
 * Only active when ENABLE_SENTRY_VERIFICATION === "true" and authenticated via x-sentry-verify-token.
 */
router.post(["/health/sentry-verify", "/sentry-verify"], async (req: Request, res: Response) => {
  // Lock 1: Feature enablement gate
  if (process.env.ENABLE_SENTRY_VERIFICATION !== "true") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Lock 2: Timing-safe secret verification
  const secret = process.env.SENTRY_VERIFY_SECRET;
  const rawAuth = req.headers.authorization;
  const bearerToken = rawAuth?.startsWith("Bearer ") ? rawAuth.slice(7).trim() : undefined;
  const token = (req.headers["x-sentry-verify-token"] as string | undefined) || bearerToken;

  if (
    !secret ||
    typeof token !== "string" ||
    token.length !== secret.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Lock 3: Single-use memory latch
  if (verificationDispatched) {
    res.status(409).json({
      success: false,
      error: "Verification event already dispatched during this runtime instance",
    });
    return;
  }

  if (!Sentry.isInitialized()) {
    res.status(503).json({
      success: false,
      error: "Sentry SDK is not initialized in this environment",
    });
    return;
  }

  verificationDispatched = true;

  const eventId = Sentry.withScope((scope) => {
    scope.setTag("runtime", "render-node-production");
    scope.setTag("verificationSource", "render-diagnostic");
    return Sentry.captureMessage(
      "NEARVIA - Render Sentry Delivery Verification",
      "info",
    );
  });

  const isFlushed = await Sentry.flush(10000);

  if (!isFlushed) {
    res.status(504).json({
      success: false,
      delivered: false,
      eventId,
      error: "Sentry.flush(10000) timed out",
      service: "nearvia-api",
      runtime: "render",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.status(200).json({
    success: true,
    delivered: true,
    eventId,
    service: "nearvia-api",
    runtime: "render",
    timestamp: new Date().toISOString(),
  });
});

export const healthRouter: Router = router;
