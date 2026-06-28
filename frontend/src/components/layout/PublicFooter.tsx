import { type ComponentType, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Calendar, ChevronUp, Mail, MapPin, Phone, ShoppingCart } from 'lucide-react';
import { Logo } from '../brand/Logo';
import { FacebookIcon, InstagramIcon, TikTokIcon, YoutubeIcon } from '../icons/BrandIcons';
import { ctaArrowClass } from '../../lib/publicMotion';
import { FOOTER_CONTACT, toTelHref } from '../../lib/placeholders';
import { useScrollPast } from '../../hooks/useScrollPast';
import { Button } from '../ui/Button';

function SocialIcon({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface-alt text-text-muted shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-white hover:shadow-md"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

function FooterContactIcon({ children }: { children: ReactNode }) {
  return (
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
      {children}
    </span>
  );
}

function FooterColumnHeading({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-brand">
      {children}
    </p>
  );
}

function FooterLink({ to, label, hash }: { to: string; label: string; hash?: string }) {
  return (
    <li>
      <Link
        to={hash ? { pathname: to, hash: `#${hash}` } : to}
        className="group inline-flex items-center gap-1.5 text-sm text-white transition-colors hover:text-brand-light"
      >
        <span>{label}</span>
        <ArrowUpRight className={`h-3.5 w-3.5 opacity-0 transition-all group-hover:opacity-100 group-hover:-translate-y-0.5 ${ctaArrowClass}`} />
      </Link>
    </li>
  );
}

function FooterCtaBanner() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative border-b border-border bg-gradient-to-r from-brand via-brand-light to-accent"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 lg:flex-row lg:px-8">
        <div className="text-center lg:text-left">
          <p className="font-display text-xl font-bold text-white lg:text-2xl">Ready to ride electric?</p>
          <p className="mt-1 text-sm text-white/85">Browse bikes, book a service, or visit your nearest branch.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/shop">
            <Button variant="secondary" size="sm" className="border-white bg-white font-semibold text-brand hover:bg-white/90 hover:text-brand">
              <ShoppingCart className="h-4 w-4" /> Shop Now
            </Button>
          </Link>
          <Link to="/book-service">
            <Button variant="ghost" size="sm" className="border border-white/40 text-white hover:bg-white/10">
              <Calendar className="h-4 w-4" /> Book Service
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function PublicFooter() {
  const isHome = useLocation().pathname === '/';

  return (
    <footer className="relative overflow-hidden border-t border-border bg-surface-alt bg-[radial-gradient(ellipse_at_top_right,_rgb(249_115_22_/_6%)_0%,_transparent_50%)]">
      {isHome && <FooterCtaBanner />}

      <div className="relative mx-auto max-w-7xl px-4 pb-4 pt-14 lg:px-8 lg:pt-16 lg:pb-5">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Logo size="lg" linked />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white">
              Pakistan&apos;s premium electric mobility platform. Ride the future, branch by branch.
            </p>
            <div className="mt-5 flex gap-2.5">
              <SocialIcon href="https://facebook.com" label="Facebook" icon={FacebookIcon} />
              <SocialIcon href="https://instagram.com" label="Instagram" icon={InstagramIcon} />
              <SocialIcon href="https://youtube.com" label="YouTube" icon={YoutubeIcon} />
              <SocialIcon href="https://tiktok.com" label="TikTok" icon={TikTokIcon} />
            </div>
          </div>

          <div className="lg:col-span-2 lg:col-start-6">
            <FooterColumnHeading>Quick Links</FooterColumnHeading>
            <ul className="mt-4 space-y-3">
              <FooterLink to="/" label="Home" />
              <FooterLink to="/about" label="About Us" />
              <FooterLink to="/contact" label="Contact Us" />
              <FooterLink to="/shop" label="Shop" />
              <FooterLink to="/compare" label="Compare Models" />
              <FooterLink to="/book-service" label="Book Service" />
            </ul>
          </div>

          <div className="lg:col-span-2">
            <FooterColumnHeading>Legal</FooterColumnHeading>
            <ul className="mt-4 space-y-3">
              <FooterLink to="/privacy" label="Privacy Policy" />
              <FooterLink to="/terms" label="Terms & Conditions" />
              <FooterLink to="/" hash="faqs" label="FAQ" />
            </ul>
          </div>

          <div className="lg:col-span-3">
            <FooterColumnHeading>Contact</FooterColumnHeading>
            <ul className="mt-4 space-y-3.5">
              <li>
                <a
                  href={`mailto:${FOOTER_CONTACT.email}`}
                  className="group flex items-start gap-3 text-sm text-white transition-colors hover:text-brand-light"
                >
                  <FooterContactIcon>
                    <Mail className="h-4 w-4" strokeWidth={2} />
                  </FooterContactIcon>
                  <span className="pt-1.5 leading-snug">{FOOTER_CONTACT.email}</span>
                </a>
              </li>
              {FOOTER_CONTACT.phones.map((phone) => (
                <li key={phone}>
                  <a
                    href={toTelHref(phone)}
                    className="group flex items-start gap-3 text-sm text-white transition-colors hover:text-brand-light"
                  >
                    <FooterContactIcon>
                      <Phone className="h-4 w-4" strokeWidth={2} />
                    </FooterContactIcon>
                    <span className="pt-1.5 leading-snug">{phone}</span>
                  </a>
                </li>
              ))}
              <li className="flex items-start gap-3 text-sm text-white">
                <FooterContactIcon>
                  <MapPin className="h-4 w-4" strokeWidth={2} />
                </FooterContactIcon>
                <span className="pt-1.5 leading-relaxed">{FOOTER_CONTACT.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-8 border-t border-border pt-3 text-center text-[11px] text-white/90">
          © {new Date().getFullYear()} All rights reserved @ Crown Ev Center
        </p>
      </div>
    </footer>
  );
}

export function ScrollToTop() {
  const visible = useScrollPast(320);

  if (!visible) return null;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      className="fixed bottom-5 left-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-alt text-accent shadow-[var(--shadow-card)] transition-colors hover:border-accent hover:bg-accent hover:text-white sm:bottom-5 sm:left-auto sm:right-5"
    >
      <ChevronUp className="h-5 w-5" />
    </motion.button>
  );
}
