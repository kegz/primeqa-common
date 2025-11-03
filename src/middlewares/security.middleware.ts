import helmet from "helmet";

export const secureHeaders = helmet({
  contentSecurityPolicy: false, // disable CSP for dev; enable in prod
  crossOriginEmbedderPolicy: true,
  referrerPolicy: { policy: "no-referrer" },
});
