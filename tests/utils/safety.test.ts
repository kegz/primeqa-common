import { registerGlobalErrorHandlers } from "../../src/utils/safety";

describe("Safety Utilities", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let processOnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    processExitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    processOnSpy = jest.spyOn(process, "on").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  describe("registerGlobalErrorHandlers()", () => {
    it("should register uncaughtException handler", () => {
      registerGlobalErrorHandlers();

      expect(processOnSpy).toHaveBeenCalledWith(
        "uncaughtException",
        expect.any(Function),
      );
    });

    it("should register unhandledRejection handler", () => {
      registerGlobalErrorHandlers();

      expect(processOnSpy).toHaveBeenCalledWith(
        "unhandledRejection",
        expect.any(Function),
      );
    });

    it("should log and exit on uncaughtException", () => {
      registerGlobalErrorHandlers();

      const handler = processOnSpy.mock.calls.find(
        (call) => call[0] === "uncaughtException",
      )?.[1];
      const testError = new Error("Test error");

      handler(testError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Fatal] Uncaught Exception:",
        testError,
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should log unhandledRejection", () => {
      registerGlobalErrorHandlers();

      const handler = processOnSpy.mock.calls.find(
        (call) => call[0] === "unhandledRejection",
      )?.[1];
      const reason = "Promise rejection";

      handler(reason);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Fatal] Unhandled Rejection:",
        reason,
      );
    });
  });
});
