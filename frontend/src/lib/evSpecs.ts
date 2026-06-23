export const EV_SPEC_FIELDS = [
  { key: 'motor_type', label: 'Motor Type', placeholder: 'e.g. Multi Mode Motor', required: true },
  { key: 'motor_watt_min', label: 'Motor Watt (Min)', placeholder: 'e.g. 3000W' },
  { key: 'motor_watt_max', label: 'Motor Watt (Max)', placeholder: 'e.g. 4000W', required: true },
  { key: 'battery_voltage', label: 'Battery Voltage', placeholder: 'e.g. 73.6V', required: true },
  { key: 'battery_capacity_ah', label: 'Battery Capacity (Ah)', placeholder: 'e.g. 40Ah', required: true },
  { key: 'battery_type', label: 'Battery Type', placeholder: 'e.g. Lithium LFP', required: true },
  { key: 'speed_min_kmh', label: 'Speed Min (km/h)', placeholder: 'e.g. 85' },
  { key: 'speed_max_kmh', label: 'Speed Max (km/h)', placeholder: 'e.g. 90', required: true },
  { key: 'range_eco_min_km', label: 'Range Eco Min (km)', placeholder: 'e.g. 100' },
  { key: 'range_eco_max_km', label: 'Range Eco Max (km)', placeholder: 'e.g. 110', required: true },
  { key: 'speed_modes', label: 'Speed Modes', placeholder: 'e.g. 4' },
  { key: 'charger', label: 'Charger', placeholder: 'e.g. 72V10A' },
  { key: 'charging_time_min_hrs', label: 'Charging Time Min (hrs)', placeholder: 'e.g. 4' },
  { key: 'charging_time_max_hrs', label: 'Charging Time Max (hrs)', placeholder: 'e.g. 5' },
  { key: 'net_weight_kg', label: 'Net Weight (kg)', placeholder: 'e.g. 100', required: true },
  { key: 'loading_capacity_kg', label: 'Loading Capacity (kg)', placeholder: 'e.g. 200' },
  { key: 'security', label: 'Security', placeholder: 'e.g. NFC Unlock' },
  { key: 'braking_system', label: 'Braking System', placeholder: 'e.g. F/R CBS' },
  { key: 'frame_material', label: 'Frame Material', placeholder: 'e.g. Aluminium / Steel' },
  { key: 'wheel_size', label: 'Wheel Size', placeholder: 'e.g. 17"' },
  { key: 'warranty', label: 'Warranty', placeholder: 'e.g. 1 Year Battery' },
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

export function validateEvSpecsFromForm(fd: FormData): string | null {
  for (const { key, label, required } of EV_SPEC_FIELDS) {
    if (!required) continue;
    const value = String(fd.get(`spec_${key}`) ?? '').trim();
    if (!value) return `${label} is required for bikes`;
  }
  return null;
}

export function parseColorOptionsFromForm(fd: FormData): string[] | undefined {
  const raw = String(fd.get('colorOptions') ?? '').trim();
  if (!raw) return undefined;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function getSpecDefault(
  specs: Record<string, string> | null | undefined,
  key: EvSpecKey,
): string {
  if (!specs) return '';
  const value = specs[key];
  return typeof value === 'string' ? value : '';
}

function formatSpecValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value).trim();
}

export function orderedSpecEntries(
  specs: Record<string, unknown> | null | undefined,
): { key: string; label: string; value: string }[] {
  if (!specs) return [];

  const knownKeys = new Set<string>(EV_SPEC_FIELDS.map(({ key }) => key));
  const known = EV_SPEC_FIELDS.filter(({ key }) => formatSpecValue(specs[key])).map(({ key, label }) => ({
    key,
    label,
    value: formatSpecValue(specs[key]),
  }));

  const legacy = Object.entries(specs)
    .filter(([key, value]) => !knownKeys.has(key) && formatSpecValue(value))
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: formatSpecValue(value),
    }));

  return [...known, ...legacy];
}
