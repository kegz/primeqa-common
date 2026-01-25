import { Response } from "express";

import {
  success,
  fail,
  buildPaginationMeta,
  pagedResponse,
} from "../../src/utils/response";
import { ErrorCode } from "../../src/types/api";

describe("Response Utilities", () => {
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    mockRes = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Partial<Response>;
  });

  describe("success()", () => {
    it("should return 200 with success response", () => {
      success(mockRes as Response, { id: "123" });

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Success",
        data: { id: "123" },
      });
    });

    it("should allow custom message", () => {
      success(mockRes as Response, { id: "123" }, "Custom message");

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Custom message",
        data: { id: "123" },
      });
    });
  });

  describe("fail()", () => {
    it("should return error response with status", () => {
      fail(
        mockRes as Response,
        400,
        "Bad request",
        ErrorCode.VALIDATION_ERROR,
        "trace-123",
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        code: ErrorCode.VALIDATION_ERROR,
        message: "Bad request",
        traceId: "trace-123",
        details: undefined,
      });
    });

    it("should include details when provided", () => {
      const details = { field: "email", error: "invalid" };
      fail(
        mockRes as Response,
        400,
        "Validation error",
        ErrorCode.VALIDATION_ERROR,
        "trace-123",
        details,
      );

      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        code: ErrorCode.VALIDATION_ERROR,
        message: "Validation error",
        traceId: "trace-123",
        details,
      });
    });
  });

  describe("buildPaginationMeta()", () => {
    it("should calculate correct pagination metadata", () => {
      const meta = buildPaginationMeta(100, 2, 10);

      expect(meta).toEqual({
        total: 100,
        totalPages: 10,
        page: 2,
        pageSize: 10,
      });
    });

    it("should handle zero pageSize", () => {
      const meta = buildPaginationMeta(100, 1, 0);
      expect(meta.totalPages).toBeGreaterThan(0);
      expect(meta.pageSize).toBe(0);
    });
  });

  describe("pagedResponse()", () => {
    it("should return paginated response", () => {
      const items = [{ id: "1" }, { id: "2" }];
      pagedResponse(mockRes as Response, items, 20, 1, 10);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Success",
        data: items,
        meta: {
          total: 20,
          totalPages: 2,
          page: 1,
          pageSize: 10,
        },
      });
    });

    it("should allow custom message", () => {
      pagedResponse(mockRes as Response, [], 0, 1, 10, "No results");

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "No results",
        data: [],
        meta: {
          total: 0,
          totalPages: 1,
          page: 1,
          pageSize: 10,
        },
      });
    });
  });
});
