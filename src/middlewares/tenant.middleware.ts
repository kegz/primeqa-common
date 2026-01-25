import { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";
import { UserClaims } from "../types/user";

const requireUserTenant = (req: Request): UserClaims => {
  const user = req.user as UserClaims | undefined;
  if (!user?.tenantId) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Tenant context required", 401);
  }
  req.tenantId = user.tenantId;
  return user;
};

export const requireTenant = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    requireUserTenant(req);
    next();
  } catch (err) {
    next(err);
  }
};

export const enforceTenantOnBody = (fieldName = "tenantId") => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = requireUserTenant(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const incomingTenant = body[fieldName] as string | undefined;

      if (incomingTenant && incomingTenant !== user.tenantId) {
        throw new AppError(ErrorCode.FORBIDDEN, "Tenant mismatch", 403);
      }

      body[fieldName] = user.tenantId;
      req.body = body;
      next();
    } catch (err) {
      next(err);
    }
  };
};

export const assertTenantMatch = (req: Request, targetTenantId?: string) => {
  const user = requireUserTenant(req);
  const effectiveTenant = targetTenantId ?? req.tenantId;

  if (effectiveTenant && effectiveTenant !== user.tenantId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Tenant mismatch", 403);
  }
};
