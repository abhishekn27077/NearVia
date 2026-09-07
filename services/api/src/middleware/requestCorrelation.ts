import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestCorrelation(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header("x-request-id");
  const requestId = incomingId && incomingId.trim() ? incomingId.trim() : randomUUID();

  req.id = requestId;
  res.setHeader("x-request-id", requestId);

  next();
}
