import { randomUUID } from "crypto";

import { NextFunction, Request, Response } from "express";

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const headerValue = req.header("x-correlation-id");
  const correlationId = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue || randomUUID();

  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);

  next();
};
