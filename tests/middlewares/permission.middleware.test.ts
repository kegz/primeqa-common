import { Request, Response, NextFunction } from "express";

import {
  requirePermission,
  requireAnyPermission,
} from "../../src/middlewares/permission.middleware";
import { ErrorCode } from "../../src/types/api";

describe("Permission Middleware", () => {
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

  describe("requirePermission()", () => {
    describe("Spec 5.2.1: No user → 401", () => {
      it("should call next with 401 error when user is not authenticated", () => {
        const middleware = requirePermission("users.read");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 401,
            code: ErrorCode.UNAUTHORIZED,
          }),
        );
      });
    });

    describe("Spec 5.2.2: Missing permission → 403", () => {
      it("should call next with 403 when user lacks required permission", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: ["users.read"],
        };

        const middleware = requirePermission("users.write");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 403,
            code: ErrorCode.FORBIDDEN,
            message: "Forbidden",
          }),
        );
      });

      it("should call next with 403 when user has no permissions array", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };

        const middleware = requirePermission("users.read");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 403,
            code: ErrorCode.FORBIDDEN,
          }),
        );
      });

      it("should call next with 403 when permissions array is empty", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: [],
        };

        const middleware = requirePermission("users.read");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 403,
            code: ErrorCode.FORBIDDEN,
          }),
        );
      });
    });

    describe("Spec 5.2.3: Has permission → pass through", () => {
      it("should call next() without error when user has permission", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: ["users.read", "users.write"],
        };

        const middleware = requirePermission("users.read");
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith();
        expect(nextFunction).toHaveBeenCalledTimes(1);
        const call = (nextFunction as jest.Mock).mock.calls[0];
        expect(call[0]).toBeUndefined();
      });

      it("should be case-sensitive for permission matching", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: ["Users.Read"],
        };

        const middleware = requirePermission("users.read");
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
    });

    describe("Spec 5.2.4: Service-agnostic permission strings", () => {
      it("should work with various permission formats", () => {
        const testCases = [
          "users.read",
          "projects.create",
          "results.delete",
          "config.admin",
          "test-cases.execute",
        ];

        testCases.forEach((permission) => {
          mockRequest.user = {
            userId: "user-123",
            tenantId: "tenant-456",
            permissions: [permission],
          };

          const middleware = requirePermission(permission);
          const next = jest.fn();
          middleware(mockRequest as Request, mockResponse as Response, next);

          expect(next).toHaveBeenCalledWith();
        });
      });
    });
  });

  describe("requireAnyPermission()", () => {
    describe("Spec 5.2.5: No user → 401", () => {
      it("should call next with 401 error when user is not authenticated", () => {
        const middleware = requireAnyPermission(["users.read", "users.write"]);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 401,
            code: ErrorCode.UNAUTHORIZED,
          }),
        );
      });
    });

    describe("Spec 5.2.6: Has any permission → pass through", () => {
      it("should pass when user has at least one of the required permissions", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: ["users.write", "projects.read"],
        };

        const middleware = requireAnyPermission(["users.read", "users.write"]);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith();
        const call = (nextFunction as jest.Mock).mock.calls[0];
        expect(call[0]).toBeUndefined();
      });

      it("should pass when user has all required permissions", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: ["users.read", "users.write", "users.delete"],
        };

        const middleware = requireAnyPermission(["users.read", "users.write"]);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith();
      });
    });

    describe("Spec 5.2.7: No matching permission → 403", () => {
      it("should call next with 403 when user has none of the required permissions", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: ["projects.read"],
        };

        const middleware = requireAnyPermission(["users.read", "users.write"]);
        middleware(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 403,
            code: ErrorCode.FORBIDDEN,
          }),
        );
      });

      it("should handle empty permissions array", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: [],
        };

        const middleware = requireAnyPermission(["users.read", "users.write"]);
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
    });

    describe("Spec 5.2.8: Empty permission list → 403", () => {
      it("should call next with 403 when permission list is empty", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          permissions: ["users.read"],
        };

        const middleware = requireAnyPermission([]);
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
    });
  });

  describe("Spec: Authorization is declarative", () => {
    it("should allow chaining multiple permission checks", () => {
      mockRequest.user = {
        userId: "user-123",
        tenantId: "tenant-456",
        permissions: ["users.read", "users.write"],
      };

      const middleware1 = requirePermission("users.read");
      const middleware2 = requirePermission("users.write");

      const next1 = jest.fn();
      const next2 = jest.fn();

      middleware1(mockRequest as Request, mockResponse as Response, next1);
      middleware2(mockRequest as Request, mockResponse as Response, next2);

      expect(next1).toHaveBeenCalledWith();
      expect(next2).toHaveBeenCalledWith();
    });
  });
});
