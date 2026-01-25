import { Request, Response, NextFunction } from "express";

import { secureHeaders } from "../../src/middlewares/security.middleware";

describe("Security Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockReq = {} as Partial<Request>;
    mockRes = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
    } as Partial<Response>;
    nextFunction = jest.fn();
  });

  it("should be a middleware function", () => {
    expect(typeof secureHeaders).toBe("function");
  });

  it("should call next when invoked", () => {
    secureHeaders(mockReq as Request, mockRes as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
  });

  it("should set security headers", () => {
    secureHeaders(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockRes.setHeader).toHaveBeenCalled();
  });
});
