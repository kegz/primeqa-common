export enum ErrorCode {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export interface SuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

export interface ErrorResponse {
  success: false;
  code: ErrorCode;
  message: string;
  traceId?: string;
  details?: unknown;
}

export interface PaginationMeta {
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export interface PagedResponse<T = unknown> extends SuccessResponse<T[]> {
  meta: PaginationMeta;
}

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
