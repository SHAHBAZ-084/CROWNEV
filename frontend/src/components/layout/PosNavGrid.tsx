import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { posSections } from '../../config/posNavigation';

export function PosNavGrid() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {posSections.map((section) => (
        <section
          key={section.title}
          className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-white shadow-[var(--shadow-card)]"
        >
          <div className="border-b border-border/50 bg-gradient-to-r from-surface-alt/80 to-white px-5 py-3.5">
            <h3 className="font-display text-sm font-bold tracking-tight text-brand">{section.title}</h3>
          </div>
          <ul className="divide-y divide-border/30">
            {section.items.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-alt/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-text group-hover:text-brand">
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-muted/40 transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
