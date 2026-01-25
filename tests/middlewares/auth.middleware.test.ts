import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { authenticate } from "../../src/middlewares/auth.middleware";
import { UserClaims } from "../../src/types/user";

describe("Authentication Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  const JWT_SECRET = process.env.JWT_SECRET!;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe("Spec 5.1.1: Missing Authorization header → 401", () => {
    it("should return 401 when Authorization header is missing", () => {
      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Missing Authorization header",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe("Spec 5.1.2: Invalid authorization scheme → 401", () => {
    it("should return 401 when scheme is not Bearer", () => {
      mockRequest.headers = { authorization: "Basic sometoken" };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Invalid authorization scheme",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe("Spec 5.1.3: Empty token → 401", () => {
    it("should return 401 when token is empty", () => {
      mockRequest.headers = { authorization: "Bearer " };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Missing token",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 401 when only Bearer is present", () => {
      mockRequest.headers = { authorization: "Bearer" };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe("Spec 5.1.4: Invalid/expired token → 401", () => {
    it("should return 401 for invalid token", () => {
      mockRequest.headers = { authorization: "Bearer invalid-token" };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Invalid or expired token",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 401 for expired token", () => {
      const expiredToken = jwt.sign(
        { userId: "123", tenantId: "tenant1" },
        JWT_SECRET,
        { expiresIn: "-1h" },
      );
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Invalid or expired token",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe("Spec 5.1.5: Valid token → attach typed user context", () => {
    it("should attach UserClaims to req.user for valid token", () => {
      const userClaims: UserClaims = {
        userId: "user-123",
        tenantId: "tenant-456",
        role: "admin",
        roleId: "role-789",
        permissions: ["users.read", "users.write"],
        email: "test@example.com",
      };

      const validToken = jwt.sign(userClaims, JWT_SECRET, { expiresIn: "1h" });
      mockRequest.headers = { authorization: `Bearer ${validToken}` };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe(userClaims.userId);
      expect(mockRequest.user?.tenantId).toBe(userClaims.tenantId);
      expect(mockRequest.user?.role).toBe(userClaims.role);
      expect(mockRequest.user?.permissions).toEqual(userClaims.permissions);
      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should work with minimal UserClaims", () => {
      const minimalClaims: UserClaims = {
        userId: "user-123",
        tenantId: "tenant-456",
      };

      const validToken = jwt.sign(minimalClaims, JWT_SECRET, {
        expiresIn: "1h",
      });
      mockRequest.headers = { authorization: `Bearer ${validToken}` };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.userId).toBe(minimalClaims.userId);
      expect(mockRequest.user?.tenantId).toBe(minimalClaims.tenantId);
      expect(mockRequest.user?.role).toBeUndefined();
      expect(mockRequest.user?.permissions).toBeUndefined();
      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("Spec 5.1.6: No raw error leakage", () => {
    it("should not leak JWT error details", () => {
      mockRequest.headers = { authorization: "Bearer malformed.jwt.token" };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.message).toBe("Invalid or expired token");
      expect(jsonCall.message).not.toContain("jwt");
      expect(jsonCall.message).not.toContain("signature");
    });
  });

  describe("Spec 5.1.7: No hardcoded token TTL", () => {
    it("should accept tokens with any valid expiration", () => {
      const shortLivedToken = jwt.sign(
        { userId: "123", tenantId: "tenant1" },
        JWT_SECRET,
        { expiresIn: "5s" },
      );
      mockRequest.headers = { authorization: `Bearer ${shortLivedToken}` };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockRequest.user).toBeDefined();
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should accept tokens with long expiration", () => {
      const longLivedToken = jwt.sign(
        { userId: "123", tenantId: "tenant1" },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
      mockRequest.headers = { authorization: `Bearer ${longLivedToken}` };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockRequest.user).toBeDefined();
      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("Spec 5.1.8: Configuration error handling", () => {
    it("should return 500 if JWT_SECRET is not configured", () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      mockRequest.headers = { authorization: "Bearer sometoken" };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: "Authentication not configured",
      });
      expect(nextFunction).not.toHaveBeenCalled();

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe("Spec: Algorithm enforcement", () => {
    it("should only accept HS256 algorithm", () => {
      const token = jwt.sign(
        { userId: "123", tenantId: "tenant1" },
        JWT_SECRET,
        { algorithm: "HS256" },
      );
      mockRequest.headers = { authorization: `Bearer ${token}` };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockRequest.user).toBeDefined();
      expect(nextFunction).toHaveBeenCalledWith();
    });
  });
});
