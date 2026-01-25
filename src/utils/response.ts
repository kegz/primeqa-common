import { Response } from "express";

import {
  ApiResponse,
  ErrorCode,
  PagedResponse,
  PaginationMeta,
  SuccessResponse,
} from "../types/api";

export const success = <T>(
  res: Response,
  data: T,
  message = "Success",
): Response<SuccessResponse<T>> => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

export const fail = (
  res: Response,
  status: number,
  message: string,
  code: ErrorCode,
  traceId?: string,
  details?: unknown,
): Response<ApiResponse<null>> => {
  return res.status(status).json({
    success: false,
    code,
    message,
    traceId,
    details,
  });
};

export const buildPaginationMeta = (
  total: number,
  page: number,
  pageSize: number,
): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));
  return {
    total,
    totalPages,
    page,
    pageSize,
  };
};

export const pagedResponse = <T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  message = "Success",
): Response<PagedResponse<T>> => {
  return res.status(200).json({
    success: true,
    message,
    data: items,
    meta: buildPaginationMeta(total, page, pageSize),
  });
};
