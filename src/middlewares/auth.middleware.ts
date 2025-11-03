import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
      maxAge: "1h",
    }) as JwtPayload;

    req.user = decoded;
    next();
  } catch (error_) {
    // underscore suppresses unused-var warning
    return res
      .status(401)
      .json({ message: "Invalid or expired token", error: error_ });
  }
};
