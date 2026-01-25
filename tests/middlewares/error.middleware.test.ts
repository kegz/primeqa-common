import { Request, Response, NextFunction } from "express";

import { errorHandler } from "../../src/middlewares/error.middleware";
import { AppError } from "../../src/errors/AppError";
import { ErrorCode } from "../../src/types/api";

describe("Error Handling", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRequest = {
      correlationId: "test-correlation-id-123",
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("Spec 5.4.1: AppError handling", () => {
    it("should handle AppError with correct status and code", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "User not found", 404, {
        userId: "123",
      });

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        code: ErrorCode.NOT_FOUND,
        message: "User not found",
        traceId: "test-correlation-id-123",
        details: { userId: "123" },
      });
    });

    it("should handle all ErrorCode types", () => {
      const errorCodes = [
        { code: ErrorCode.VALIDATION_ERROR, status: 400 },
        { code: ErrorCode.UNAUTHORIZED, status: 401 },
        { code: ErrorCode.FORBIDDEN, status: 403 },
        { code: ErrorCode.NOT_FOUND, status: 404 },
        { code: ErrorCode.CONFLICT, status: 409 },
        { code: ErrorCode.INTERNAL_ERROR, status: 500 },
      ];

      errorCodes.forEach(({ code, status }) => {
        const error = new AppError(code, "Test message", status);
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        errorHandler(error, mockRequest as Request, res as any, nextFunction);

        expect(res.status).toHaveBeenCalledWith(status);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code,
            success: false,
          }),
        );
      });
    });
  });

  describe("Spec 5.4.2: Generic error handling", () => {
    it("should map generic Error to 500 INTERNAL_ERROR", () => {
      const error = new Error("Something went wrong");

      errorHandler(
        error as any,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        code: ErrorCode.INTERNAL_ERROR,
        message: "Internal Server Error",
        traceId: "test-correlation-id-123",
        details: undefined,
      });
    });

    it("should use error.status if present", () => {
      const error: any = new Error("Bad request");
      error.status = 400;

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.INTERNAL_ERROR,
          message: "Bad request",
        }),
      );
    });
  });

  describe("Spec 5.4.3: No stack trace leakage", () => {
    it("should not include stack traces in response", () => {
      const error = new Error("Test error");
      error.stack =
        "Error: Test error\n    at test.ts:123:45\n    at handler.ts:67:89";

      errorHandler(
        error as any,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.stack).toBeUndefined();
      expect(JSON.stringify(jsonCall)).not.toContain("at test.ts");
    });

    it("should not leak AppError stack traces", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "Not found", 404);

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.stack).toBeUndefined();
    });
  });

  describe("Spec 5.4.4: Correlation ID inclusion", () => {
    it("should include traceId from req.correlationId", () => {
      mockRequest.correlationId = "unique-trace-id-456";
      const error = new AppError(
        ErrorCode.NOT_FOUND,
        "Resource not found",
        404,
      );

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "unique-trace-id-456",
        }),
      );
    });

    it("should handle missing correlationId gracefully", () => {
      mockRequest.correlationId = undefined;
      const error = new AppError(ErrorCode.INTERNAL_ERROR, "Error", 500);

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: undefined,
        }),
      );
    });
  });

  describe("Spec 5.4.5: Uniform response shape", () => {
    it("should always return { success: false, code, message, traceId }", () => {
      const errors = [
        new AppError(ErrorCode.VALIDATION_ERROR, "Invalid input", 400),
        new AppError(ErrorCode.UNAUTHORIZED, "Unauthorized", 401),
        new Error("Generic error"),
      ];

      errors.forEach((error) => {
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        errorHandler(
          error as any,
          mockRequest as Request,
          res as any,
          nextFunction,
        );

        const jsonCall = res.json.mock.calls[0][0];
        expect(jsonCall).toHaveProperty("success", false);
        expect(jsonCall).toHaveProperty("code");
        expect(jsonCall).toHaveProperty("message");
        expect(jsonCall).toHaveProperty("traceId");
        expect(typeof jsonCall.code).toBe("string");
        expect(typeof jsonCall.message).toBe("string");
      });
    });
  });

  describe("Spec 5.4.6: 5xx error message sanitization", () => {
    it("should mask 5xx error messages to prevent information leakage", () => {
      const error = new Error(
        "Database connection failed at host db.internal:5432",
      );
      (error as any).status = 500;

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.message).toBe("Internal Server Error");
      expect(jsonCall.message).not.toContain("db.internal");
      expect(jsonCall.message).not.toContain("5432");
    });

    it("should preserve 4xx error messages", () => {
      const error = new Error("Invalid email format");
      (error as any).status = 400;

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.message).toBe("Invalid email format");
    });
  });

  describe("Spec 5.4.7: Error logging", () => {
    it("should log all errors to console", () => {
      const error = new AppError(ErrorCode.NOT_FOUND, "Not found", 404);

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith("[ErrorHandler]", error);
    });
  });

  describe("Spec: AppError details preservation", () => {
    it("should include details from AppError", () => {
      const error = new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Validation failed",
        400,
        { field: "email", reason: "invalid format" },
      );

      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { field: "email", reason: "invalid format" },
        }),
      );
    });

    it("should not include details for non-AppError", () => {
      const error = new Error("Generic error");

      errorHandler(
        error as any,
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: undefined,
        }),
      );
    });
  });
});
