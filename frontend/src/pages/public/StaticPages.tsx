import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { publicApi } from '../../api/client';
import { LegalAccordion } from '../../components/public/LegalAccordion';
import { LegalPageLayout } from '../../components/public/LegalPageLayout';
import { FaqView } from '../../components/public/FaqView';
import { PrivacyPolicyView } from '../../components/public/PrivacyPolicyView';
import { PageHero } from '../../components/public/PageHero';
import { BranchCardsSection } from '../../components/public/BranchCard';
import { COMPANY_STORY, FOUNDERS } from '../../lib/placeholders';
import { AboutBrandVideo } from '../../components/public/AboutBrandVideo';
import { FAQ_SECTIONS } from '../../lib/faqContent';
import { PRIVACY_SECTIONS } from '../../lib/privacyContent';
import { TERMS_SECTIONS } from '../../lib/termsContent';
import type { Branch } from '../../types';

export function AboutPage() {
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    publicApi.branches().then(setBranches).catch(console.error);
  }, []);

  return (
    <div>
      <PageHero
        page="about"
        eyebrow="Electric mobility for Pakistan"
        title="About Crown Eve Bikes"
        subtitle={COMPANY_STORY.split('\n\n')[0]}
      />

      <section className="overflow-hidden border-y border-border bg-gradient-to-b from-white via-surface-alt/60 to-white py-12 lg:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Our vision</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-brand sm:text-3xl">
                Built for Pakistani roads
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted sm:text-base">
                {COMPANY_STORY.split('\n\n')[1] ?? COMPANY_STORY.split('\n\n')[0]}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-text-muted">
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Premium electric bikes with heat-resistant batteries
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Nationwide branch network for sales and service
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  Walk-in showrooms and online ordering
                </li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="order-1 flex w-full justify-center lg:order-2 lg:justify-end"
            >
              <AboutBrandVideo />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-b from-white via-surface-alt/30 to-surface-alt/50 py-12 lg:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-8 max-w-xl text-center lg:mb-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Our founders</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-brand sm:text-3xl">
              Driving Pakistan&apos;s electric future
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              The team behind Crown Eve&apos;s mission to bring premium electric mobility nationwide.
            </p>
          </motion.div>

          <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:gap-5">
            {FOUNDERS.map((f, i) => (
              <motion.article
                key={f.name}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex overflow-hidden rounded-xl border border-border bg-white shadow-[var(--shadow-card)] sm:flex-row"
              >
                <div className="h-40 w-full shrink-0 overflow-hidden bg-surface-alt sm:h-44 sm:w-36 md:w-40">
                  <img
                    src={f.image}
                    alt={f.name}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:p-5">
                  <h3 className="font-display text-lg font-bold text-brand">{f.name}</h3>
                  <p className="mt-0.5 text-sm font-semibold text-accent">{f.title}</p>
                  <blockquote className="mt-3 border-l-2 border-accent/35 pl-3 text-sm italic leading-snug text-brand/90">
                    &ldquo;{f.vision}&rdquo;
                  </blockquote>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-muted">{f.bio}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <BranchCardsSection
        branches={branches}
        eyebrow="Visit us"
        title="Our Branches"
        subtitle="Walk in for test rides, servicing, and genuine parts at any Crown Eve location."
        showDescription
        className="bg-gradient-to-b from-white to-surface-alt/40"
      />
    </div>
  );
}

export function PrivacyPage() {
  return <PrivacyPolicyView sections={PRIVACY_SECTIONS} />;
}

export function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms and Conditions"
      subtitle="Please read the following terms carefully. Using the Crown Eve website, purchasing products, or booking services constitutes acceptance of these conditions."
    >
      <LegalAccordion sections={TERMS_SECTIONS} />
    </LegalPageLayout>
  );
}

export function FAQPage() {
  return <FaqView sections={FAQ_SECTIONS} />;
}

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-6xl font-display font-bold text-brand">403</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-brand">Unauthorized</h1>
        <p className="mt-2 text-text-muted">You don&apos;t have permission to view this page.</p>
        <a href="/" className="mt-8 inline-block rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors">
          Back to Home
        </a>
      </motion.div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-6xl font-display font-bold text-accent">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-brand">Page not found</h1>
        <p className="mt-2 text-text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <a href="/" className="mt-8 inline-block rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors">
          Back to Home
        </a>
      </motion.div>
    </div>
  );
}
