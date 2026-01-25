import { Request } from "express";

import { getUserContext } from "../../src/utils/user";
import { UserClaims } from "../../src/types/user";

describe("User Context Utilities", () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRequest = {};
  });

  describe("getUserContext()", () => {
    describe("Spec 5.1: Extract user context safely", () => {
      it("should return user context when authenticated", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
          role: "admin",
          roleId: "role-789",
          permissions: ["users.read", "users.write"],
          email: "test@example.com",
        };

        const context = getUserContext(mockRequest as Request);

        expect(context).toEqual({
          userId: "user-123",
          tenantId: "tenant-456",
          role: "admin",
          roleId: "role-789",
          permissions: ["users.read", "users.write"],
          email: "test@example.com",
        });
      });

      it("should return minimal context", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };

        const context = getUserContext(mockRequest as Request);

        expect(context.userId).toBe("user-123");
        expect(context.tenantId).toBe("tenant-456");
        expect(context.role).toBeUndefined();
        expect(context.permissions).toBeUndefined();
      });
    });

    describe("Spec 5.1: Throw 401 if missing", () => {
      it("should throw 401 when user is not present", () => {
        expect(() => {
          getUserContext(mockRequest as Request);
        }).toThrow(
          expect.objectContaining({
            message: "Unauthorized",
            status: 401,
          }),
        );
      });

      it("should throw 401 when userId is missing", () => {
        mockRequest.user = {
          tenantId: "tenant-456",
        } as UserClaims;

        expect(() => {
          getUserContext(mockRequest as Request);
        }).toThrow(
          expect.objectContaining({
            status: 401,
          }),
        );
      });

      it("should throw 401 when tenantId is missing", () => {
        mockRequest.user = {
          userId: "user-123",
        } as UserClaims;

        expect(() => {
          getUserContext(mockRequest as Request);
        }).toThrow(
          expect.objectContaining({
            status: 401,
          }),
        );
      });
    });

    describe("Spec: Safe extraction for controller use", () => {
      it("should be usable in controller logic", () => {
        mockRequest.user = {
          userId: "user-123",
          tenantId: "tenant-456",
        };
        const { userId, tenantId } = getUserContext(mockRequest as Request);

        expect(userId).toBe("user-123");
        expect(tenantId).toBe("tenant-456");
      });
    });
  });
});
