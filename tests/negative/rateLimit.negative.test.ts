import { Request, Response } from "express";

import { rateLimit } from "../../src/middlewares/rateLimit.middleware";
import { AppError } from "../../src/errors/AppError";

describe("Rate Limit Negative Scenarios", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
    } as any;
    (mockReq as any).ip = `192.168.1.${Math.floor(Math.random() * 255)}`;
    mockRes = {} as Partial<Response>;
    nextFunction = jest.fn();
  });

  describe("IP spoofing attempts", () => {
    it("should handle multiple x-forwarded-for IPs", () => {
      (mockReq as any).ip = undefined;
      mockReq.headers = {
        "x-forwarded-for": "10.0.0.1, 192.168.1.1, 172.16.0.1",
      };

      const limiter = rateLimit({ max: 5 });
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle malformed x-forwarded-for", () => {
      (mockReq as any).ip = undefined;
      mockReq.headers = { "x-forwarded-for": "not-an-ip" };

      const limiter = rateLimit({ max: 5 });
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle x-forwarded-for with special characters", () => {
      (mockReq as any).ip = undefined;
      mockReq.headers = { "x-forwarded-for": '"; DROP TABLE users; --' };

      const limiter = rateLimit({ max: 5 });
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle extremely long x-forwarded-for", () => {
      (mockReq as any).ip = undefined;
      mockReq.headers = { "x-forwarded-for": "a".repeat(100000) };

      const limiter = rateLimit({ max: 5 });
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("Rate limit bypass attempts", () => {
    it("should not allow bypass with different header case", () => {
      (mockReq as any).ip = "10.0.0.1";
      const limiter = rateLimit({ max: 1 });

      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();

      nextFunction.mockClear();
      mockReq.headers = { "X-FORWARDED-FOR": "10.0.0.2" };
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should handle rapid successive requests", () => {
      (mockReq as any).ip = `test-${Date.now()}`;
      const limiter = rateLimit({ max: 3, windowMs: 1000 });

      for (let i = 0; i < 5; i++) {
        nextFunction.mockClear();
        limiter(mockReq as Request, mockRes as Response, nextFunction);

        if (i < 3) {
          expect(nextFunction).toHaveBeenCalledWith();
        } else {
          expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
        }
      }
    });

    it("should handle concurrent requests from same IP", async () => {
      (mockReq as any).ip = `concurrent-${Date.now()}`;
      const limiter = rateLimit({ max: 2 });

      const promises = Array(5)
        .fill(null)
        .map(() => {
          const next = jest.fn();
          limiter(mockReq as Request, mockRes as Response, next);
          return next;
        });

      const rejectedCount = promises.filter(
        (next) => next.mock.calls[0]?.[0] instanceof AppError,
      ).length;
      expect(rejectedCount).toBeGreaterThan(0);
    });
  });

  describe("Custom key generator attacks", () => {
    it("should handle key generator returning undefined", () => {
      const limiter = rateLimit({
        max: 5,
        keyGenerator: () => undefined as any,
      });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle key generator returning null", () => {
      const limiter = rateLimit({
        max: 5,
        keyGenerator: () => null as any,
      });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle key generator returning object", () => {
      const limiter = rateLimit({
        max: 5,
        keyGenerator: () => ({ ip: "10.0.0.1" }) as any,
      });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle key generator throwing error", () => {
      const limiter = rateLimit({
        max: 5,
        keyGenerator: () => {
          throw new Error("Key generation failed");
        },
      });

      expect(() => {
        limiter(mockReq as Request, mockRes as Response, nextFunction);
      }).toThrow();
    });

    it("should handle key generator returning very long key", () => {
      const limiter = rateLimit({
        max: 5,
        keyGenerator: () => "a".repeat(100000),
      });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle key generator with collision attempts", () => {
      const limiter = rateLimit({
        max: 2,
        keyGenerator: () => "same-key-for-all",
      });

      (mockReq as any).ip = "different-ip-1";
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();

      nextFunction.mockClear();
      (mockReq as any).ip = "different-ip-2";
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();

      nextFunction.mockClear();
      (mockReq as any).ip = "different-ip-3";
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe("Window edge cases", () => {
    it("should handle extremely small window", () => {
      const limiter = rateLimit({ max: 2, windowMs: 1 });

      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle extremely large window", () => {
      const limiter = rateLimit({
        max: 2,
        windowMs: 365 * 24 * 60 * 60 * 1000,
      });

      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle zero window", () => {
      const limiter = rateLimit({ max: 2, windowMs: 0 });

      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle negative window", () => {
      const limiter = rateLimit({ max: 2, windowMs: -1000 });

      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("Max limit edge cases", () => {
    it("should handle max of 0", () => {
      const limiter = rateLimit({ max: 0 });
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();

      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should handle negative max", () => {
      const limiter = rateLimit({ max: -1 });
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();

      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should handle extremely large max", () => {
      const limiter = rateLimit({ max: Number.MAX_SAFE_INTEGER });

      limiter(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle max of 1", () => {
      (mockReq as any).ip = `single-${Date.now()}`;
      const limiter = rateLimit({ max: 1 });

      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();

      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe("Memory exhaustion attempts", () => {
    it("should handle many unique IPs", () => {
      const limiter = rateLimit({ max: 5 });

      for (let i = 0; i < 10000; i++) {
        (mockReq as any).ip = `10.0.${Math.floor(i / 256)}.${i % 256}`;
        nextFunction.mockClear();
        limiter(mockReq as Request, mockRes as Response, nextFunction);
        expect(nextFunction).toHaveBeenCalledWith();
      }
    });

    it("should not leak memory with expired entries", () => {
      const limiter = rateLimit({ max: 5, windowMs: 10 });

      (mockReq as any).ip = "test-ip";
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      return new Promise((resolve) => {
        setTimeout(() => {
          nextFunction.mockClear();
          limiter(mockReq as Request, mockRes as Response, nextFunction);
          expect(nextFunction).toHaveBeenCalledWith();
          resolve(undefined);
        }, 20);
      });
    });
  });

  describe("Error message manipulation", () => {
    it("should not leak internal information in error message", () => {
      (mockReq as any).ip = `error-msg-${Date.now()}`;
      const limiter = rateLimit({
        max: 1,
        message: "Custom rate limit message",
      });

      limiter(mockReq as Request, mockRes as Response, nextFunction);
      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      const error = nextFunction.mock.calls[0][0] as AppError;
      expect(error.message).toBe("Custom rate limit message");
      expect(error.message).not.toContain("10.0.0.1");
      expect(error.message).not.toContain("cache");
    });

    it("should handle very long custom messages", () => {
      const limiter = rateLimit({
        max: 1,
        message: "a".repeat(10000),
      });

      (mockReq as any).ip = `long-msg-${Date.now()}`;
      limiter(mockReq as Request, mockRes as Response, nextFunction);
      nextFunction.mockClear();
      limiter(mockReq as Request, mockRes as Response, nextFunction);

      const error = nextFunction.mock.calls[0][0] as AppError;
      expect(error.message.length).toBe(10000);
    });
  });
});
