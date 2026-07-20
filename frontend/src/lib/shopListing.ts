import type { Product } from '../types';

export type ShopGridItem =
  | { kind: 'product'; product: Product }
  | { kind: 'spacer'; position: number };

/** Build shop grid rows so listingOrder N appears in slot N (empty slots when numbers are skipped). */
export function buildShopGridItems(products: Product[]): ShopGridItem[] {
  const numbered = products.filter((p) => (p.listingOrder ?? 0) > 0);
  const unnumbered = products.filter((p) => !(p.listingOrder ?? 0));

  if (numbered.length === 0) {
    return unnumbered.map((product) => ({ kind: 'product' as const, product }));
  }

  const maxSlot = Math.max(...numbered.map((p) => p.listingOrder ?? 0));
  const bySlot = new Map(numbered.map((p) => [p.listingOrder!, p]));
  const items: ShopGridItem[] = [];

  for (let slot = 1; slot <= maxSlot; slot++) {
    const product = bySlot.get(slot);
    if (product) items.push({ kind: 'product', product });
    else items.push({ kind: 'spacer', position: slot });
  }

  for (const product of unnumbered) {
    items.push({ kind: 'product', product });
  }

  return items;
}
