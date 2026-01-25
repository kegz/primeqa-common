import { Request, Response, NextFunction } from "express";
import Joi from "joi";

import { validateBody } from "../../src/middlewares/validate.middleware";
import { isObjectId, isISODate, isEnumValue } from "../../src/utils/validation";

describe("Validation Negative Scenarios", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {} as Partial<Response>;
    nextFunction = jest.fn();
  });

  describe("Schema bypass attempts", () => {
    it("should reject unknown properties when unknown is disabled", () => {
      const schema = Joi.object({ name: Joi.string() }).unknown(false);
      mockReq.body = { name: "test", isAdmin: true };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should strip unknown properties by default", () => {
      const schema = Joi.object({ name: Joi.string() });
      mockReq.body = { name: "test", unknown: "field" };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.body).not.toHaveProperty("unknown");
    });

    it("should strip prototype from request body", () => {
      const schema = Joi.object({ name: Joi.string() });
      mockReq.body = { name: "test", prototype: { isAdmin: true } };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.body).not.toHaveProperty("prototype");
    });
  });

  describe("Type confusion attacks", () => {
    it("should reject array when object expected", () => {
      const schema = Joi.object({ name: Joi.string().required() });
      mockReq.body = ["not", "an", "object"];

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should reject null when object expected", () => {
      const schema = Joi.object({ name: Joi.string().required() });
      mockReq.body = null;

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle deeply nested objects", () => {
      const schema = Joi.object({ data: Joi.object() });
      const deepObj: any = {};
      let current = deepObj;
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }
      mockReq.body = { data: deepObj };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle circular references gracefully", () => {
      const schema = Joi.object({ data: Joi.any() });
      const circular: any = { name: "test" };
      circular.self = circular;
      mockReq.body = circular;

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe("String validation edge cases", () => {
    it("should reject extremely long strings", () => {
      const schema = Joi.object({ name: Joi.string().max(100) });
      mockReq.body = { name: "a".repeat(10000) };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle strings with null bytes", () => {
      const schema = Joi.object({ name: Joi.string() });
      mockReq.body = { name: "test\x00injection" };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.body.name).toBe("test\x00injection");
    });

    it("should handle unicode edge cases", () => {
      const schema = Joi.object({ name: Joi.string() });
      mockReq.body = { name: "𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉" };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle emoji sequences", () => {
      const schema = Joi.object({ name: Joi.string() });
      mockReq.body = { name: "👨‍👩‍👧‍👦" };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("Number validation edge cases", () => {
    it("should handle Number.MAX_VALUE", () => {
      const schema = Joi.object({ value: Joi.number().max(1000) });
      mockReq.body = { value: Number.MAX_VALUE };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle Number.MIN_VALUE", () => {
      const schema = Joi.object({ value: Joi.number() });
      mockReq.body = { value: Number.MIN_VALUE };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should reject NaN", () => {
      const schema = Joi.object({ value: Joi.number() });
      mockReq.body = { value: NaN };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should reject Infinity", () => {
      const schema = Joi.object({ value: Joi.number() });
      mockReq.body = { value: Infinity };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should reject negative Infinity", () => {
      const schema = Joi.object({ value: Joi.number() });
      mockReq.body = { value: -Infinity };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("isObjectId edge cases", () => {
    it("should reject ObjectId with invalid characters", () => {
      expect(isObjectId("507f1f77bcf86cd79943901g")).toBe(false);
    });

    it("should reject ObjectId that is too short", () => {
      expect(isObjectId("507f1f77bcf86cd79943901")).toBe(false);
    });

    it("should reject ObjectId that is too long", () => {
      expect(isObjectId("507f1f77bcf86cd799439011a")).toBe(false);
    });

    it("should accept uppercase ObjectId (case insensitive)", () => {
      expect(isObjectId("507F1F77BCF86CD799439011")).toBe(true);
    });

    it("should accept mixed case ObjectId (case insensitive)", () => {
      expect(isObjectId("507f1F77bcf86Cd799439011")).toBe(true);
    });

    it("should reject ObjectId with spaces", () => {
      expect(isObjectId("507f1f77 bcf86cd7 99439011")).toBe(false);
    });

    it("should reject null", () => {
      expect(isObjectId(null)).toBe(false);
    });

    it("should reject undefined", () => {
      expect(isObjectId(undefined)).toBe(false);
    });

    it("should reject number", () => {
      expect(isObjectId(Number("123456789012345678901234"))).toBe(false);
    });

    it("should reject object", () => {
      expect(isObjectId({ id: "507f1f77bcf86cd799439011" })).toBe(false);
    });
  });

  describe("isISODate edge cases", () => {
    it("should reject date with invalid month", () => {
      expect(isISODate("2024-13-01T00:00:00.000Z")).toBe(false);
    });

    it("should accept dates that JavaScript normalizes (Feb 30 -> Mar 1)", () => {
      expect(isISODate("2024-02-30T00:00:00.000Z")).toBe(true);
    });

    it("should reject date with invalid hour", () => {
      expect(isISODate("2024-01-01T25:00:00.000Z")).toBe(false);
    });

    it("should reject date with invalid minute", () => {
      expect(isISODate("2024-01-01T00:60:00.000Z")).toBe(false);
    });

    it("should reject date with invalid second", () => {
      expect(isISODate("2024-01-01T00:00:60.000Z")).toBe(false);
    });

    it("should reject date without Z suffix", () => {
      expect(isISODate("2024-01-01T00:00:00.000")).toBe(false);
    });

    it("should reject date with timezone offset", () => {
      expect(isISODate("2024-01-01T00:00:00.000+05:00")).toBe(false);
    });

    it("should reject date with single digit month", () => {
      expect(isISODate("2024-1-01T00:00:00.000Z")).toBe(false);
    });

    it("should reject date with single digit day", () => {
      expect(isISODate("2024-01-1T00:00:00.000Z")).toBe(false);
    });

    it("should reject date far in the past", () => {
      expect(isISODate("0001-01-01T00:00:00.000Z")).toBe(true);
    });

    it("should reject date far in the future", () => {
      expect(isISODate("9999-12-31T23:59:59.999Z")).toBe(true);
    });
  });

  describe("isEnumValue edge cases", () => {
    enum TestEnum {
      Value1 = "VALUE1",
      Value2 = "VALUE2",
    }

    it("should reject case-insensitive match", () => {
      expect(isEnumValue("value1", Object.values(TestEnum))).toBe(false);
    });

    it("should reject partial match", () => {
      expect(isEnumValue("VALUE", Object.values(TestEnum))).toBe(false);
    });

    it("should reject null", () => {
      expect(isEnumValue(null, Object.values(TestEnum))).toBe(false);
    });

    it("should reject undefined", () => {
      expect(isEnumValue(undefined, Object.values(TestEnum))).toBe(false);
    });

    it("should reject empty string for non-empty enum", () => {
      expect(isEnumValue("", Object.values(TestEnum))).toBe(false);
    });

    it("should handle number enum correctly", () => {
      enum NumEnum {
        Zero = 0,
        One = 1,
      }
      expect(
        isEnumValue(
          0,
          Object.values(NumEnum).filter((v) => typeof v === "number"),
        ),
      ).toBe(true);
      expect(
        isEnumValue(
          "0",
          Object.values(NumEnum).filter((v) => typeof v === "number"),
        ),
      ).toBe(false);
    });
  });

  describe("Array validation attacks", () => {
    it("should reject extremely large arrays", () => {
      const schema = Joi.object({ items: Joi.array().max(100) });
      mockReq.body = { items: new Array(10000).fill("item") };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle sparse arrays", () => {
      const schema = Joi.object({ items: Joi.array() });
      const sparse = new Array(100);
      sparse[0] = "first";
      sparse[99] = "last";
      mockReq.body = { items: sparse };

      validateBody(schema)(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });
});
