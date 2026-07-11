import type { ReactNode } from 'react';
import { getSpecDefault, normalizeProductSpecs } from './evSpecs';

export type ProductItemMetaFields = {
  brand?: string | null;
  category?: string | null;
  model?: string | null;
  batteryVoltage?: string | null;
  batteryCapacityAh?: string | null;
};

export function batterySpecsFromSpecs(
  specs: Record<string, unknown> | null | undefined,
): Pick<ProductItemMetaFields, 'batteryVoltage' | 'batteryCapacityAh'> {
  const normalized = normalizeProductSpecs(specs);
  const batteryVoltage = getSpecDefault(normalized, 'battery_voltage') || undefined;
  const batteryCapacityAh = getSpecDefault(normalized, 'battery_capacity_ah') || undefined;
  return { batteryVoltage, batteryCapacityAh };
}

export function productItemMetaFromProduct(product: {
  brand?: string | { name?: string } | null;
  category?: string | { name?: string } | null;
  model?: string | null;
  specs?: Record<string, unknown> | null;
  batteryVoltage?: string | null;
  batteryCapacityAh?: string | null;
}): ProductItemMetaFields {
  const brand = typeof product.brand === 'string' ? product.brand : product.brand?.name;
  const category = typeof product.category === 'string' ? product.category : product.category?.name;
  const fromSpecs = batterySpecsFromSpecs(product.specs);
  return {
    brand: brand ?? undefined,
    category: category ?? undefined,
    model: product.model ?? undefined,
    batteryVoltage: product.batteryVoltage ?? fromSpecs.batteryVoltage,
    batteryCapacityAh: product.batteryCapacityAh ?? fromSpecs.batteryCapacityAh,
  };
}

export function ProductItemMetaLines({
  item,
  subtextClassName,
}: {
  item: ProductItemMetaFields;
  subtextClassName: string;
}): ReactNode {
  const hasMeta = item.brand || item.category || item.model;
  const hasBattery = item.batteryVoltage || item.batteryCapacityAh;
  if (!hasMeta && !hasBattery) return null;

  return (
    <>
      {hasMeta && (
        <p className={subtextClassName}>
          {item.brand && <span>Brand: {item.brand}</span>}
          {item.category && <span className="ml-2">· Category: {item.category}</span>}
          {item.model && <span className="ml-2">· Model: {item.model}</span>}
        </p>
      )}
      {hasBattery && (
        <p className={subtextClassName}>
          {item.batteryVoltage && <span>Battery: {item.batteryVoltage}</span>}
          {item.batteryCapacityAh && <span className="ml-2">· {item.batteryCapacityAh}</span>}
        </p>
      )}
    </>
  );
}
