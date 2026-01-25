import { Request, Response, NextFunction } from "express";

import {
  requireTenant,
  enforceTenantOnBody,
  assertTenantMatch,
} from "../../src/middlewares/tenant.middleware";
import { AppError } from "../../src/errors/AppError";

describe("Tenant Isolation Negative Scenarios", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {} as Partial<Response>;
    nextFunction = jest.fn();
  });

  describe("Tenant ID injection attempts", () => {
    it("should detect SQL injection in tenantId", () => {
      mockReq.user = { userId: "123", tenantId: "' OR '1'='1" };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.tenantId).toBe("' OR '1'='1");
    });

    it("should detect NoSQL injection in tenantId", () => {
      mockReq.user = { userId: "123", tenantId: '{"$ne": null}' };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.tenantId).toBe('{"$ne": null}');
    });

    it("should handle tenantId with special characters", () => {
      mockReq.user = { userId: "123", tenantId: "../../../etc/passwd" };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.tenantId).toBe("../../../etc/passwd");
    });

    it("should handle extremely long tenantId", () => {
      mockReq.user = { userId: "123", tenantId: "a".repeat(100000) };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockReq.tenantId).toBe("a".repeat(100000));
    });

    it("should handle tenantId with null bytes", () => {
      mockReq.user = { userId: "123", tenantId: "tenant\x00admin" };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle tenantId with unicode confusables", () => {
      mockReq.user = { userId: "123", tenantId: "tenаnt1" };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("Cross-tenant manipulation attempts", () => {
    it("should prevent array-based tenant bypass", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = { tenantId: ["tenant1", "tenant2"], data: "test" };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should prevent object-based tenant bypass", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = { tenantId: { $ne: "tenant1" }, data: "test" };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should prevent boolean tenant bypass", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = { tenantId: true, data: "test" };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should prevent number tenant bypass", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = { tenantId: 12345, data: "test" };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should detect case-sensitivity bypass attempts", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = { tenantId: "TENANT1", data: "test" };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should detect whitespace padding bypass", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = { tenantId: "  tenant1  ", data: "test" };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe("Nested tenant manipulation", () => {
    it("should not check nested tenant fields by default", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = {
        data: {
          nested: {
            tenantId: "tenant2",
          },
        },
      };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should enforce custom field at top level only", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = {
        organizationId: "tenant2",
        nested: {
          organizationId: "tenant3",
        },
      };

      enforceTenantOnBody("organizationId")(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe("assertTenantMatch edge cases", () => {
    it("should throw on type coercion attempts", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.tenantId = "tenant1";

      expect(() => {
        assertTenantMatch(mockReq as Request, 1 as any);
      }).toThrow(AppError);
    });

    it("should not throw on undefined target (uses req.tenantId)", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.tenantId = "tenant1";

      expect(() => {
        assertTenantMatch(mockReq as Request, undefined as any);
      }).not.toThrow();
    });

    it("should not throw on null target (uses req.tenantId)", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.tenantId = "tenant1";

      expect(() => {
        assertTenantMatch(mockReq as Request, null as any);
      }).not.toThrow();
    });

    it("should not throw on empty string target (uses req.tenantId)", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.tenantId = "tenant1";

      expect(() => {
        assertTenantMatch(mockReq as Request, "");
      }).not.toThrow();
    });

    it("should detect object with toString bypass", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };

      const maliciousObject = {
        toString: () => "tenant1",
      };

      expect(() => {
        assertTenantMatch(mockReq as Request, maliciousObject as any);
      }).toThrow(AppError);
    });
  });

  describe("User context manipulation", () => {
    it("should reject user with null tenantId", () => {
      mockReq.user = { userId: "123", tenantId: null as any };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should reject user with undefined tenantId", () => {
      mockReq.user = { userId: "123", tenantId: undefined as any };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should reject user with empty string tenantId", () => {
      mockReq.user = { userId: "123", tenantId: "" };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should reject user with array tenantId", () => {
      mockReq.user = { userId: "123", tenantId: ["tenant1", "tenant2"] as any };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should reject user with object tenantId", () => {
      mockReq.user = { userId: "123", tenantId: { id: "tenant1" } as any };

      requireTenant(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("Body manipulation attacks", () => {
    it("should handle body as array", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = ["not", "an", "object"];

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle body as null", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = null;

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle body with prototype pollution attempt", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = {
        __proto__: { tenantId: "tenant2" },
        tenantId: "tenant2",
        data: "test",
      };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );
      expect(nextFunction).toHaveBeenCalledWith(expect.any(AppError));
    });

    it("should handle body with constructor pollution attempt", () => {
      mockReq.user = { userId: "123", tenantId: "tenant1" };
      mockReq.body = {
        constructor: { prototype: { tenantId: "tenant2" } },
        data: "test",
      };

      enforceTenantOnBody()(
        mockReq as Request,
        mockRes as Response,
        nextFunction,
      );

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });
});
