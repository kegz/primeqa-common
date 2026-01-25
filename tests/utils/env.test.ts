import { getEnv } from "../../src/utils/env";

describe("Environment Utilities", () => {
  const originalEnv = process.env;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
  });

  describe("getEnv()", () => {
    it("should return environment variable value", () => {
      process.env.TEST_VAR = "test-value";
      const result = getEnv("TEST_VAR");

      expect(result).toBe("test-value");
      expect(consoleLogSpy).toHaveBeenCalledWith("Loaded env: TEST_VAR");
    });

    it("should return fallback when variable not set", () => {
      delete process.env.MISSING_VAR;
      const result = getEnv("MISSING_VAR", "default-value");

      expect(result).toBe("default-value");
    });

    it("should throw when variable missing and no fallback", () => {
      delete process.env.REQUIRED_VAR;

      expect(() => getEnv("REQUIRED_VAR")).toThrow(
        "Missing environment variable: REQUIRED_VAR",
      );
    });

    it("should not log sensitive variables", () => {
      process.env.API_SECRET = "secret123";
      const result = getEnv("API_SECRET", undefined, true);

      expect(result).toBe("secret123");
      expect(consoleLogSpy).not.toHaveBeenCalledWith("Loaded env: API_SECRET");
    });

    it("should return empty string when set to empty", () => {
      process.env.EMPTY_VAR = "";
      const result = getEnv("EMPTY_VAR", "fallback");
      expect(result).toBe("");
    });
  });
});
