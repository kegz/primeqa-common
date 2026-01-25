import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { UserClaims } from "../types/user";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer") {
    return res.status(401).json({ message: "Invalid authorization scheme" });
  }

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: "Authentication not configured" });
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    }) as UserClaims;

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
