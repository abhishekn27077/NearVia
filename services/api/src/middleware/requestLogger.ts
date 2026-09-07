import { Request, Response, NextFunction } from "express";

const SENSITIVE_KEYS = [
  "password",
  "token",
  "authorization",
  "secret",
  "cookie",
  "apikey",
  "api_key",
  "key",
  "card",
  "cvv",
];

export function redactSensitiveData(data: any): any {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  const redacted: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some((sk) => k.toLowerCase().includes(sk))) {
      redacted[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      redacted[k] = redactSensitiveData(v);
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "test") {
      const logEntry = {
        timestamp: new Date().toISOString(),
        requestId: req.id || "unknown",
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      };
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}
