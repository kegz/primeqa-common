import helmet from "helmet";

export const secureHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: true,
  referrerPolicy: { policy: "no-referrer" },
});
