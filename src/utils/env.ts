import dotenv from "dotenv";
dotenv.config();

export const getEnv = (
  key: string,
  fallback?: string,
  isSensitive = false,
): string => {
  const value = process.env[key];
  if (!value && fallback === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  if (!isSensitive) {
    console.log(`Loaded env: ${key}`);
  }

  return value ?? fallback!;
};
