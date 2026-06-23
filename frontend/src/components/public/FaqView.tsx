import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Minus, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LegalSection } from '../../lib/legalTypes';

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border transition-shadow ${
        isOpen
          ? 'border-accent/40 bg-white shadow-[var(--shadow-card-hover)]'
          : 'border-border bg-white shadow-[var(--shadow-card)] hover:border-accent/25'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-4 px-5 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
            isOpen ? 'bg-accent text-white' : 'bg-surface-alt text-brand-light'
          }`}
        >
          {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </span>
        <span className="flex-1 font-display text-base font-semibold text-brand lg:text-lg">
          {question}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="border-t border-border/60 px-5 pb-5 pl-16 pt-4 text-sm leading-relaxed text-text-muted">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqView({ sections }: { sections: LegalSection[] }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<number>>(new Set([0]));

  const items = useMemo(
    () => sections.map((s) => ({ question: s.title, answer: s.items[0] ?? '' })),
    [sections],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.map((item, i) => ({ ...item, index: i }));
    return items
      .map((item, i) => ({ ...item, index: i }))
      .filter(
        (item) =>
          item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
      );
  }, [items, query]);

  function toggle(index: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-surface-alt via-white to-surface-alt/50">
      <section className="mx-auto max-w-3xl px-4 pb-8 pt-16 lg:px-8 lg:pt-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
            <HelpCircle className="h-6 w-6 text-accent" />
          </div>
          <h1 className="font-display text-3xl font-bold text-brand lg:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted lg:text-base">
            Quick answers about orders, delivery, services, and support at Crown Ev Bikes.
          </p>

          <div className="relative mt-8">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions…"
              className="w-full rounded-2xl border border-border bg-white py-3.5 pl-12 pr-4 text-sm text-brand shadow-[var(--shadow-card)] outline-none transition-shadow placeholder:text-text-muted/70 focus:border-accent/50 focus:shadow-[var(--shadow-card-hover)]"
            />
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 lg:px-8">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-white/80 px-6 py-10 text-center text-sm text-text-muted">
            No questions match &ldquo;{query}&rdquo;. Try different keywords or{' '}
            <Link to="/contact" className="font-medium text-accent hover:underline">
              contact us
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map(({ question, answer, index }) => (
              <FaqItem
                key={index}
                question={question}
                answer={answer}
                isOpen={open.has(index)}
                onToggle={() => toggle(index)}
              />
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 rounded-2xl border border-border bg-gradient-to-r from-brand/5 to-accent/10 p-6 text-center lg:p-8"
        >
          <p className="font-display text-lg font-semibold text-brand">Still have questions?</p>
          <p className="mt-2 text-sm text-text-muted">
            Our team is happy to help with orders, bookings, or branch inquiries.
          </p>
          <Link
            to="/contact"
            className="mt-5 inline-flex rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Contact Support
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
