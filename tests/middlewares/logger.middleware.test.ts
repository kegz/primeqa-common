import { Request, Response, NextFunction } from "express";

import { logger } from "../../src/middlewares/logger.middleware";

describe("Logger Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReq = {
      method: "GET",
      url: "/api/test",
      correlationId: "test-correlation-id",
    } as Partial<Request>;

    mockRes = {
      statusCode: 200,
      getHeader: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === "finish") {
          setTimeout(() => callback(), 0);
        }
        return mockRes as Response;
      }),
    } as Partial<Response>;

    nextFunction = jest.fn();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should be a middleware function", () => {
    expect(typeof logger).toBe("function");
  });

  it("should call next when invoked", (done) => {
    logger(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    done();
  });

  it("should log HTTP requests", (done) => {
    logger(mockReq as Request, mockRes as Response, nextFunction);
    setTimeout(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0];
      expect(logCall[0]).toBe("[HTTP]");
      done();
    }, 100);
  });
});
