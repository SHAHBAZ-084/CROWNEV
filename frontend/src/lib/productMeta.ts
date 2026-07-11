export function formatProductMetaLine(input: {
  brand?: string | { name?: string } | null;
  category?: string | { name?: string } | null;
  model?: string | null;
}): string | null {
  const brand = typeof input.brand === 'string' ? input.brand : input.brand?.name;
  const category = typeof input.category === 'string' ? input.category : input.category?.name;
  const parts = [brand, category, input.model].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
