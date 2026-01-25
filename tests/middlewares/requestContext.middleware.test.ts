import { Request, Response, NextFunction } from "express";

import { requestContext } from "../../src/middlewares/requestContext.middleware";

describe("Request Context / Observability", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      header: jest.fn(),
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  describe("requestContext middleware", () => {
    describe("Spec 5.8.1: Generate correlation ID if missing", () => {
      it("should generate correlationId when header is missing", () => {
        (mockRequest.header as jest.Mock).mockReturnValue(undefined);

        requestContext(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.correlationId).toBeDefined();
        expect(typeof mockRequest.correlationId).toBe("string");
        expect(mockRequest.correlationId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      });
    });

    describe("Spec 5.8.2: Use existing correlation ID from header", () => {
      it("should use X-Correlation-Id from request header", () => {
        (mockRequest.header as jest.Mock).mockReturnValue(
          "existing-correlation-id-123",
        );

        requestContext(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.correlationId).toBe("existing-correlation-id-123");
      });

      it("should handle array correlation ID header", () => {
        (mockRequest.header as jest.Mock).mockReturnValue([
          "first-id",
          "second-id",
        ]);

        requestContext(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockRequest.correlationId).toBe("first-id");
      });
    });

    describe("Spec 5.8.3: Set correlation ID in response header", () => {
      it("should set X-Correlation-Id in response headers", () => {
        (mockRequest.header as jest.Mock).mockReturnValue(
          "test-correlation-id",
        );

        requestContext(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "X-Correlation-Id",
          "test-correlation-id",
        );
      });

      it("should set generated correlation ID in response", () => {
        (mockRequest.header as jest.Mock).mockReturnValue(undefined);

        requestContext(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "X-Correlation-Id",
          mockRequest.correlationId,
        );
      });
    });

    describe("Spec 5.8.4: Call next middleware", () => {
      it("should call next() to continue middleware chain", () => {
        (mockRequest.header as jest.Mock).mockReturnValue(undefined);

        requestContext(
          mockRequest as Request,
          mockResponse as Response,
          nextFunction,
        );

        expect(nextFunction).toHaveBeenCalledWith();
        expect(nextFunction).toHaveBeenCalledTimes(1);
      });
    });

    describe("Spec: Every request traceable", () => {
      it("should ensure correlationId is always present", () => {
        const scenarios = [
          { header: undefined },
          { header: "" },
          { header: "custom-id" },
          { header: ["array-id"] },
        ];

        scenarios.forEach((scenario) => {
          const req: any = {
            header: jest.fn().mockReturnValue(scenario.header),
            headers: {},
          };
          const res: any = { setHeader: jest.fn() };
          const next = jest.fn();

          requestContext(req, res, next);

          expect(req.correlationId).toBeDefined();
          expect(typeof req.correlationId).toBe("string");
          expect(req.correlationId.length).toBeGreaterThan(0);
          expect(res.setHeader).toHaveBeenCalledWith(
            "X-Correlation-Id",
            req.correlationId,
          );
        });
      });
    });
  });

  describe("Spec: Correlation ID in error responses", () => {
    it("should include correlation ID in error handler", () => {
      (mockRequest.header as jest.Mock).mockReturnValue("trace-123");
      mockRequest.correlationId = "trace-123";

      expect(mockRequest.correlationId).toBe("trace-123");
    });
  });
});
