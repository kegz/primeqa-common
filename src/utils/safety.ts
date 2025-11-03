export const registerGlobalErrorHandlers = () => {
  process.on("uncaughtException", (err) => {
    console.error("[Fatal] Uncaught Exception:", err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Fatal] Unhandled Rejection:", reason);
  });
};
