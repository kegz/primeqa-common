import "express";
import { UserClaims } from "./user";

declare module "express-serve-static-core" {
  interface Request {
    user?: UserClaims;
    tenantId?: string;
    correlationId?: string;
  }
}
