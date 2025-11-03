import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error("[ErrorHandler]", err);

  const status = err.status ?? 500;
  const message =
    err.message || (status >= 500 ? "Internal Server Error" : "Bad Request");

  res.status(status).json({
    success: false,
    message,
  });
};
