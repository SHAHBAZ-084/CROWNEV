import { useMemo } from 'react';
import { branchApi } from '../../api/client';
import { parseAccountCode } from '../../lib/dedupeLabel';
import {
  createAccountFetch,
  createBranchCustomerFetch,
  createBranchSupplierFetch,
  createWalkInCustomerFetch,
  customerOptionLabel,
  supplierOptionLabel,
} from '../../lib/entitySearchFetch';
import { AsyncSearchSelect } from './AsyncSearchSelect';
import type { SearchSelectOption } from './SearchSelect';

type Row = Record<string, unknown>;

function isCustomersCategory(name: string) {
  return name.trim().toLowerCase() === 'customers';
}

function isSuppliersCategory(name: string) {
  return name.trim().toLowerCase() === 'suppliers';
}

export function CustomerAsyncSearchSelect({
  branchId,
  value,
  onChange,
  label,
  placeholder = 'Search customer…',
  required,
  disabled,
  useWalkInApi = true,
  size,
}: {
  branchId: number | null;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Sale/service POS forms use walk-in API; accounting contexts use branch customers API */
  useWalkInApi?: boolean;
  size?: 'md' | 'lg';
}) {
  const fetchPage = useMemo(
    () => (useWalkInApi ? createWalkInCustomerFetch(branchId) : createBranchCustomerFetch(branchId)),
    [branchId, useWalkInApi],
  );

  return (
    <AsyncSearchSelect<Row>
      label={label}
      value={value}
      onChange={onChange}
      fetchPage={fetchPage}
      mapOption={(c): SearchSelectOption => ({
        value: String(c.id),
        label: customerOptionLabel(c),
      })}
      resolvePinnedByValue={
        branchId && value
          ? async (id) => branchApi.walkInCustomer(branchId, parseInt(id, 10)) as Promise<Row>
          : undefined
      }
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      enabled={branchId != null}
      size={size}
    />
  );
}

export function SupplierAsyncSearchSelect({
  branchId,
  value,
  onChange,
  label,
  placeholder = 'Search supplier…',
  required,
  disabled,
  size,
}: {
  branchId: number | null;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
}) {
  const fetchPage = useMemo(() => createBranchSupplierFetch(branchId), [branchId]);

  return (
    <AsyncSearchSelect<Row>
      label={label}
      value={value}
      onChange={onChange}
      fetchPage={fetchPage}
      mapOption={(s): SearchSelectOption => ({
        value: String(s.id),
        label: supplierOptionLabel(s),
      })}
      resolvePinnedByValue={
        branchId && value
          ? async (id) => branchApi.branchSupplier(branchId, parseInt(id, 10)) as Promise<Row>
          : undefined
      }
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      enabled={branchId != null}
      size={size}
    />
  );
}

export function AccountAsyncSearchSelect({
  branchId,
  categoryId,
  categoryName,
  accounts,
  value,
  onChange,
  label,
  placeholder = 'Search account…',
  required,
  disabled,
}: {
  branchId: number | null;
  categoryId: string;
  categoryName: string;
  accounts: Row[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const accountByCustomerId = useMemo(() => {
    const map = new Map<number, Row>();
    for (const account of accounts) {
      const parsed = parseAccountCode(String(account.code ?? ''));
      if (parsed?.kind === 'customer') map.set(parsed.id, account);
    }
    return map;
  }, [accounts]);

  const accountBySupplierId = useMemo(() => {
    const map = new Map<number, Row>();
    for (const account of accounts) {
      const parsed = parseAccountCode(String(account.code ?? ''));
      if (parsed?.kind === 'supplier') map.set(parsed.id, account);
    }
    return map;
  }, [accounts]);

  const customerFetch = useMemo(() => createBranchCustomerFetch(branchId), [branchId]);
  const supplierFetch = useMemo(() => createBranchSupplierFetch(branchId), [branchId]);
  const accountFetch = useMemo(
    () => createAccountFetch(branchId, categoryId || undefined),
    [branchId, categoryId],
  );

  if (isCustomersCategory(categoryName)) {
    return (
      <AsyncSearchSelect<Row>
        label={label}
        value={value}
        onChange={onChange}
        fetchPage={customerFetch}
        mapOption={(customer): SearchSelectOption => {
          const account = accountByCustomerId.get(Number(customer.id));
          return {
            value: account ? String(account.id) : '',
            label: customerOptionLabel(customer),
          };
        }}
        getItemKey={(customer) => {
          const account = accountByCustomerId.get(Number(customer.id));
          return account ? String(account.id) : `missing-${String(customer.id)}`;
        }}
        resolvePinnedByValue={
          branchId && value
            ? async (accountId) => {
                const account = accounts.find((a) => String(a.id) === accountId);
                const parsed = parseAccountCode(String(account?.code ?? ''));
                if (!parsed || parsed.kind !== 'customer') return null;
                return branchApi.walkInCustomer(branchId, parsed.id) as Promise<Row>;
              }
            : undefined
        }
        placeholder={placeholder}
        required={required}
        disabled={disabled || !categoryId}
        enabled={branchId != null && !!categoryId}
      />
    );
  }

  if (isSuppliersCategory(categoryName)) {
    return (
      <AsyncSearchSelect<Row>
        label={label}
        value={value}
        onChange={onChange}
        fetchPage={supplierFetch}
        mapOption={(supplier): SearchSelectOption => {
          const account = accountBySupplierId.get(Number(supplier.id));
          return {
            value: account ? String(account.id) : '',
            label: supplierOptionLabel(supplier),
          };
        }}
        getItemKey={(supplier) => {
          const account = accountBySupplierId.get(Number(supplier.id));
          return account ? String(account.id) : `missing-${String(supplier.id)}`;
        }}
        resolvePinnedByValue={
          branchId && value
            ? async (accountId) => {
                const account = accounts.find((a) => String(a.id) === accountId);
                const parsed = parseAccountCode(String(account?.code ?? ''));
                if (!parsed || parsed.kind !== 'supplier' || !branchId) return null;
                return branchApi.branchSupplier(branchId, parsed.id) as Promise<Row>;
              }
            : undefined
        }
        placeholder={placeholder}
        required={required}
        disabled={disabled || !categoryId}
        enabled={branchId != null && !!categoryId}
      />
    );
  }

  return (
    <AsyncSearchSelect<Row>
      label={label}
      value={value}
      onChange={onChange}
      fetchPage={accountFetch}
      mapOption={(account): SearchSelectOption => ({
        value: String(account.id),
        label: String(account.name ?? account.code ?? account.id),
      })}
      resolvePinnedByValue={
        branchId && value
          ? async (accountId) => branchApi.account(branchId, parseInt(accountId, 10)) as Promise<Row>
          : undefined
      }
      placeholder={placeholder}
      required={required}
      disabled={disabled || !categoryId}
      enabled={branchId != null && !!categoryId}
    />
  );
}

export function AllAccountsAsyncSearchSelect({
  branchId,
  value,
  onChange,
  label,
  placeholder = 'Search account…',
  required,
  disabled,
}: {
  branchId: number | null;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const fetchPage = useMemo(() => createAccountFetch(branchId), [branchId]);

  return (
    <AsyncSearchSelect<Row>
      label={label}
      value={value}
      onChange={onChange}
      fetchPage={fetchPage}
      mapOption={(account): SearchSelectOption => ({
        value: String(account.id),
        label: String(account.name ?? account.code ?? account.id),
      })}
      resolvePinnedByValue={
        branchId && value
          ? async (accountId) => branchApi.account(branchId, parseInt(accountId, 10)) as Promise<Row>
          : undefined
      }
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      enabled={branchId != null}
    />
  );
}
