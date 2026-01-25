import morgan from "morgan";

import { sanitize } from "../utils/sanitize";

morgan.token("correlationId", (req) => {
  const anyReq = req as unknown as {
    correlationId?: unknown;
    headers?: Record<string, unknown>;
  };
  const cid = anyReq.correlationId ?? anyReq.headers?.["x-correlation-id"];
  return typeof cid === "string" ? cid : "-";
});

export const logger = morgan(
  ":method :url :status :res[content-length] - :response-time ms - cid=:correlationId",
  {
    stream: {
      write: (rawMessage) => {
        const cleanMessage = rawMessage.replace(/(\r\n|\n|\r)/gm, "").trim();
        console.log("[HTTP]", sanitize({ message: cleanMessage }));
      },
    },
  },
);
