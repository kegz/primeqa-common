import {
  API_PREFIX,
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_NUMBER,
} from "../../src/utils/constants";

describe("Constants", () => {
  it("should export API_PREFIX", () => {
    expect(API_PREFIX).toBe("/api/v1");
  });

  it("should export DEFAULT_PAGE_SIZE", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it("should export DEFAULT_PAGE_NUMBER", () => {
    expect(DEFAULT_PAGE_NUMBER).toBe(1);
  });
});
