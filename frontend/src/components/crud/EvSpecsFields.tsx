import { EV_SPEC_FIELDS, getSpecDefault, isEvSpecRequired } from '../../lib/evSpecs';

export function EvSpecsFields({
  specs,
  colorOptions,
}: {
  specs?: Record<string, string> | null;
  colorOptions?: string[] | null;
}) {
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
      <div className="space-y-1.5">
        <label htmlFor="colorOptions" className="block text-sm font-medium text-text">
          Color Options
        </label>
        <input
          id="colorOptions"
          name="colorOptions"
          type="text"
          placeholder="e.g. White, Blue, Red, Black, Grey"
          defaultValue={(colorOptions ?? []).join(', ')}
          className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <p className="text-xs text-text-muted">Optional. Separate colors with commas.</p>
      </div>
    </fieldset>
  );
}
