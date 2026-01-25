import { maskSecretValue, maskSecrets } from "../../src/utils/secrets";

describe("Secrets Masking", () => {
  describe("maskSecretValue()", () => {
    describe("Spec: Mask any secret value", () => {
      it("should mask string values", () => {
        expect(maskSecretValue("my-secret-password")).toBe("*****");
        expect(maskSecretValue("token-12345")).toBe("*****");
      });

      it("should mask empty strings", () => {
        expect(maskSecretValue("")).toBe("");
      });

      it("should mask null and undefined", () => {
        expect(maskSecretValue(null)).toBe("*****");
        expect(maskSecretValue(undefined)).toBe("*****");
      });

      it("should mask non-string values", () => {
        expect(maskSecretValue(12345)).toBe("*****");
        expect(maskSecretValue({ key: "value" })).toBe("*****");
        expect(maskSecretValue([1, 2, 3])).toBe("*****");
      });
    });
  });

  describe("maskSecrets()", () => {
    describe("Spec: Recursive object masking", () => {
      it("should mask default secret keys", () => {
        const data = {
          username: "john",
          password: "secret123",
          token: "jwt-token-here",
          apiKey: "api-key-value",
        };

        const masked = maskSecrets(data);

        expect(masked.username).toBe("john");
        expect(masked.password).toBe("*****");
        expect(masked.token).toBe("*****");
        expect(masked.apiKey).toBe("*****");
      });

      it("should be case-insensitive for key matching", () => {
        const data = {
          Password: "secret",
          TOKEN: "jwt",
          ApiKey: "key",
        };

        const masked = maskSecrets(data);

        expect(masked.Password).toBe("*****");
        expect(masked.TOKEN).toBe("*****");
        expect(masked.ApiKey).toBe("*****");
      });

      it("should handle nested objects", () => {
        const data = {
          user: {
            name: "john",
            password: "secret",
            settings: {
              secret: "hidden",
              theme: "dark",
            },
          },
        };

        const masked = maskSecrets(data);

        expect(masked.user.name).toBe("john");
        expect(masked.user.password).toBe("*****");
        expect(masked.user.settings.secret).toBe("*****");
        expect(masked.user.settings.theme).toBe("dark");
      });

      it("should handle arrays", () => {
        const data = [
          { name: "user1", password: "pass1" },
          { name: "user2", password: "pass2" },
        ];

        const masked = maskSecrets(data);

        expect(masked[0].name).toBe("user1");
        expect(masked[0].password).toBe("*****");
        expect(masked[1].name).toBe("user2");
        expect(masked[1].password).toBe("*****");
      });
    });

    describe("Spec: Custom secret keys", () => {
      it("should mask custom keys", () => {
        const data = {
          username: "john",
          customSecret: "hidden",
          privateKey: "key",
        };
        const masked = maskSecrets(data, ["customsecret", "privatekey"]);

        expect(masked.username).toBe("john");
        expect(masked.customSecret).toBe("*****");
        expect(masked.privateKey).toBe("*****");
      });
    });

    describe("Spec: Null/undefined handling", () => {
      it("should handle null input", () => {
        expect(maskSecrets(null)).toBeNull();
      });

      it("should handle undefined input", () => {
        expect(maskSecrets(undefined)).toBeUndefined();
      });

      it("should handle null values in object", () => {
        const data = {
          name: "john",
          password: null,
          token: undefined,
        };

        const masked = maskSecrets(data);

        expect(masked.name).toBe("john");
        expect(masked.password).toBe("*****");
        expect(masked.token).toBe("*****");
      });
    });

    describe("Spec: Primitive values", () => {
      it("should return primitive values as-is", () => {
        expect(maskSecrets("string")).toBe("string");
        expect(maskSecrets(123)).toBe(123);
        expect(maskSecrets(true)).toBe(true);
      });
    });

    describe("Spec: No mutation of original", () => {
      it("should not mutate the original object", () => {
        const original = {
          name: "john",
          password: "secret",
        };

        const masked = maskSecrets(original);

        expect(original.password).toBe("secret");
        expect(masked.password).toBe("*****");
      });
    });

    describe("Spec: Default secret keys coverage", () => {
      it("should mask all common secret field names", () => {
        const data = {
          password: "pass",
          token: "tok",
          secret: "sec",
          authorization: "auth",
          apikey: "key1",
          clientsecret: "client",
        };

        const masked = maskSecrets(data);

        Object.keys(data).forEach((key) => {
          expect(masked[key as keyof typeof masked]).toBe("*****");
        });
      });
    });
  });
});
