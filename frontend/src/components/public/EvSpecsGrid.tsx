import { useMemo } from 'react';
import { groupedSpecEntries, orderedSpecEntries, type SpecGroup } from '../../lib/evSpecs';

function SpecGroupGrid({ group }: { group: SpecGroup }) {
  return (
    <div>
      <div className="border-b border-border-light bg-subtle/80 px-3 py-2 sm:px-6">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand sm:text-[11px] sm:tracking-[0.16em]">
          {group.title}
        </h3>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-border-light sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {group.entries.map(({ key, label, value }) => (
          <div
            key={key}
            className="flex min-w-0 flex-col justify-center gap-0.5 bg-elevated px-3 py-2.5 sm:px-5 sm:py-3"
          >
            <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-ink-muted sm:text-[11px]">
              {label}
            </dt>
            <dd className="break-words font-display text-sm font-semibold leading-snug text-ink sm:text-[15px]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function EvSpecsGrid({
  specs,
  title = 'Specifications',
  entries: entriesProp,
}: {
  specs?: Record<string, unknown> | null;
  title?: string;
  entries?: { key: string; label: string; value: string }[];
}) {
  const groups = useMemo((): SpecGroup[] => {
    if (entriesProp?.length) {
      return [{ title: 'Details', entries: entriesProp }];
    }
    return groupedSpecEntries(specs);
  }, [entriesProp, specs]);

  const totalSpecs = groups.reduce((sum, group) => sum + group.entries.length, 0);
  if (!totalSpecs) return null;

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)]">
      <div className="border-b border-border-light bg-gradient-to-r from-brand/[0.06] via-accent/[0.04] to-transparent px-3 py-3 sm:px-6 sm:py-5">
        <h2 className="font-display text-base font-bold text-ink sm:text-xl">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-muted sm:mt-1 sm:text-sm">
          {totalSpecs} specification{totalSpecs === 1 ? '' : 's'}
        </p>
      </div>

      <div className="divide-y divide-border-light">
        {groups.map((group) => (
          <SpecGroupGrid key={group.title} group={group} />
        ))}
      </div>
    </section>
  );
}

/** Flat list variant for simple part details or legacy use. */
export function EvSpecsGridSimple({
  specs,
  title = 'Specifications',
}: {
  specs?: Record<string, unknown> | null;
  title?: string;
}) {
  const entries = orderedSpecEntries(specs);
  if (!entries.length) return null;

  return (
    <EvSpecsGrid title={title} entries={entries} />
  );
}
