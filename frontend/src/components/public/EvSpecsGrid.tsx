import { orderedSpecEntries } from '../../lib/evSpecs';

export function EvSpecsGrid({ specs }: { specs?: Record<string, string> | null }) {
  const entries = orderedSpecEntries(specs);
  if (!entries.length) return null;

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-semibold text-brand">EV Specifications</h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entries.map(({ key, label, value }) => (
          <div key={key} className="rounded-xl bg-surface-alt px-4 py-3">
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="font-medium text-brand">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
