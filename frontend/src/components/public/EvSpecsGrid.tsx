import { orderedSpecEntries } from '../../lib/evSpecs';

export function EvSpecsGrid({
  specs,
  title = 'Specifications',
}: {
  specs?: Record<string, unknown> | null;
  title?: string;
}) {
  const entries = orderedSpecEntries(specs);
  if (!entries.length) return null;

  return (
    <div>
      <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">{title}</h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entries.map(({ key, label, value }) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="font-medium text-orange-500">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
