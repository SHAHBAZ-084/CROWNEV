export const EV_SPEC_FIELDS = [
  { key: 'motor', label: 'Motor', placeholder: 'e.g. 1000W BLDC' },
  { key: 'range', label: 'Range', placeholder: 'e.g. 80 km' },
  { key: 'speed', label: 'Speed', placeholder: 'e.g. 45 km/h' },
  { key: 'weight', label: 'Weight', placeholder: 'e.g. 68 kg' },
  { key: 'battery', label: 'Battery', placeholder: 'e.g. 60V 32Ah Lithium' },
  { key: 'chargingTime', label: 'Charging Time', placeholder: 'e.g. 6 hours' },
] as const;

export type EvSpecKey = (typeof EV_SPEC_FIELDS)[number]['key'];

export function parseEvSpecsFromForm(fd: FormData): Record<string, string> | undefined {
  const specs: Record<string, string> = {};
  for (const { key } of EV_SPEC_FIELDS) {
    const value = String(fd.get(`spec_${key}`) ?? '').trim();
    if (value) specs[key] = value;
  }
  return Object.keys(specs).length > 0 ? specs : undefined;
}

export function getSpecDefault(
  specs: Record<string, string> | null | undefined,
  key: EvSpecKey,
): string {
  if (!specs) return '';
  const value = specs[key];
  return typeof value === 'string' ? value : '';
}

export function orderedSpecEntries(
  specs: Record<string, string> | null | undefined,
): { key: EvSpecKey; label: string; value: string }[] {
  if (!specs) return [];
  return EV_SPEC_FIELDS.filter(({ key }) => specs[key]?.trim()).map(({ key, label }) => ({
    key,
    label,
    value: specs[key]!.trim(),
  }));
}
