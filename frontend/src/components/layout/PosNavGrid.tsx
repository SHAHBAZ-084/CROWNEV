import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { posSections } from '../../config/posNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { useBranchPermission } from '../../hooks/useBranchPermission';

export function PosNavGrid() {
  const { user } = useAuth();
  const { canDelete } = useBranchPermission();
  const canManageFinancialYear = user?.role === 'ADMIN' || canDelete;

  const sections = useMemo(
    () =>
      canManageFinancialYear
        ? posSections
        : posSections.filter((section) => section.title !== 'Financial Year'),
    [canManageFinancialYear],
  );

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {sections.map((section) => (
        <section
          key={section.title}
          className="overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)]"
        >
          <div className="border-b border-border-light bg-subtle px-5 py-3.5">
            <h3 className="font-display text-sm font-semibold tracking-tight text-ink">{section.title}</h3>
          </div>
          <ul className="divide-y divide-border-light">
            {section.items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-brand/5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink group-hover:text-brand">
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted/40 transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
