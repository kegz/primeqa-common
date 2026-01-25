export interface ValidationErrorDetail {
  message: string;
  path?: Array<string | number>;
}

export const isObjectId = (value: unknown): value is string => {
  return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
};

export const isISODate = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  return isoPattern.test(value) && !Number.isNaN(Date.parse(value));
};

export const isEnumValue = <T extends string | number>(
  value: unknown,
  allowed: readonly T[],
): value is T => {
  return allowed.includes(value as T);
};

export const normalizeValidationDetails = (
  details: ValidationErrorDetail[],
): ValidationErrorDetail[] => details;
