import { ApiResponse } from "../types/api";

export const successResponse = <T>(
  data: T,
  message = "Success",
): ApiResponse<T> => ({
  success: true,
  message,
  data,
});

export const errorResponse = (
  message = "Error",
  code = 500,
): ApiResponse<null> => ({
  success: false,
  message,
  code,
});
