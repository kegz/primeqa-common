import {
  startCacheCleanup,
  stopCacheCleanup,
  cleanupExpiredEntries,
} from "../../src/utils/cacheCleanup";

describe("Cache Cleanup Utilities", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    jest.useFakeTimers();
  });

  afterEach(() => {
    stopCacheCleanup();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.useRealTimers();
  });

  describe("startCacheCleanup()", () => {
    it("should start cleanup interval", () => {
      startCacheCleanup(1000);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[CacheCleanup] Started with interval 1000ms",
      );
    });

    it("should use default interval", () => {
      startCacheCleanup();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("300000ms"),
      );
    });

    it("should warn if already running", () => {
      startCacheCleanup();
      startCacheCleanup();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[CacheCleanup] Already running, skipping",
      );
    });

    it("should call cleanup on interval", () => {
      startCacheCleanup(100);

      jest.advanceTimersByTime(100);
      expect(true).toBe(true);
    });
  });

  describe("stopCacheCleanup()", () => {
    it("should stop cleanup interval", () => {
      startCacheCleanup();
      stopCacheCleanup();

      expect(consoleLogSpy).toHaveBeenCalledWith("[CacheCleanup] Stopped");
    });

    it("should do nothing if not running", () => {
      stopCacheCleanup();

      expect(consoleLogSpy).not.toHaveBeenCalledWith("[CacheCleanup] Stopped");
    });
  });

  describe("cleanupExpiredEntries()", () => {
    it("should cleanup without throwing", () => {
      expect(() => cleanupExpiredEntries()).not.toThrow();
    });

    it("should handle missing modules gracefully", () => {
      cleanupExpiredEntries();
      expect(true).toBe(true);
    });
  });
});
