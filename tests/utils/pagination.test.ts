import { Response } from "express";

import { parsePagination } from "../../src/utils/pagination";
import { buildPaginationMeta, pagedResponse } from "../../src/utils/response";

describe("Pagination Utilities", () => {
  describe("parsePagination()", () => {
    describe("Spec 5.5.1: Safe defaults", () => {
      it("should use default page=1, pageSize=50", () => {
        const result = parsePagination({});

        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(50);
        expect(result.skip).toBe(0);
        expect(result.limit).toBe(50);
      });

      it("should allow custom defaults", () => {
        const result = parsePagination({}, { page: 2, pageSize: 20 });

        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(20);
        expect(result.skip).toBe(20);
        expect(result.limit).toBe(20);
      });
    });

    describe("Spec 5.5.2: Max limit enforcement", () => {
      it("should cap pageSize at 200 by default", () => {
        const result = parsePagination({ pageSize: 1000 });

        expect(result.pageSize).toBe(200);
        expect(result.limit).toBe(200);
      });

      it("should allow custom maxPageSize", () => {
        const result = parsePagination({ pageSize: 500 }, { maxPageSize: 100 });

        expect(result.pageSize).toBe(100);
        expect(result.limit).toBe(100);
      });

      it("should not cap pageSize below max", () => {
        const result = parsePagination({ pageSize: 25 }, { maxPageSize: 200 });

        expect(result.pageSize).toBe(25);
      });
    });

    describe("Spec 5.5.3: Input sanitization", () => {
      it("should handle negative page numbers", () => {
        const result = parsePagination({ page: -5 });

        expect(result.page).toBe(1);
        expect(result.skip).toBe(0);
      });

      it("should handle zero page number", () => {
        const result = parsePagination({ page: 0 });

        expect(result.page).toBe(1);
      });

      it("should handle negative pageSize", () => {
        const result = parsePagination({ pageSize: -10 });

        expect(result.pageSize).toBe(50);
      });

      it("should handle zero pageSize", () => {
        const result = parsePagination({ pageSize: 0 });

        expect(result.pageSize).toBe(50);
      });

      it("should handle non-numeric page", () => {
        const result = parsePagination({ page: "invalid" });

        expect(result.page).toBe(1);
      });

      it("should handle non-numeric pageSize", () => {
        const result = parsePagination({ pageSize: "abc" });

        expect(result.pageSize).toBe(50);
      });

      it("should handle decimal numbers by flooring", () => {
        const result = parsePagination({ page: 2.7, pageSize: 25.9 });

        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(25);
      });
    });

    describe("Spec 5.5.4: Skip/limit calculation", () => {
      it("should calculate correct skip for page 1", () => {
        const result = parsePagination({ page: 1, pageSize: 20 });

        expect(result.skip).toBe(0);
        expect(result.limit).toBe(20);
      });

      it("should calculate correct skip for page 2", () => {
        const result = parsePagination({ page: 2, pageSize: 20 });

        expect(result.skip).toBe(20);
        expect(result.limit).toBe(20);
      });

      it("should calculate correct skip for page 5", () => {
        const result = parsePagination({ page: 5, pageSize: 50 });

        expect(result.skip).toBe(200);
        expect(result.limit).toBe(50);
      });
    });

    describe("Spec 5.5.5: Sort and order parsing", () => {
      it("should parse sort field", () => {
        const result = parsePagination({ sort: "createdAt" });

        expect(result.sort).toBe("createdAt");
      });

      it("should parse order as asc", () => {
        const result = parsePagination({ order: "asc" });

        expect(result.order).toBe("asc");
      });

      it("should parse order as desc", () => {
        const result = parsePagination({ order: "desc" });

        expect(result.order).toBe("desc");
      });

      it("should handle case-insensitive order", () => {
        const result1 = parsePagination({ order: "ASC" });
        const result2 = parsePagination({ order: "DESC" });

        expect(result1.order).toBe("asc");
        expect(result2.order).toBe("desc");
      });

      it("should ignore invalid order values", () => {
        const result = parsePagination({ order: "invalid" });

        expect(result.order).toBeUndefined();
      });

      it("should ignore non-string sort values", () => {
        const result = parsePagination({ sort: 123 });

        expect(result.sort).toBeUndefined();
      });
    });
  });

  describe("buildPaginationMeta()", () => {
    describe("Spec 5.5.6: Meta calculation", () => {
      it("should calculate totalPages correctly", () => {
        const meta = buildPaginationMeta(100, 1, 20);

        expect(meta.total).toBe(100);
        expect(meta.totalPages).toBe(5);
        expect(meta.page).toBe(1);
        expect(meta.pageSize).toBe(20);
      });

      it("should handle partial last page", () => {
        const meta = buildPaginationMeta(95, 1, 20);

        expect(meta.totalPages).toBe(5);
      });

      it("should handle exact division", () => {
        const meta = buildPaginationMeta(100, 1, 25);

        expect(meta.totalPages).toBe(4);
      });

      it("should return at least 1 page even for 0 items", () => {
        const meta = buildPaginationMeta(0, 1, 20);

        expect(meta.totalPages).toBe(1);
      });
    });
  });

  describe("pagedResponse()", () => {
    let mockResponse: Partial<Response>;

    beforeEach(() => {
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    describe("Spec 5.5.7: Uniform response shape", () => {
      it("should return standardized paged response", () => {
        const items = [{ id: 1 }, { id: 2 }];
        pagedResponse(mockResponse as Response, items, 100, 1, 20, "Success");

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          message: "Success",
          data: items,
          meta: {
            total: 100,
            totalPages: 5,
            page: 1,
            pageSize: 20,
          },
        });
      });

      it("should use default message", () => {
        pagedResponse(mockResponse as Response, [], 0, 1, 20);

        const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
        expect(jsonCall.message).toBe("Success");
      });
    });
  });

  describe("Spec: No unbounded datasets", () => {
    it("should never allow pageSize over maxPageSize", () => {
      const extremeCases = [
        { pageSize: Number.MAX_SAFE_INTEGER, maxPageSize: 200 },
        { pageSize: 999999, maxPageSize: 100 },
        { pageSize: 1000, maxPageSize: 50 },
      ];

      extremeCases.forEach(({ pageSize, maxPageSize }) => {
        const result = parsePagination({ pageSize }, { maxPageSize });
        expect(result.pageSize).toBeLessThanOrEqual(maxPageSize);
        expect(result.limit).toBeLessThanOrEqual(maxPageSize);
      });
    });

    it("should enforce default maxPageSize of 200", () => {
      const result = parsePagination({ pageSize: 10000 });

      expect(result.pageSize).toBe(200);
      expect(result.limit).toBe(200);
    });
  });
});
