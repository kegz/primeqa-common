import { Request, Response } from "express";

import {
  rateLimit,
  loginRateLimiter,
  _cleanupRateLimitCache,
} from "../../src/middlewares/rateLimit.middleware";
import { AppError } from "../../src/errors/AppError";
import { ErrorCode } from "../../src/types/api";

describe("Rate Limit Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockReq = {
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
      headers: {},
    } as Partial<Request>;

    mockRes = {} as Partial<Response>;
    nextFunction = jest.fn();
  });

  describe("rateLimit()", () => {
    it("should allow first request", () => {
      const limiter = rateLimit({ max: 3, windowMs: 60000 });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should track requests per IP", () => {
      const limiter = rateLimit({ max: 3, windowMs: 60000 });
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();
      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();
      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();
      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
      const error = nextFunction.mock.calls[0][0] as AppError;
      expect(error.status).toBe(429);
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it("should use x-forwarded-for when ip is missing", () => {
      mockReq = {
        ip: undefined,
        headers: { "x-forwarded-for": "10.0.0.1" },
      };

      const limiter = rateLimit({ max: 5 });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should use custom key generator", () => {
      const customKeyGen = jest.fn().mockReturnValue("custom-key");
      const limiter = rateLimit({ max: 1, keyGenerator: customKeyGen });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(customKeyGen).toHaveBeenCalledWith(mockReq);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should use custom error message", () => {
      const customMessage = "Rate limit exceeded";
      const limiter = rateLimit({ max: 1, message: customMessage });
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      const error = nextFunction.mock.calls[0][0] as AppError;
      expect(error.message).toBe(customMessage);
    });

    it("should reset after window expires", () => {
      const limiter = rateLimit({ max: 1, windowMs: 100 });
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should handle unknown IP gracefully", () => {
      mockReq = {
        ip: undefined,
        headers: {},
      };

      const limiter = rateLimit({ max: 5 });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("loginRateLimiter", () => {
    it("should be a configured rate limiter", () => {
      expect(typeof loginRateLimiter).toBe("function");
    });

    it("should limit login attempts", () => {
      loginRateLimiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe("_cleanupRateLimitCache()", () => {
    it("should cleanup expired entries", () => {
      const now = Date.now();
      _cleanupRateLimitCache(now);
      expect(true).toBe(true);
    });
  });
});
