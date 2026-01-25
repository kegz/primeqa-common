process.env.JWT_SECRET = "test-secret-key-for-jwt-validation";
process.env.NODE_ENV = "test";
import { stopCacheCleanup } from "../src/utils/cacheCleanup";

afterAll(() => {
  stopCacheCleanup();
});
