const defaultKeys = [
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "clientsecret",
];

export const maskSecretValue = (value: unknown): string => {
  if (value === null || value === undefined) return "*****";
  if (typeof value === "string") return value.length > 0 ? "*****" : "";
  return "*****";
};

export const maskSecrets = <T>(data: T, keys: string[] = defaultKeys): T => {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskSecrets(item, keys)) as unknown as T;
  }

  if (typeof data === "object") {
    const clone = { ...(data as Record<string, unknown>) };
    for (const [k, v] of Object.entries(clone)) {
      if (keys.includes(k.toLowerCase())) {
        clone[k] = maskSecretValue(v);
      } else {
        clone[k] = maskSecrets(v, keys);
      }
    }
    return clone as T;
  }

  return data;
};
