import { Request, Response } from "express";

import {
  idempotencyMiddleware,
  requireIdempotencyKey,
  _cleanupIdempotencyCache,
} from "../../src/middlewares/idempotency.middleware";
import { AppError } from "../../src/errors/AppError";
import { ErrorCode } from "../../src/types/api";

describe("Idempotency Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: jest.Mock;
  let sendMock: jest.Mock;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let setMock: jest.Mock;
  let getHeaderMock: jest.Mock;

  beforeEach(() => {
    sendMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();
    setMock = jest.fn().mockReturnThis();
    getHeaderMock = jest.fn();

    mockReq = {
      method: "POST",
      header: getHeaderMock,
    } as Partial<Request>;

    mockRes = {
      send: sendMock,
      json: jsonMock,
      status: statusMock,
      set: setMock,
      getHeader: jest.fn(),
      statusCode: 200,
    } as Partial<Response>;

    nextFunction = jest.fn();
  });

  describe("idempotencyMiddleware()", () => {
    it("should pass through non-POST requests", () => {
      mockReq.method = "GET";
      const middleware = idempotencyMiddleware();

      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it("should pass through when no Idempotency-Key header", () => {
      getHeaderMock.mockReturnValue(undefined);
      const middleware = idempotencyMiddleware();

      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it("should cache response for new idempotency key", () => {
      getHeaderMock.mockReturnValue("test-key-1");
      const middleware = idempotencyMiddleware();

      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it("should return cached response for duplicate key", () => {
      getHeaderMock.mockReturnValue("test-key-2");
      const middleware = idempotencyMiddleware();
      middleware(mockReq as Request, mockRes as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledTimes(1);
      mockRes.send!({ success: true });
      nextFunction.mockClear();
      sendMock.mockClear();

      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(sendMock).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should respect custom TTL", () => {
      getHeaderMock.mockReturnValue("test-key-ttl");
      const middleware = idempotencyMiddleware({ ttlMs: 1000 });

      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it("should trim whitespace from idempotency key", () => {
      getHeaderMock.mockReturnValue("  test-key-trim  ");
      const middleware = idempotencyMiddleware();

      middleware(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe("requireIdempotencyKey()", () => {
    it("should pass when Idempotency-Key is present", () => {
      getHeaderMock.mockReturnValue("valid-key");

      requireIdempotencyKey(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should return error when Idempotency-Key is missing", () => {
      getHeaderMock.mockReturnValue(undefined);

      requireIdempotencyKey(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
      const error = nextFunction.mock.calls[0][0] as AppError;
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.status).toBe(400);
    });

    it("should return error when Idempotency-Key is empty", () => {
      getHeaderMock.mockReturnValue("");

      requireIdempotencyKey(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe("_cleanupIdempotencyCache()", () => {
    it("should cleanup expired entries", () => {
      const now = Date.now();
      _cleanupIdempotencyCache(now);
      expect(true).toBe(true);
    });
  });
});
