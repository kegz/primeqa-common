import { Request, Response, NextFunction } from "express";
import Joi from "joi";

import { validateBody } from "../../src/middlewares/validate.middleware";
import { isObjectId, isISODate, isEnumValue } from "../../src/utils/validation";
import { ErrorCode } from "../../src/types/api";

describe("Validation", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe("validateBody() middleware", () => {
    describe("Spec 5.6.1: Schema validation", () => {
      it("should pass valid data through", () => {
        const schema = Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required(),
        });

        mockRequest.body = {
          name: "John Doe",
          email: "john@example.com",
        };

        const middleware = validateBody(schema);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith();
        const call = (nextFunction as jest.Mock).mock.calls[0];
        expect(call[0]).toBeUndefined();
      });

      it("should reject invalid data", () => {
        const schema = Joi.object({
          name: Joi.string().required(),
          email: Joi.string().email().required(),
        });

        mockRequest.body = {
          name: "John Doe",
          email: "invalid-email",
        };

        const middleware = validateBody(schema);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 400,
            code: ErrorCode.VALIDATION_ERROR,
            message: "Validation failed",
          }),
        );
      });
    });

    describe("Spec 5.6.2: Standard error format", () => {
      it("should return structured validation errors", () => {
        const schema = Joi.object({
          name: Joi.string().required(),
          age: Joi.number().min(0).required(),
        });

        mockRequest.body = {
          name: "",
          age: -5,
        };

        const middleware = validateBody(schema);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        const error = (nextFunction as jest.Mock).mock.calls[0][0];
        expect(error.details).toBeDefined();
        expect(Array.isArray(error.details)).toBe(true);
        expect(error.details.length).toBeGreaterThan(0);
        error.details.forEach((detail: any) => {
          expect(detail).toHaveProperty("message");
          expect(detail).toHaveProperty("path");
        });
      });
    });

    describe("Spec 5.6.3: Strip unknown fields", () => {
      it("should remove fields not in schema", () => {
        const schema = Joi.object({
          name: Joi.string().required(),
        });

        mockRequest.body = {
          name: "John",
          extraField: "should be removed",
          anotherExtra: 123,
        };

        const middleware = validateBody(schema);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.body).toEqual({ name: "John" });
        expect(mockRequest.body.extraField).toBeUndefined();
        expect(mockRequest.body.anotherExtra).toBeUndefined();
      });
    });

    describe("Spec 5.6.4: Required field validation", () => {
      it("should reject missing required fields", () => {
        const schema = Joi.object({
          name: Joi.string().required(),
          email: Joi.string().required(),
        });

        mockRequest.body = {
          name: "John",
        };

        const middleware = validateBody(schema);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 400,
            code: ErrorCode.VALIDATION_ERROR,
          }),
        );
      });
    });

    describe("Spec: Bad input never reaches business logic", () => {
      it("should block request on validation failure", () => {
        const schema = Joi.object({
          email: Joi.string().email().required(),
        });

        mockRequest.body = { email: "not-an-email" };

        const middleware = validateBody(schema);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );
        const error = (nextFunction as jest.Mock).mock.calls[0][0];
        expect(error).toBeDefined();
        expect(error.status).toBe(400);
      });
    });
  });

  describe("isObjectId()", () => {
    describe("Spec 5.6.5: MongoDB ObjectId validation", () => {
      it("should validate 24-character hex strings", () => {
        expect(isObjectId("507f1f77bcf86cd799439011")).toBe(true);
        expect(isObjectId("000000000000000000000000")).toBe(true);
        expect(isObjectId("FFFFFFFFFFFFFFFFFFFFFFFF")).toBe(true);
      });

      it("should reject invalid ObjectIds", () => {
        expect(isObjectId("invalid")).toBe(false);
        expect(isObjectId("507f1f77bcf86cd79943901")).toBe(false);
        expect(isObjectId("507f1f77bcf86cd7994390111")).toBe(false);
        expect(isObjectId("507f1f77bcf86cd799439g11")).toBe(false);
        expect(isObjectId(123)).toBe(false);
        expect(isObjectId(null)).toBe(false);
        expect(isObjectId(undefined)).toBe(false);
      });
    });
  });

  describe("isISODate()", () => {
    describe("Spec 5.6.6: ISO 8601 date validation", () => {
      it("should validate ISO date strings", () => {
        expect(isISODate("2026-01-25T12:00:00.000Z")).toBe(true);
        expect(isISODate("2020-12-31T23:59:59Z")).toBe(true);
        expect(isISODate("2023-06-15T10:30:45.123Z")).toBe(true);
      });

      it("should reject invalid dates", () => {
        expect(isISODate("2026-01-25")).toBe(false);
        expect(isISODate("2026-01-25T12:00:00")).toBe(false);
        expect(isISODate("invalid-date")).toBe(false);
        expect(isISODate("2026-13-01T12:00:00Z")).toBe(false);
        expect(isISODate(123)).toBe(false);
        expect(isISODate(null)).toBe(false);
      });
    });
  });

  describe("isEnumValue()", () => {
    describe("Spec 5.6.7: Enum validation", () => {
      it("should validate string enums", () => {
        const statuses = ["active", "inactive", "pending"] as const;
        expect(isEnumValue("active", statuses)).toBe(true);
        expect(isEnumValue("inactive", statuses)).toBe(true);
        expect(isEnumValue("invalid", statuses)).toBe(false);
      });

      it("should validate number enums", () => {
        const codes = [1, 2, 3] as const;
        expect(isEnumValue(1, codes)).toBe(true);
        expect(isEnumValue(2, codes)).toBe(true);
        expect(isEnumValue(4, codes)).toBe(false);
      });

      it("should be type-safe", () => {
        const statuses = ["active", "inactive"] as const;
        expect(isEnumValue("active", statuses)).toBe(true);
        expect(isEnumValue(123, statuses)).toBe(false);
      });
    });
  });

  describe("Spec: Validation error standardization", () => {
    it("should provide consistent error structure across validators", () => {
      const schema = Joi.object({
        id: Joi.string().required(),
        status: Joi.string().valid("active", "inactive").required(),
        createdAt: Joi.date().iso().required(),
      });

      mockRequest.body = {
        id: "not-an-objectid",
        status: "invalid-status",
        createdAt: "not-a-date",
      };

      const middleware = validateBody(schema);
      middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction,
      );

      const error = (nextFunction as jest.Mock).mock.calls[0][0];
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.status).toBe(400);
      expect(error.message).toBe("Validation failed");
      expect(error.details).toBeDefined();
      expect(Array.isArray(error.details)).toBe(true);
    });
  });
});
