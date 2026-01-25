import { NextFunction, Request, Response } from "express";
import { ObjectSchema } from "joi";

import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";

export const validateBody = (schema: ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        message: detail.message,
        path: detail.path,
      }));
      return next(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Validation failed",
          400,
          details,
        ),
      );
    }

    req.body = value;
    next();
  };
};
