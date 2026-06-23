import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, MessageCircle } from 'lucide-react';
import { publicApi } from '../../api/client';
import { LegalAccordion } from '../../components/public/LegalAccordion';
import { LegalPageLayout } from '../../components/public/LegalPageLayout';
import { FaqView } from '../../components/public/FaqView';
import { PrivacyPolicyView } from '../../components/public/PrivacyPolicyView';
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
      <section className="bg-gradient-to-b from-surface-alt to-white py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-4 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl font-bold text-brand lg:text-5xl"
          >
            About Crown Eve Bikes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-lg text-text-muted leading-relaxed"
          >
            {COMPANY_STORY.split('\n\n')[0]}
          </motion.p>
        </div>
      </section>

      <section className="overflow-hidden border-y border-border bg-gradient-to-b from-white via-surface-alt/60 to-white py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
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
              <p className="mt-4 text-text-muted leading-relaxed">
                {COMPANY_STORY.split('\n\n')[1] ?? COMPANY_STORY.split('\n\n')[0]}
              </p>
              <ul className="mt-6 space-y-3 text-sm text-text-muted">
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

      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-brand mb-6">Our Story</h2>
          <div className="space-y-4 text-text-muted leading-relaxed">
            {COMPANY_STORY.split('\n\n').map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface-alt py-16 lg:py-24">
        <div className="mx-auto max-w-5xl px-4 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-brand text-center mb-12">Leadership</h2>
          <div className="grid gap-8 md:grid-cols-2">
            {FOUNDERS.map((f, i) => (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col sm:flex-row gap-6 rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]"
              >
                {/* PLACEHOLDER. replace image URL before production */}
                <img src={f.image} alt={f.name} className="h-32 w-32 rounded-2xl object-cover shrink-0 mx-auto sm:mx-0" />
                <div>
                  <h3 className="font-display font-semibold text-brand text-lg">{f.name}</h3>
                  <p className="text-sm text-accent font-medium">{f.title}</p>
                  <p className="mt-3 text-sm text-text-muted leading-relaxed">{f.bio}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-brand mb-12">Our Branches</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {branches.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                    <MapPin className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand">{b.name}</h3>
                    <p className="text-sm text-text-muted">{b.location}</p>
                  </div>
                </div>
                {b.description && (
                  <p className="mt-4 text-sm text-text-muted leading-relaxed">{b.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="text-accent hover:underline">{b.phone}</a>
                  {b.whatsapp && (
                    <a href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`} className="inline-flex items-center gap-1 text-success hover:underline">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
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
