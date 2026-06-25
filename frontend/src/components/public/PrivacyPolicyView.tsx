import { motion } from 'framer-motion';
import {
  Baby,
  Clock,
  Cookie,
  Database,
  Eye,
  Lock,
  Mail,
  Scale,
  Share2,
  Shield,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { defaultViewport } from '../../lib/publicMotion';
import type { LegalSection } from '../../lib/legalTypes';
import { SectionHeadingIcon } from './SectionHeadingIcon';

const PRIVACY_ICONS: LucideIcon[] = [
  Database,
  Eye,
  Scale,
  Share2,
  Clock,
  Cookie,
  Lock,
  UserCheck,
  Baby,
  Mail,
];

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function PrivacyPolicyView({ sections }: { sections: LegalSection[] }) {
  const [activeId, setActiveId] = useState(slugify(sections[0]?.title ?? ''));

  useEffect(() => {
    const ids = sections.map((s) => slugify(s.title));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="min-h-[60vh] bg-subtle">
      <section className="relative overflow-hidden bg-gradient-to-br from-brand via-brand-light to-accent px-4 py-16 text-white lg:py-20">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-black/10 blur-2xl" aria-hidden />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mx-auto max-w-6xl"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
                <Shield className="h-4 w-4" />
                Your data, protected
              </div>
              <h1 className="font-display text-3xl font-bold lg:text-4xl">Privacy Policy</h1>
              <p className="mt-3 text-sm leading-relaxed text-white/90 lg:text-base">
                How Crown Ev collects, uses, and safeguards your personal information when you shop,
                book services, or visit our branches.
              </p>
            </div>
            <p className="shrink-0 text-xs text-white/75 lg:text-right">
              Last updated: June 2025
            </p>
          </div>
        </motion.div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 lg:flex lg:gap-12 lg:px-8 lg:py-16">
        <aside className="mb-10 lg:mb-0 lg:w-56 lg:shrink-0">
          <nav className="lg:sticky lg:top-24">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              On this page
            </p>
            <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {sections.map((section) => {
                const id = slugify(section.title);
                const isActive = activeId === id;
                return (
                  <li key={id} className="shrink-0 lg:shrink">
                    <a
                      href={`#${id}`}
                      onClick={() => setActiveId(id)}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors whitespace-nowrap lg:whitespace-normal ${
                        isActive
                          ? 'bg-elevated font-medium text-brand shadow-sm'
                          : 'text-ink-muted hover:bg-elevated/80 hover:text-brand'
                      }`}
                    >
                      {section.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-8">
          {sections.map((section, i) => {
            const id = slugify(section.title);
            const Icon = PRIVACY_ICONS[i] ?? Shield;
            return (
              <motion.section
                key={id}
                id={id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={defaultViewport}
                className="scroll-mt-28 rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)] lg:p-8"
              >
                <div className="flex items-start gap-4">
                  <SectionHeadingIcon className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                    <Icon className="h-5 w-5 text-brand" />
                  </SectionHeadingIcon>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl font-bold text-ink">{section.title}</h2>
                    <ul className="mt-4 space-y-2.5">
                      {section.items.map((item) => (
                        <li
                          key={item.slice(0, 48)}
                          className="flex gap-3 text-sm leading-relaxed text-ink-muted"
                        >
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
