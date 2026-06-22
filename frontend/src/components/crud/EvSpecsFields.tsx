import { EV_SPEC_FIELDS, getSpecDefault } from '../../lib/evSpecs';

export function EvSpecsFields({
  specs,
}: {
  specs?: Record<string, string> | null;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-display text-sm font-semibold text-brand">EV Specifications</legend>
      <p className="text-xs text-text-muted">
        Optional — shown on the product page when customers view this bike.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EV_SPEC_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1.5">
            <label htmlFor={`spec_${key}`} className="block text-sm font-medium text-text">
              {label}
            </label>
            <input
              id={`spec_${key}`}
              name={`spec_${key}`}
              type="text"
              placeholder={placeholder}
              defaultValue={getSpecDefault(specs, key)}
              className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
