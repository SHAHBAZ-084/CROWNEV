import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { LegalSection } from '../../lib/legalTypes';

function LegalAccordionItem({
  index,
  title,
  items,
  isOpen,
  onToggle,
}: {
  index: number;
  title: string;
  items: string[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const num = String(index + 1).padStart(2, '0');

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-subtle/80"
        aria-expanded={isOpen}
      >
        <span className="w-8 shrink-0 font-display text-sm font-semibold tabular-nums text-brand">
          {num}
        </span>
        <span className="flex-1 font-display text-lg font-semibold text-ink">{title}</span>
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 shrink-0 text-brand" />
        </motion.span>
      </button>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="overflow-hidden"
      >
        <div className="border-t border-border-light px-6 pb-6 pt-5">
          {items.length === 1 ? (
            <p className="pl-10 text-sm leading-relaxed text-ink-muted">{items[0]}</p>
          ) : (
            <ul className="space-y-3 pl-10">
              {items.map((item) => (
                <li key={item.slice(0, 48)} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function LegalAccordion({ sections }: { sections: LegalSection[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <LegalAccordionItem
          key={section.title}
          index={i}
          title={section.title}
          items={section.items}
          isOpen={open === i}
          onToggle={() => setOpen(open === i ? null : i)}
        />
      ))}
    </div>
  );
}
