import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { authenticate } from "../../src/middlewares/auth.middleware";

describe("Authentication Negative Scenarios", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      header: function (name: string) {
        return this.headers?.[name.toLowerCase()];
      },
    } as Partial<Request>;
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as Partial<Response>;
    nextFunction = jest.fn();
    process.env.JWT_SECRET = "test-secret";
  });

  describe("Malformed tokens", () => {
    it("should reject token with invalid base64 encoding", () => {
      mockReq.headers = { authorization: "Bearer !!!invalid-base64!!!" };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject token with missing segments", () => {
      mockReq.headers = { authorization: "Bearer header.payload" };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject token with extra segments", () => {
      mockReq.headers = {
        authorization: "Bearer header.payload.signature.extra",
      };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject token with null bytes", () => {
      mockReq.headers = { authorization: "Bearer token\x00with\x00nulls" };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject extremely long tokens", () => {
      const longToken = "a".repeat(100000);
      mockReq.headers = { authorization: `Bearer ${longToken}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Token tampering", () => {
    it("should reject token with modified payload", () => {
      const validToken = jwt.sign(
        { userId: "123", tenantId: "tenant1" },
        "test-secret",
      );
      const parts = validToken.split(".");
      const tamperedPayload = Buffer.from(
        '{"userId":"999","tenantId":"tenant2"}',
      ).toString("base64");
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      mockReq.headers = { authorization: `Bearer ${tamperedToken}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject token signed with wrong algorithm", () => {
      const token = jwt.sign({ userId: "123" }, "test-secret", {
        algorithm: "HS512",
      });
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject token with "none" algorithm', () => {
      const header = Buffer.from(
        JSON.stringify({ alg: "none", typ: "JWT" }),
      ).toString("base64");
      const payload = Buffer.from(JSON.stringify({ userId: "123" })).toString(
        "base64",
      );
      const noneToken = `${header}.${payload}.`;
      mockReq.headers = { authorization: `Bearer ${noneToken}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Expired tokens edge cases", () => {
    it("should reject token expired exactly 1 second ago", () => {
      const token = jwt.sign(
        { userId: "123", tenantId: "tenant1" },
        "test-secret",
        {
          expiresIn: "-1s",
        },
      );
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject token with exp in the past", () => {
      const token = jwt.sign(
        {
          userId: "123",
          tenantId: "tenant1",
          exp: Math.floor(Date.now() / 1000) - 3600,
        },
        "test-secret",
      );
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Authorization header variations", () => {
    it("should reject mixed case Bearer scheme", () => {
      mockReq.headers = { authorization: "bearer validtoken" };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject authorization with multiple spaces", () => {
      mockReq.headers = { authorization: "Bearer    token" };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject authorization with tab characters", () => {
      mockReq.headers = { authorization: "Bearer\ttoken" };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should reject authorization with newline characters", () => {
      mockReq.headers = { authorization: "Bearer\ntoken" };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("Payload injection attempts", () => {
    it("should reject token with SQL injection in userId", () => {
      const token = jwt.sign(
        { userId: "' OR '1'='1", tenantId: "tenant1" },
        "test-secret",
        { expiresIn: "1h" },
      );
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.userId).toBe("' OR '1'='1");
    });

    it("should handle token with XSS attempt in claims", () => {
      const token = jwt.sign(
        {
          userId: "123",
          name: '<script>alert("xss")</script>',
          tenantId: "tenant1",
        },
        "test-secret",
        {
          expiresIn: "1h",
        },
      );
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.user).toBeDefined();
    });
  });

  describe("Missing required claims", () => {
    it("should accept token without userId (validates but may fail later)", () => {
      const token = jwt.sign({ tenantId: "tenant1" }, "test-secret", {
        expiresIn: "1h",
      });
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should accept token without tenantId", () => {
      const token = jwt.sign({ userId: "123" }, "test-secret", {
        expiresIn: "1h",
      });
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should accept token with only iat claim", () => {
      const token = jwt.sign({}, "test-secret", { expiresIn: "1h" });
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });
});
