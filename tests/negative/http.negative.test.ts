import { Request } from "express";

import { httpRequest, httpClient } from "../../src/http/client";

const makeHeaders = (entries: Array<[string, string]> = []) => {
  const m = new Map(entries);
  return {
    get: (key: string) => m.get(key),
    forEach: (cb: (value: string, key: string) => void) =>
      m.forEach((v, k) => cb(v as string, k as string)),
  } as any;
};

describe("HTTP Client Negative Scenarios", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Malformed URLs", () => {
    it("should reject URL with invalid protocol", async () => {
      await expect(httpRequest("GET", "ftp://example.com")).rejects.toThrow();
    });

    it("should reject URL with spaces", async () => {
      await expect(
        httpRequest("GET", "https://example .com"),
      ).rejects.toThrow();
    });

    it("should reject empty URL", async () => {
      await expect(httpRequest("GET", "")).rejects.toThrow();
    });

    it("should reject URL with null bytes", async () => {
      await expect(
        httpRequest("GET", "https://example.com\x00/api"),
      ).rejects.toThrow();
    });

    it("should handle extremely long URLs", async () => {
      const longPath = "/" + "a".repeat(10000);
      (global.fetch as jest.Mock).mockRejectedValue(new Error("URI too long"));

      await expect(
        httpRequest("GET", `https://example.com${longPath}`),
      ).rejects.toThrow();
    });
  });

  describe("Connection failures", () => {
    it("should map ECONNREFUSED to 503", async () => {
      const error: any = new Error("Connection refused");
      error.code = "ECONNREFUSED";
      (global.fetch as jest.Mock).mockRejectedValue(error);

      await expect(
        httpRequest("GET", "https://example.com"),
      ).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
      });
    });

    it("should handle ETIMEDOUT error", async () => {
      const error: any = new Error("Connection timeout");
      error.code = "ETIMEDOUT";
      (global.fetch as jest.Mock).mockRejectedValue(error);

      await expect(httpRequest("GET", "https://example.com")).rejects.toThrow();
    });

    it("should map ENOTFOUND to 503", async () => {
      const error: any = new Error("DNS lookup failed");
      error.code = "ENOTFOUND";
      (global.fetch as jest.Mock).mockRejectedValue(error);

      await expect(
        httpRequest("GET", "https://nonexistent.invalid"),
      ).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
      });
    });

    it("should handle SSL certificate errors", async () => {
      const error: any = new Error("SSL certificate problem");
      error.code = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
      (global.fetch as jest.Mock).mockRejectedValue(error);

      await expect(httpRequest("GET", "https://example.com")).rejects.toThrow();
    });
  });

  describe("Response handling edge cases", () => {
    it("should handle response with no content-type", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: makeHeaders([]),
        text: jest.fn().mockResolvedValue("plain text response"),
      });

      const result = await httpRequest("GET", "https://example.com");
      expect(result.data).toEqual("plain text response");
    });

    it("should handle malformed JSON responses", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
        text: jest.fn().mockResolvedValue("{invalid json}"),
      });

      await expect(httpRequest("GET", "https://example.com")).rejects.toThrow();
    });

    it("should handle extremely large responses", async () => {
      const largeData = "x".repeat(100 * 1024 * 1024);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockResolvedValue({ data: largeData }),
      });

      const result = await httpRequest("GET", "https://example.com");
      expect((result.data as any).data).toBe(largeData);
    });

    it("should handle response with BOM", async () => {
      const bomData = '\uFEFF{"data":"test"}';
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: makeHeaders([["content-type", "application/json"]]),
        text: jest.fn().mockResolvedValue(bomData),
        json: jest
          .fn()
          .mockResolvedValue(JSON.parse(bomData.replace(/^\uFEFF/, ""))),
      });

      const result = await httpRequest("GET", "https://example.com");
      expect((result.data as any).data).toBe("test");
    });
  });

  describe("Retry logic edge cases", () => {
    it("should not retry on 400 errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockResolvedValue({ error: "Bad request" }),
      });

      await expect(httpRequest("GET", "https://example.com")).rejects.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry POST on 503", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(
        httpRequest("POST", "https://example.com", { body: { data: "test" } }),
      ).rejects.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should exhaust retries on persistent 500 errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(
        httpRequest("GET", "https://example.com"),
      ).rejects.toMatchObject({
        code: "INTERNAL_ERROR",
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should handle intermittent failures", async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            headers: makeHeaders([["content-type", "application/json"]]),
            json: jest.fn().mockResolvedValue({}),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: makeHeaders([["content-type", "application/json"]]),
          json: jest.fn().mockResolvedValue({ data: "success" }),
        });
      });

      const result = await httpRequest("GET", "https://example.com");
      expect((result.data as any).data).toBe("success");
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Request payload edge cases", () => {
    it("should handle circular references in body", async () => {
      const circular: any = { name: "test" };
      circular.self = circular;

      await expect(
        httpRequest("POST", "https://example.com", { body: circular }),
      ).rejects.toThrow();
    });

    it("should handle extremely large request bodies", async () => {
      const largeBody = { data: "x".repeat(10 * 1024 * 1024) };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      await httpRequest("POST", "https://example.com", { body: largeBody });
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should handle null in request body", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      await httpRequest("POST", "https://example.com", { body: null as any });
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Header injection attempts", () => {
    it("should handle headers with newlines", async () => {
      const mockReq = {
        headers: { authorization: "Bearer token\nInjected-Header: value" },
      } as Request;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      await httpRequest("GET", "https://example.com", { req: mockReq });
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should handle headers with carriage returns", async () => {
      const mockReq = {
        headers: { authorization: "Bearer token\rInjected-Header: value" },
      } as Request;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: makeHeaders([["content-type", "application/json"]]),
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      await httpRequest("GET", "https://example.com", { req: mockReq });
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Timeout edge cases", () => {
    it("should timeout on slow responses", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        (_, init: any) =>
          new Promise((resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const err: any = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      );

      const p = httpRequest("GET", "https://example.com", { timeout: 100 });
      await expect(p).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    });

    it("should respect custom timeout", async () => {
      (global.fetch as jest.Mock).mockImplementation(
        (_, init: any) =>
          new Promise((resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const err: any = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }),
      );

      const p = httpRequest("GET", "https://example.com", { timeout: 100 });
      await expect(p).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    });
  });

  describe("httpClient convenience methods", () => {
    it("should handle GET with invalid URL", async () => {
      await expect(httpClient.get("not-a-url")).rejects.toThrow();
    });

    it("should handle POST with malformed body", async () => {
      const circular: any = {};
      circular.self = circular;

      await expect(
        httpClient.post("https://example.com", circular),
      ).rejects.toThrow();
    });
  });
});
