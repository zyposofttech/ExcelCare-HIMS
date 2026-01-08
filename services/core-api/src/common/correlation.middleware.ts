import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
export function correlation(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-correlation-id"];
  const cid = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
  res.setHeader("x-correlation-id", cid);
  (req as any).correlationId = cid;
  next();
}
