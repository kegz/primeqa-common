export type SortOrder = "asc" | "desc";

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  limit: number;
  sort?: string;
  order?: SortOrder;
}

const toPositiveInt = (value: unknown, defaultValue: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return defaultValue;
  return Math.floor(num);
};

export const parsePagination = (
  query: Record<string, unknown>,
  defaults: { page?: number; pageSize?: number; maxPageSize?: number } = {},
): PaginationParams => {
  const page = Math.max(1, toPositiveInt(query.page, defaults.page ?? 1));
  const maxPageSize = defaults.maxPageSize ?? 200;
  const pageSizeRaw = toPositiveInt(query.pageSize, defaults.pageSize ?? 50);
  const pageSize = Math.min(pageSizeRaw, maxPageSize);

  const sort = typeof query.sort === "string" ? query.sort : undefined;
  const orderValue =
    typeof query.order === "string" ? query.order.toLowerCase() : undefined;
  const order: SortOrder | undefined =
    orderValue === "desc" ? "desc" : orderValue === "asc" ? "asc" : undefined;

  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  return {
    page,
    pageSize,
    skip,
    limit,
    sort,
    order,
  };
};
