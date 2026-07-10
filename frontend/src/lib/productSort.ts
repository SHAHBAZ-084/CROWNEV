/** Match backend findManyWithListingOrder: explicit order first, 0 = unset at end. */
export function compareProductListingOrder(
  a: { listingOrder?: number; createdAt?: string },
  b: { listingOrder?: number; createdAt?: string },
): number {
  const aOrder = a.listingOrder ?? 0;
  const bOrder = b.listingOrder ?? 0;
  if ((aOrder === 0) !== (bOrder === 0)) return aOrder === 0 ? 1 : -1;
  if (aOrder > 0 && bOrder > 0 && aOrder !== bOrder) return aOrder - bOrder;
  const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
  const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
  return bTime - aTime;
}

export function sortProductsByListingOrder<
  T extends { listingOrder?: number; createdAt?: string; type?: string },
>(products: T[], typeFilter?: string): T[] {
  if (typeFilter === 'BIKE' || typeFilter === 'PART') {
    return [...products].sort(compareProductListingOrder);
  }
  const bikes = products.filter((p) => p.type === 'BIKE').sort(compareProductListingOrder);
  const parts = products.filter((p) => p.type === 'PART').sort(compareProductListingOrder);
  return [...bikes, ...parts];
}
