import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FAQ_SECTIONS } from '../../lib/faqContent';

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
    <div className="border-b border-slate-200 py-5 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <motion.span
          className="font-display text-base font-semibold text-brand lg:text-lg"
          whileHover={{ x: 4 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {question}
        </motion.span>
        <ChevronDown
          className={`h-5 w-5 text-brand shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <motion.div
              className="mt-3 border-l-2 border-orange-500 pl-4"
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ transformOrigin: 'top' }}
            >
              <p className="text-sm leading-relaxed text-text-muted lg:text-base">
                {answer}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HomeFaqSection() {
  const [open, setOpen] = useState<Set<number>>(new Set());

  const items = useMemo(
    () =>
      FAQ_SECTIONS.slice(0, 6).map((s) => ({
        question: s.title,
        answer: s.items[0] ?? '',
      })),
    [],
  );

  function toggle(index: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <section className="bg-slate-100 py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 lg:px-8">
        <h2 className="text-center font-display text-3xl font-bold tracking-tight text-brand lg:text-4xl uppercase mb-12">
          FAQ'S
        </h2>

        <div className="space-y-1">
          {items.map(({ question, answer }, index) => (
            <FaqItem
              key={index}
              question={question}
              answer={answer}
              isOpen={open.has(index)}
              onToggle={() => toggle(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
