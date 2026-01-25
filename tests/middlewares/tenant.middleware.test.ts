import { Request, Response, NextFunction } from "express";

import {
  requireTenant,
  enforceTenantOnBody,
  assertTenantMatch,
} from "../../src/middlewares/tenant.middleware";
import { UserClaims } from "../../src/types/user";
import { ErrorCode } from "../../src/types/api";

describe("Tenant Isolation Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  describe("requireTenant", () => {
    describe("Spec 5.3.1: No user → 401", () => {
      it("should call next with 401 when user is not present", () => {
        requireTenant(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 401,
            code: ErrorCode.UNAUTHORIZED,
            message: "Tenant context required",
          }),
        );
      });
    });

    describe("Spec 5.3.2: No tenantId in user → 401", () => {
      it("should call next with 401 when user lacks tenantId", () => {
        mockRequest.user = {
          userId: "user-123",
        } as UserClaims;

        requireTenant(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 401,
            message: "Tenant context required",
          }),
        );
      });
    });

    describe("Spec 5.3.3: Valid tenant → attach to req.tenantId", () => {
      it("should attach tenantId to request and call next", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };

        requireTenant(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.tenantId).toBe("tenant-456");
        expect(nextFunction).toHaveBeenCalledWith();
        const call = (nextFunction as jest.Mock).mock.calls[0];
        expect(call[0]).toBeUndefined();
      });
    });
  });

  describe("enforceTenantOnBody()", () => {
    describe("Spec 5.3.4: Cross-tenant body → 403", () => {
      it("should call next with 403 when body tenantId differs from user tenantId", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.body = {
          name: "Test Project",
          tenantId: "tenant-999",
        };

        const middleware = enforceTenantOnBody("tenantId");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 403,
            code: ErrorCode.FORBIDDEN,
            message: "Tenant mismatch",
          }),
        );
      });

      it("should prevent cross-tenant manipulation attempts", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-A",
        };
        mockRequest.body = {
          userId: "user-999",
          tenantId: "tenant-B",
        };

        const middleware = enforceTenantOnBody("tenantId");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 403,
          }),
        );
        expect(mockRequest.body.tenantId).toBe("tenant-B");
      });
    });

    describe("Spec 5.3.5: No tenant in body → force-set from token", () => {
      it("should set tenantId from user when body lacks it", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.body = {
          name: "Test Project",
        };

        const middleware = enforceTenantOnBody("tenantId");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.body.tenantId).toBe("tenant-456");
        expect(nextFunction).toHaveBeenCalledWith();
        const call = (nextFunction as jest.Mock).mock.calls[0];
        expect(call[0]).toBeUndefined();
      });

      it("should overwrite undefined tenantId in body", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.body = {
          name: "Test Project",
          tenantId: undefined,
        };

        const middleware = enforceTenantOnBody("tenantId");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.body.tenantId).toBe("tenant-456");
        expect(nextFunction).toHaveBeenCalledWith();
      });
    });

    describe("Spec 5.3.6: Matching tenant → pass through", () => {
      it("should allow request when body tenantId matches user tenantId", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.body = {
          name: "Test Project",
          tenantId: "tenant-456",
        };

        const middleware = enforceTenantOnBody("tenantId");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.body.tenantId).toBe("tenant-456");
        expect(nextFunction).toHaveBeenCalledWith();
      });
    });

    describe("Spec 5.3.7: Custom field name", () => {
      it("should enforce tenant on custom field names", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.body = {
          name: "Test",
          organizationId: "org-999",
        };

        const middleware = enforceTenantOnBody("organizationId");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 403,
          }),
        );
      });

      it("should set custom field name from user tenant", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.body = {
          name: "Test",
        };

        const middleware = enforceTenantOnBody("organizationId");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.body.organizationId).toBe("tenant-456");
        expect(nextFunction).toHaveBeenCalledWith();
      });
    });

    describe("Spec 5.3.8: Empty or null body", () => {
      it("should handle undefined body", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.body = undefined;

        const middleware = enforceTenantOnBody("tenantId");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.body).toBeDefined();
        expect(mockRequest.body.tenantId).toBe("tenant-456");
        expect(nextFunction).toHaveBeenCalledWith();
      });
    });
  });

  describe("assertTenantMatch()", () => {
    describe("Spec 5.3.9: Controller-level tenant assertion", () => {
      it("should throw 403 when target tenantId differs from user tenantId", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };

        expect(() => {
          assertTenantMatch(mockRequest as Request, "tenant-999");
        }).toThrow(
          expect.objectContaining({
            status: 403,
            message: "Tenant mismatch",
          }),
        );
      });

      it("should not throw when tenants match", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };

        expect(() => {
          assertTenantMatch(mockRequest as Request, "tenant-456");
        }).not.toThrow();
      });

      it("should use req.tenantId when targetTenantId is not provided", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.tenantId = "tenant-456";

        expect(() => {
          assertTenantMatch(mockRequest as Request);
        }).not.toThrow();
      });

      it("should throw when req.tenantId differs from user.tenantId", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        mockRequest.tenantId = "tenant-999";

        expect(() => {
          assertTenantMatch(mockRequest as Request, mockRequest.tenantId);
        }).toThrow(
          expect.objectContaining({
            status: 403,
          }),
        );
      });
    });

    describe("Spec 5.3.10: No user → 401", () => {
      it("should throw 401 when user is not present", () => {
        expect(() => {
          assertTenantMatch(mockRequest as Request, "tenant-456");
        }).toThrow(
          expect.objectContaining({
            status: 401,
          }),
        );
      });

      it("should throw 401 when user lacks tenantId", () => {
        mockRequest.user = {
          userId: "user-123",
        } as UserClaims;

        expect(() => {
          assertTenantMatch(mockRequest as Request, "tenant-456");
        }).toThrow(
          expect.objectContaining({
            status: 401,
          }),
        );
      });
    });
  });

  describe("Spec: Cross-tenant access impossible by default", () => {
    it("should prevent any cross-tenant operation through the chain", () => {
      mockRequest.user = {
        userId: "user-123",
        tenantId: "tenant-A",
      };
      mockRequest.body = {
        name: "Malicious Project",
        tenantId: "tenant-B",
      };
      const next1 = jest.fn();
      requireTenant(mockRequest as Request, mockResponse as Response, next1);
      expect(mockRequest.tenantId).toBe("tenant-A");
      const next2 = jest.fn();
      const middleware = enforceTenantOnBody("tenantId");
      middleware(mockRequest as Request, mockResponse as Response, next2);

      expect(next2).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 403,
          message: "Tenant mismatch",
        }),
      );
    });
  });
});
