import { Request } from "express";

import {
  httpClient,
  createHttpClient,
  httpRequest,
} from "../../src/http/client";
import { ErrorCode } from "../../src/types/api";
global.fetch = jest.fn();

describe("HTTP Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe("httpRequest()", () => {
    describe("Spec: Successful requests", () => {
      it("should make successful GET request", async () => {
        const mockData = { id: 1, name: "Test" };
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Map([["content-type", "application/json"]]),
          json: async () => mockData,
        });

        const response = await httpRequest(
          "GET",
          "https://api.example.com/data",
        );

        expect(response.data).toEqual(mockData);
        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it("should make successful POST request with body", async () => {
        const mockData = { id: 1 };
        const requestBody = { name: "Test" };

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 201,
          headers: new Map([["content-type", "application/json"]]),
          json: async () => mockData,
        });

        const response = await httpRequest(
          "POST",
          "https://api.example.com/data",
          {
            body: requestBody,
          },
        );

        expect(response.data).toEqual(mockData);
        expect(response.status).toBe(201);
        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.example.com/data",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(requestBody),
          }),
        );
      });
    });

    describe("Spec: Header propagation", () => {
      it("should propagate Authorization header from request", async () => {
        const mockReq = {
          headers: {
            authorization: "Bearer test-token-123",
          },
        } as Request;

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({}),
        });

        await httpRequest("GET", "https://api.example.com/data", {
          req: mockReq,
        });

        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.example.com/data",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer test-token-123",
            }),
          }),
        );
      });

      it("should propagate X-Correlation-Id from request", async () => {
        const mockReq = {
          correlationId: "correlation-123",
          headers: {},
        } as Request;

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({}),
        });

        await httpRequest("GET", "https://api.example.com/data", {
          req: mockReq,
        });

        expect(global.fetch).toHaveBeenCalledWith(
          "https://api.example.com/data",
          expect.objectContaining({
            headers: expect.objectContaining({
              "X-Correlation-Id": "correlation-123",
            }),
          }),
        );
      });

      it("should allow disabling auth propagation", async () => {
        const mockReq = {
          headers: {
            authorization: "Bearer test-token",
          },
        } as Request;

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({}),
        });

        await httpRequest("GET", "https://api.example.com/data", {
          req: mockReq,
          propagateAuth: false,
        });

        const callHeaders = (global.fetch as jest.Mock).mock.calls[0][1]
          .headers;
        expect(callHeaders.Authorization).toBeUndefined();
      });
    });

    describe("Spec: 503 mapping for failures", () => {
      it("should map 5xx responses to 503", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({ error: "Server error" }),
        });

        await expect(
          httpRequest("GET", "https://api.example.com/data"),
        ).rejects.toThrow(
          expect.objectContaining({
            status: 503,
            code: ErrorCode.INTERNAL_ERROR,
            message: expect.stringContaining("Dependency service failed"),
          }),
        );
      });

      it("should map network errors to 503", async () => {
        const networkError = new Error("Network error");
        (networkError as any).code = "ECONNREFUSED";
        (global.fetch as jest.Mock).mockRejectedValue(networkError);

        await expect(
          httpRequest("GET", "https://api.example.com/data"),
        ).rejects.toThrow(
          expect.objectContaining({
            status: 503,
            code: ErrorCode.INTERNAL_ERROR,
          }),
        );
      });

      it("should map timeout to 503", async () => {
        const timeoutError = new Error("Timeout");
        (timeoutError as any).name = "AbortError";
        (global.fetch as jest.Mock).mockRejectedValue(timeoutError);

        await expect(
          httpRequest("GET", "https://api.example.com/data", { timeout: 100 }),
        ).rejects.toThrow(
          expect.objectContaining({
            status: 503,
          }),
        );
      });
    });

    describe("Spec: Retry logic for GET", () => {
      it("should retry GET requests on 5xx errors", async () => {
        (global.fetch as jest.Mock)
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            headers: new Map([["content-type", "application/json"]]),
            json: async () => ({}),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: new Map([["content-type", "application/json"]]),
            json: async () => ({ success: true }),
          });

        const response = await httpRequest(
          "GET",
          "https://api.example.com/data",
          {
            retries: 2,
            retryDelay: 10,
          },
        );

        expect(response.data).toEqual({ success: true });
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it("should NOT retry POST requests", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({}),
        });

        await expect(
          httpRequest("POST", "https://api.example.com/data", {
            body: {},
            retries: 2,
          }),
        ).rejects.toThrow();

        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it("should exhaust retries and throw 503", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({}),
        });

        await expect(
          httpRequest("GET", "https://api.example.com/data", {
            retries: 2,
            retryDelay: 10,
          }),
        ).rejects.toThrow(
          expect.objectContaining({
            status: 503,
          }),
        );

        expect(global.fetch).toHaveBeenCalledTimes(3);
      });
    });

    describe("Spec: Timeout handling", () => {
      it("should timeout long requests", async () => {
        (global.fetch as jest.Mock).mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ ok: true }), 5000);
            }),
        );

        await expect(
          httpRequest("GET", "https://api.example.com/data", { timeout: 100 }),
        ).rejects.toThrow();
      }, 10000);
    });

    describe("Spec: 4xx errors not retried", () => {
      it("should not retry on 4xx errors", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
          headers: new Map([["content-type", "application/json"]]),
          json: async () => ({ error: "Not found" }),
        });

        await expect(
          httpRequest("GET", "https://api.example.com/data", { retries: 2 }),
        ).rejects.toThrow();

        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("httpClient convenience methods", () => {
    it("should provide get() method", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ data: "test" }),
      });

      const response = await httpClient.get("https://api.example.com/data");

      expect(response.data).toEqual({ data: "test" });
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should provide post() method", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({ id: 1 }),
      });

      await httpClient.post("https://api.example.com/data", { name: "Test" });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Test" }),
        }),
      );
    });
  });

  describe("createHttpClient()", () => {
    it("should create client with baseUrl", async () => {
      const client = createHttpClient({ baseUrl: "https://api.example.com" });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({}),
      });

      await client.get("/users/123");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/users/123",
        expect.anything(),
      );
    });

    it("should merge default options", async () => {
      const client = createHttpClient({
        baseUrl: "https://api.example.com",
        timeout: 5000,
        headers: { "X-API-Key": "test-key" },
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: async () => ({}),
      });

      await client.get("/data");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": "test-key",
          }),
        }),
      );
    });
  });
});
