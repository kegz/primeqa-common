import { Request, Response, NextFunction } from "express";

import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";

export const errorHandler = (
  err: Error & { status?: number; code?: ErrorCode },
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error("[ErrorHandler]", err);

  const isAppError = err instanceof AppError;
  const status = isAppError ? err.status : (err.status ?? 500);
  const code = isAppError ? err.code : ErrorCode.INTERNAL_ERROR;
  const message =
    isAppError && err.message
      ? err.message
      : status >= 500
        ? "Internal Server Error"
        : err.message || "Bad Request";

  const traceId = req.correlationId;
  const details = isAppError ? err.details : undefined;

  res.status(status).json({
    success: false,
    code,
    message,
    traceId,
    details,
  });
};
