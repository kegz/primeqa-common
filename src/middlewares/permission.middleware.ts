import { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError";
import { ErrorCode } from "../types/api";
import { UserClaims } from "../types/user";

const ensureUser = (req: Request): UserClaims => {
  const user = req.user as UserClaims | undefined;
  if (!user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized", 401);
  }
  return user;
};

export const requirePermission = (permission: string) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = ensureUser(req);
      const perms = user.permissions ?? [];
      if (!perms.includes(permission)) {
        throw new AppError(ErrorCode.FORBIDDEN, "Forbidden", 403);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

export const requireAnyPermission = (permissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!permissions?.length) {
        throw new AppError(ErrorCode.FORBIDDEN, "Forbidden", 403);
      }
      const user = ensureUser(req);
      const perms = new Set(user.permissions ?? []);
      const hasPermission = permissions.some((perm) => perms.has(perm));
      if (!hasPermission) {
        throw new AppError(ErrorCode.FORBIDDEN, "Forbidden", 403);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
