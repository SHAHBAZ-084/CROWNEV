import { useEffect, useRef } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import { EV_SPEC_FIELDS, getSpecDefault, isEvSpecRequired } from '../../lib/evSpecs';

export type ColorRow = {
  id: string;
  name: string;
  file: File | null;
  imageUrl: string | null;
};

function ColorRowItem({
  row,
  onChange,
  onRemove,
}: {
  row: ColorRow;
  onChange: (updated: ColorRow) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = row.file ? URL.createObjectURL(row.file) : row.imageUrl;

  useEffect(() => {
    return () => {
      if (row.file && previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [row.file, previewUrl]);

  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={row.name}
        onChange={(e) => onChange({ ...row, name: e.target.value })}
        placeholder="Color name (e.g. Matte Black)"
        className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-slate-50 hover:bg-slate-100"
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...row, file: null, imageUrl: null });
              }}
              className="absolute inset-0 flex items-center justify-center bg-black/45 text-[10px] font-semibold text-white opacity-0 transition-opacity hover:opacity-100"
            >
              Clear
            </button>
          </>
        ) : (
          <ImagePlus className="h-4 w-4 text-text-muted" />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (file) {
              onChange({ ...row, file, imageUrl: null });
            }
          }}
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-text-muted hover:bg-red-50 hover:text-red-500 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EvSpecsFields({
  specs,
  colorRows,
  onColorRowsChange,
}: {
  specs?: Record<string, string> | null;
  colorRows: ColorRow[];
  onColorRowsChange: (rows: ColorRow[]) => void;
}) {
  const addColorRow = () => {
    onColorRowsChange([
      ...colorRows,
      { id: `new-${Date.now()}-${Math.random()}`, name: '', file: null, imageUrl: null },
    ]);
  };

  const handleRowChange = (id: string, updated: ColorRow) => {
    onColorRowsChange(colorRows.map((r) => (r.id === id ? updated : r)));
  };

  const handleRowRemove = (id: string) => {
    onColorRowsChange(colorRows.filter((r) => r.id !== id));
  };

  return (
    <fieldset className="space-y-3">
      <legend className="font-display text-sm font-semibold text-brand">EV Specifications</legend>
      <p className="text-xs text-text-muted">
        Fields marked with <span className="text-accent">*</span> are required when saving a bike.
        Other fields are optional and appear on the shop product page when filled in.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EV_SPEC_FIELDS.map((field) => {
          const { key, label, placeholder } = field;
          const required = isEvSpecRequired(field);
          return (
            <div key={key} className="space-y-1.5">
              <label htmlFor={`spec_${key}`} className="block text-sm font-medium text-text">
                {label}
                {required ? <span className="text-accent"> *</span> : null}
              </label>
              <input
                id={`spec_${key}`}
                name={`spec_${key}`}
                type="text"
                placeholder={placeholder}
                defaultValue={getSpecDefault(specs, key)}
                required={required || undefined}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5 pt-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-text">Color Options</label>
          <button
            type="button"
            onClick={addColorRow}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <Plus className="h-3 w-3" /> Add Color Option
          </button>
        </div>
        {colorRows.length === 0 ? (
          <p className="text-xs italic text-text-muted">No color options configured yet.</p>
        ) : (
          <div className="space-y-2">
            {colorRows.map((row) => (
              <ColorRowItem
                key={row.id}
                row={row}
                onChange={(updated) => handleRowChange(row.id, updated)}
                onRemove={() => handleRowRemove(row.id)}
              />
            ))}
          </div>
        )}
      </div>
    </fieldset>
  );
}
