export type BikeModelOption = { id: number; name: string };

export type PartCatalogDetail = {
  serial_no?: string;
  item_code?: string;
  model?: string;
  cp_price?: string | number;
  compatible_models?: string[];
  unit?: string;
};

export function parseModelCompatibilityCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PartDetailFields({
  detail,
  bikeModels = [],
  compatibleModels,
  onCompatibleModelsChange,
}: {
  detail?: PartCatalogDetail | null;
  bikeModels?: BikeModelOption[];
  compatibleModels?: string[];
  onCompatibleModelsChange?: (models: string[]) => void;
}) {
  const selected = compatibleModels ?? detail?.compatible_models ?? [];

  function toggleModel(name: string) {
    if (!onCompatibleModelsChange) return;
    const next = selected.includes(name)
      ? selected.filter((m) => m !== name)
      : [...selected, name];
    onCompatibleModelsChange(next);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="font-display text-sm font-semibold text-brand">Part Details</legend>
      <p className="text-xs text-text-muted">
        <span className="text-accent">*</span> Item code and model are required. Other fields are optional catalog metadata.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="part_serial_no" className="block text-sm font-medium text-text">
            Serial No (S/O)
          </label>
          <input
            id="part_serial_no"
            name="part_serial_no"
            type="text"
            placeholder="e.g. S/O number"
            defaultValue={detail?.serial_no ?? ''}
            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="part_item_code" className="block text-sm font-medium text-text">
            Item Code <span className="text-accent">*</span>
          </label>
          <input
            id="part_item_code"
            name="part_item_code"
            type="text"
            placeholder="e.g. SK-0104-FR"
            defaultValue={detail?.item_code ?? ''}
            required
            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="part_model" className="block text-sm font-medium text-text">
            Model <span className="text-accent">*</span>
          </label>
          <input
            id="part_model"
            name="part_model"
            type="text"
            placeholder="e.g. SPARK RD"
            defaultValue={detail?.model ?? ''}
            required
            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="part_cp_price" className="block text-sm font-medium text-text">
            Cost / Purchase Price (PKR)
          </label>
          <input
            id="part_cp_price"
            name="part_cp_price"
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 1200"
            defaultValue={detail?.cp_price != null ? String(detail.cp_price) : ''}
            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="part_unit" className="block text-sm font-medium text-text">
            Unit
          </label>
          <select
            id="part_unit"
            name="part_unit"
            defaultValue={detail?.unit ?? 'piece'}
            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="piece">Piece</option>
            <option value="set">Set</option>
            <option value="pair">Pair</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <span className="block text-sm font-medium text-text">Compatible Models</span>
          {bikeModels.length === 0 ? (
            <p className="text-xs text-text-muted">
              No bike models in catalog yet. Seed bike models first, or save without compatibility tags.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-white p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {bikeModels.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-subtle"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(m.name)}
                      onChange={() => toggleModel(m.name)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                    />
                    <span>{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {selected.length > 0 && (
            <p className="text-xs text-text-muted">
              {selected.length} model{selected.length === 1 ? '' : 's'} selected
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

export function validatePartDetailFromForm(fd: FormData): string | null {
  const item_code = String(fd.get('part_item_code') ?? '').trim();
  if (!item_code) return 'Item code is required for parts';
  const model = String(fd.get('part_model') ?? '').trim();
  if (!model) return 'Model is required for parts';

  const cp_price_raw = String(fd.get('part_cp_price') ?? '').trim();
  if (cp_price_raw) {
    const cp_price = parseFloat(cp_price_raw);
    if (!Number.isFinite(cp_price) || cp_price < 0) {
      return 'Cost / purchase price must be a valid positive number';
    }
  }

  return null;
}

export function parsePartDetailFromForm(fd: FormData): Record<string, unknown> | undefined {
  const serial_no = String(fd.get('part_serial_no') ?? '').trim() || undefined;
  const item_code = String(fd.get('part_item_code') ?? '').trim() || undefined;
  const model = String(fd.get('part_model') ?? '').trim() || undefined;
  const cp_price_raw = String(fd.get('part_cp_price') ?? '').trim();
  const cp_price = cp_price_raw ? parseFloat(cp_price_raw) : undefined;
  const unit = String(fd.get('part_unit') ?? '').trim() || undefined;

  const detail = { serial_no, item_code, model, cp_price, unit };
  const hasAny = Object.values(detail).some((v) => v !== undefined);
  return hasAny ? detail : undefined;
}
