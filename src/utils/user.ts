import { Request } from "express";

import { UserClaims } from "../types/user";

export const getUserContext = (req: Request) => {
  const user = req.user as UserClaims | undefined;

  if (!user?.userId || !user.tenantId) {
    const error = new Error("Unauthorized") as Error & { status?: number };
    error.status = 401;
    throw error;
  }

  return {
    userId: user.userId,
    tenantId: user.tenantId,
    role: user.role,
    roleId: user.roleId,
    permissions: user.permissions,
    email: user.email,
  };
};
