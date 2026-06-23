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
    <div className="rounded-2xl bg-white p-6">
      <h2 className="mb-4 font-display text-lg font-semibold text-slate-900">{title}</h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entries.map(({ key, label, value }) => (
          <div key={key} className="rounded-xl bg-slate-100 px-4 py-3">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
