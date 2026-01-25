import {
  normalizeValidationDetails,
  ValidationErrorDetail,
} from "../../src/utils/validation";

describe("Validation Utilities", () => {
  describe("normalizeValidationDetails()", () => {
    it("should return the same array", () => {
      const details: ValidationErrorDetail[] = [
        { message: "Required field", path: ["name"] },
        { message: "Invalid format", path: ["email"] },
      ];

      const result = normalizeValidationDetails(details);

      expect(result).toEqual(details);
      expect(result).toBe(details);
    });

    it("should handle empty array", () => {
      const result = normalizeValidationDetails([]);

      expect(result).toEqual([]);
    });

    it("should handle details without path", () => {
      const details: ValidationErrorDetail[] = [{ message: "General error" }];

      const result = normalizeValidationDetails(details);

      expect(result).toEqual(details);
    });
  });
});
