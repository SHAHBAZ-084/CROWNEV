/** Read normalized battery spec strings from Product.specs JSON. */
export function batterySpecsFromProduct(product: { specs?: unknown }) {
  const specs = product.specs as Record<string, string> | null | undefined;
  if (!specs || typeof specs !== 'object') {
    return { batteryVoltage: undefined, batteryCapacityAh: undefined };
  }
  const batteryVoltage = specs.battery_voltage?.trim() || undefined;
  const batteryCapacityAh = specs.battery_capacity_ah?.trim() || undefined;
  return { batteryVoltage, batteryCapacityAh };
}
