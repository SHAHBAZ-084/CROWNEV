import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { publicApi } from '../../api/client';
import { LegalAccordion } from '../../components/public/LegalAccordion';
import { LegalPageLayout } from '../../components/public/LegalPageLayout';
import { PrivacyPolicyView } from '../../components/public/PrivacyPolicyView';
import { PageHero } from '../../components/public/PageHero';
import { BranchCardsSection } from '../../components/public/BranchCard';
import { DEFAULT_FOUNDERS_SECTION, DEFAULT_ABOUT_HERO_SECTION, type FoundersSection, type AboutHeroSection } from '../../lib/placeholders';
import { resolveUploadUrl } from '../../lib/media';
import { AboutBrandVideo } from '../../components/public/AboutBrandVideo';
import { PRIVACY_SECTIONS } from '../../lib/privacyContent';
import { TERMS_SECTIONS } from '../../lib/termsContent';
import type { LegalSection } from '../../lib/legalTypes';
import type { Branch } from '../../types';

export function AboutPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [foundersSection, setFoundersSection] = useState<FoundersSection>(DEFAULT_FOUNDERS_SECTION);
  const [heroSection, setHeroSection] = useState<AboutHeroSection>(DEFAULT_ABOUT_HERO_SECTION);

  useEffect(() => {
    publicApi.branches({ visibleOnly: true }).then(setBranches).catch(console.error);
    publicApi.founders().then(setFoundersSection).catch(console.error);
    publicApi.aboutHero().then(setHeroSection).catch(console.error);
  }, []);

  return (
    <div>
      <PageHero
        page="about"
        eyebrow={heroSection.eyebrow}
        title={heroSection.title}
        subtitle={heroSection.subtitle}
      />

      <section className="overflow-hidden border-y border-border-light bg-elevated py-12 lg:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{heroSection.visionEyebrow}</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
                {heroSection.visionTitle}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
                {heroSection.visionBody}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-muted">
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

      <section className="bg-subtle py-12 lg:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto mb-8 max-w-xl text-center lg:mb-10"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{foundersSection.eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
              {foundersSection.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {foundersSection.subtitle}
            </p>
          </motion.div>

          <div className="mx-auto flex max-w-4xl flex-col gap-6 lg:gap-8">
            {foundersSection.founders.map((f, i) => (
              <motion.article
                key={`${f.name}-${i}`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col overflow-hidden rounded-2xl border border-border-light bg-elevated shadow-[var(--shadow-elevated)] transition-shadow hover:shadow-[var(--shadow-elevated-hover)] sm:min-h-[22rem] sm:flex-row lg:min-h-[24rem]"
              >
                <div className="relative w-full shrink-0 bg-subtle sm:w-52 md:w-60 lg:w-64">
                  <div className="aspect-[4/5] sm:absolute sm:inset-0 sm:aspect-auto">
                    <img
                      src={resolveUploadUrl(f.image) ?? f.image}
                      alt={f.name}
                      loading="lazy"
                      decoding="async"
                      width={400}
                      height={480}
                      className="h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
                  <span className="inline-flex w-fit rounded-full bg-accent/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                    {f.title}
                  </span>
                  <h3 className="mt-4 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl lg:text-[2rem]">
                    {f.name}
                  </h3>
                  <div className="mt-3 h-1 w-14 rounded-full bg-accent" aria-hidden />
                  <blockquote className="relative mt-6 text-base italic leading-relaxed text-ink/80 sm:text-lg">
                    <span className="pointer-events-none absolute -left-1 -top-3 font-display text-4xl leading-none text-accent/20" aria-hidden>
                      &ldquo;
                    </span>
                    {f.vision}
                  </blockquote>
                  <p className="mt-5 text-sm leading-relaxed text-ink-muted sm:text-base">{f.bio}</p>
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
        subtitle="Walk in for test rides, servicing, and genuine parts at any Crown Ev location."
        showDescription
        className="bg-elevated"
        tone="light"
      />
    </div>
  );
}

export function PrivacyPage() {
  const [sections, setSections] = useState<LegalSection[]>(PRIVACY_SECTIONS);
  useEffect(() => {
    publicApi.privacy().then(setSections).catch(console.error);
  }, []);
  return <PrivacyPolicyView sections={sections} />;
}

export function TermsPage() {
  const [sections, setSections] = useState<LegalSection[]>(TERMS_SECTIONS);
  useEffect(() => {
    publicApi.terms().then(setSections).catch(console.error);
  }, []);
  return (
    <LegalPageLayout
      title="Terms and Conditions"
      subtitle="Please read the following terms carefully. Using the Crown Ev website, purchasing products, or booking services constitutes acceptance of these conditions."
    >
      <LegalAccordion sections={sections} />
    </LegalPageLayout>
  );
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
