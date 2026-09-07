import { Router, Request, Response } from "express";
import { query } from "../db";

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

export const healthRouter: Router = router;
