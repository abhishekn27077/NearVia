import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { NEARVIA_CONFIG } from "@nearvia/config";
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  requestCorrelation,
  globalLimiter,
} from "./middleware";
import { apiRouter } from "./routes";
import { query } from "./db";

export function createApp(): Express {
  const app = express();

  // Request Correlation Middleware
  app.use(requestCorrelation);

  // Security Middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // API responses do not serve HTML directly
      crossOriginEmbedderPolicy: false,
    }),
  );
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        if (!isProduction || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
    }),
  );

  // Global Rate Limiter
  app.use(globalLimiter);

  // Body Parsing Middleware (Retain rawBody buffer for cryptographic webhook HMAC verification)
  app.use(
    express.json({
      limit: "1mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString("utf-8");
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Request Logging Middleware
  app.use(requestLogger);

  // Root Index Route
  app.get("/", (_req: Request, res: Response) => {
    res.status(200).json({
      name: NEARVIA_CONFIG.APP_NAME,
      tagline: NEARVIA_CONFIG.TAGLINE,
      service: "nearvia-api",
      health: `${NEARVIA_CONFIG.API_PREFIX}/health`,
      ready: `${NEARVIA_CONFIG.API_PREFIX}/ready`,
    });
  });

  // Root Health & Readiness Shortcuts
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "nearvia-api",
      environment: process.env.NODE_ENV ?? "development",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/ready", async (_req: Request, res: Response) => {
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

  // API Version 1 Router
  app.use(NEARVIA_CONFIG.API_PREFIX, apiRouter);

  // 404 Catch-all Middleware for Unknown Endpoints
  app.use(notFoundHandler);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}
