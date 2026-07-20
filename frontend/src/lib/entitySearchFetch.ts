import { branchApi } from '../api/client';
import type { PaginatedFetchFn, PaginatedResult } from '../hooks/usePaginatedSearch';

type Row = Record<string, unknown>;

function toPaginatedResult<T>(response: {
  data: T[];
  pagination: PaginatedResult<T>['pagination'];
}): PaginatedResult<T> {
  return { data: response.data, pagination: response.pagination };
}

export function createWalkInCustomerFetch(branchId: number | null): PaginatedFetchFn<Row> {
  return async ({ search, page, limit }) => {
    if (!branchId) return { data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } };
    const response = await branchApi.walkInCustomers(branchId, {
      ...(search ? { search } : {}),
      page: String(page),
      limit: String(limit),
    });
    return toPaginatedResult(response as PaginatedResult<Row>);
  };
}

export function createBranchCustomerFetch(branchId: number | null): PaginatedFetchFn<Row> {
  return async ({ search, page, limit }) => {
    if (!branchId) return { data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } };
    const response = await branchApi.branchCustomers(branchId, {
      ...(search ? { search } : {}),
      page: String(page),
      limit: String(limit),
    });
    return toPaginatedResult(response as PaginatedResult<Row>);
  };
}

export function createBranchSupplierFetch(branchId: number | null): PaginatedFetchFn<Row> {
  return async ({ search, page, limit }) => {
    if (!branchId) return { data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } };
    const response = await branchApi.branchSuppliers(branchId, {
      ...(search ? { search } : {}),
      page: String(page),
      limit: String(limit),
    });
    return toPaginatedResult(response as PaginatedResult<Row>);
  };
}

export function createAccountFetch(
  branchId: number | null,
  categoryId?: string,
): PaginatedFetchFn<Row> {
  return async ({ search, page, limit }) => {
    if (!branchId) return { data: [], pagination: { total: 0, page: 1, limit, totalPages: 0 } };
    const response = await branchApi.accountsPaginated(branchId, {
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      page: String(page),
      limit: String(limit),
    });
    return toPaginatedResult(response as PaginatedResult<Row>);
  };
}

export function customerOptionLabel(c: Row): string {
  const parts: string[] = [String(c.name ?? '')];
  if (c.cnic) parts.push(String(c.cnic));
  if (c.fatherName) parts.push(`(S/O ${c.fatherName})`);
  if (parts.length === 1) return parts[0];
  const [name, ...rest] = parts;
  const suffix = rest[0]?.startsWith('(') ? ` ${rest.join(' ')}` : ` — ${rest.join(' ')}`;
  return `${name}${suffix}`;
}

export function supplierOptionLabel(s: Row): string {
  const parts: string[] = [String(s.name ?? '')];
  if (s.phone) parts.push(String(s.phone));
  if (s.contactPerson) parts.push(`(${s.contactPerson})`);
  if (parts.length === 1) return parts[0];
  const [name, ...rest] = parts;
  const suffix = rest[0]?.startsWith('(') ? ` ${rest.join(' ')}` : ` — ${rest.join(' ')}`;
  return `${name}${suffix}`;
}
