type CategoryRow = Record<string, unknown>;

export function isCustomersCategory(row: CategoryRow | null) {
  if (!row) return false;
  if (row.isCustomersCategory === true) return true;
  return String(row.name ?? '').trim().toLowerCase() === 'customers';
}

export function isSuppliersCategory(row: CategoryRow | null) {
  if (!row) return false;
  if (row.isSuppliersCategory === true) return true;
  return String(row.name ?? '').trim().toLowerCase() === 'suppliers';
}

export function isInventoryCategory(row: CategoryRow | null) {
  if (!row) return false;
  if (row.isInventoryCategory === true) return true;
  return String(row.name ?? '').trim().toLowerCase() === 'inventory';
}

export function isSystemEntityCategory(row: CategoryRow | null) {
  return isCustomersCategory(row) || isSuppliersCategory(row);
}

export function isProtectedCategory(row: CategoryRow | null) {
  return isSystemEntityCategory(row) || isInventoryCategory(row);
}

/** Categories excluded from the generic Add Account form. */
export function isManualAccountCategoryExcluded(row: CategoryRow | null) {
  return isSystemEntityCategory(row);
}

export function filterManualAccountCategories<T extends CategoryRow>(categories: T[]) {
  return categories.filter((c) => !isManualAccountCategoryExcluded(c));
}
