import morgan from "morgan";

import { sanitize } from "../utils/sanitize";

export const logger = morgan("dev", {
  stream: {
    write: (rawMessage) => {
      const cleanMessage = rawMessage.replace(/(\r\n|\n|\r)/gm, "").trim();
      // eslint-disable-next-line security-node/detect-crlf
      console.log("[HTTP]", sanitize({ message: cleanMessage }));
    },
  },
});
