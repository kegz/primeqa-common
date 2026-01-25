import { sanitize } from "../../src/utils/sanitize";

describe("Sanitize Utility", () => {
  describe("sanitize()", () => {
    it("should mask password fields", () => {
      const obj = { username: "john", password: "secret123" };
      const result = sanitize(obj);

      expect(result.username).toBe("john");
      expect(result.password).toBe("***");
    });

    it("should mask token fields", () => {
      const obj = { id: "123", token: "jwt-token" };
      const result = sanitize(obj);

      expect(result.id).toBe("123");
      expect(result.token).toBe("***");
    });

    it("should mask secret fields", () => {
      const obj = { data: "value", secret: "shhh" };
      const result = sanitize(obj);

      expect(result.data).toBe("value");
      expect(result.secret).toBe("***");
    });

    it("should mask authorization fields", () => {
      const obj = { user: "john", authorization: "Bearer token" };
      const result = sanitize(obj);

      expect(result.user).toBe("john");
      expect(result.authorization).toBe("***");
    });

    it("should be case-insensitive", () => {
      const obj = { Password: "secret", TOKEN: "jwt" };
      const result = sanitize(obj);

      expect(result.Password).toBe("***");
      expect(result.TOKEN).toBe("***");
    });

    it("should not mutate original object", () => {
      const obj = { password: "secret123" };
      const result = sanitize(obj);

      expect(obj.password).toBe("secret123");
      expect(result.password).toBe("***");
    });

    it("should handle empty objects", () => {
      const obj = {};
      const result = sanitize(obj);

      expect(result).toEqual({});
    });

    it("should handle null/undefined", () => {
      expect(sanitize(null as any)).toBe(null);
      expect(sanitize(undefined as any)).toBe(undefined);
    });
  });
});
