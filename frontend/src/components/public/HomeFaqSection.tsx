import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HOME_FAQ_ITEMS } from '../../lib/faqContent';
import { publicApi } from '../../api/client';
import {
  defaultViewport,
  easeOut,
  fadeUp,
  motionTransition,
  staggerContainer,
} from '../../lib/publicMotion';
import { SectionHeadingIcon } from './SectionHeadingIcon';

const accordionEase = easeOut;
const accordionTransition = { duration: 0.38, ease: accordionEase };
const chevronSpring = { type: 'spring' as const, stiffness: 380, damping: 28 };

function FaqItem({
  index,
  question,
  answer,
  isOpen,
  onToggle,
}: {
  index: number;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const num = String(index + 1).padStart(2, '0');

  return (
    <motion.div
      layout
      variants={fadeUp}
      whileHover={isOpen ? undefined : { y: -2 }}
      transition={{ layout: { duration: 0.32, ease: easeOut }, duration: 0.2 }}
      className={`group relative overflow-hidden rounded-[var(--radius-card)] border bg-elevated shadow-[var(--shadow-elevated)] ${
        isOpen ? 'border-accent/40 shadow-[var(--shadow-elevated-hover)]' : 'border-border-light hover:border-accent/25'
      }`}
    >
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand via-accent to-accent-soft"
        initial={false}
        animate={{ scaleX: isOpen ? 1 : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.35, ease: easeOut }}
        style={{ transformOrigin: 'left' }}
        aria-hidden
      />

      <button
        type="button"
        onClick={onToggle}
        className="relative flex w-full items-center gap-4 px-5 py-5 text-left sm:px-6 sm:py-5"
        aria-expanded={isOpen}
      >
        <motion.span
          className="w-8 shrink-0 font-display text-sm font-semibold tabular-nums text-accent"
          animate={{ scale: isOpen ? 1.1 : 1 }}
          transition={chevronSpring}
        >
          {num}
        </motion.span>

        <motion.span
          className={`flex-1 font-display text-base font-semibold transition-colors duration-300 sm:text-lg ${
            isOpen ? 'text-brand' : 'text-ink group-hover:text-brand/90'
          }`}
          layout="position"
        >
          {question}
        </motion.span>

        <motion.span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
            isOpen ? 'bg-accent/15' : 'bg-subtle group-hover:bg-accent/10'
          }`}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={chevronSpring}
        >
          <ChevronDown className="h-4 w-4 text-brand-light" strokeWidth={2.25} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={accordionTransition}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ duration: 0.28, ease: easeOut, delay: 0.05 }}
              className="border-t border-border-light px-5 pb-5 pt-4 sm:px-6 sm:pb-6"
            >
              <motion.p
                initial={{ x: -8, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -4, opacity: 0 }}
                transition={{ duration: 0.32, ease: easeOut, delay: 0.1 }}
                className="border-l-2 border-accent pl-4 text-sm leading-relaxed text-ink-muted sm:text-base"
              >
                {answer}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function HomeFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [faqItems, setFaqItems] = useState(HOME_FAQ_ITEMS);

  useEffect(() => {
    publicApi.faq().then(setFaqItems).catch(console.error);
  }, []);

  function toggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <section
      id="faqs"
      className="relative scroll-mt-28 overflow-hidden border-y border-border-light bg-elevated bg-[radial-gradient(ellipse_at_top_right,_rgb(249_115_22_/_5%)_0%,_transparent_55%)] py-16 lg:py-24"
      aria-labelledby="home-faq-heading"
    >
      <div className="relative mx-auto max-w-3xl px-4 lg:max-w-4xl lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={motionTransition}
          className="mx-auto mb-10 max-w-2xl text-center lg:mb-12"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-subtle px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
            <SectionHeadingIcon>
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            </SectionHeadingIcon>
            Support
          </span>
          <h2
            id="home-faq-heading"
            className="mt-4 font-display text-3xl font-bold text-ink lg:text-4xl"
          >
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Everything you need to know about shopping, branches, service bookings, and riding with Crown Ev.
          </p>
        </motion.div>

        <motion.div
          className="space-y-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={defaultViewport}
        >
          {faqItems.map(({ question, answer }, index) => (
            <FaqItem
              key={question}
              index={index}
              question={question}
              answer={answer}
              isOpen={openIndex === index}
              onToggle={() => toggle(index)}
            />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={defaultViewport}
          transition={{ ...motionTransition, delay: 0.15 }}
          className="mt-10 text-center text-sm text-ink-muted"
        >
          Still have a question?{' '}
          <Link to="/contact" className="font-semibold text-brand transition-colors hover:text-brand-light hover:underline">
            Contact us
          </Link>{' '}
          or visit your nearest branch.
        </motion.p>
      </div>
    </section>
  );
}
