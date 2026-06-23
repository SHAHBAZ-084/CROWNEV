import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { publicApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import type { Branch } from '../../types';
import { PageHero } from '../../components/public/PageHero';
import { BranchCardsSection } from '../../components/public/BranchCard';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { FOOTER_CONTACT } from '../../lib/placeholders';

const CONTACT_CARDS = [
  {
    icon: MapPin,
    label: 'Head Office',
    value: FOOTER_CONTACT.address,
    href: undefined,
  },
  {
    icon: Mail,
    label: 'Email Us',
    value: FOOTER_CONTACT.email,
    href: `mailto:${FOOTER_CONTACT.email}`,
  },
  {
    icon: Phone,
    label: 'Call Us',
    value: FOOTER_CONTACT.phone,
    href: `tel:${FOOTER_CONTACT.phone.replace(/\s/g, '')}`,
  },
  {
    icon: Clock,
    label: 'Business Hours',
    value: 'Mon to Sat, 10:00 AM to 8:00 PM PKT',
    href: undefined,
  },
] as const;

function ContactInfoCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex gap-4 rounded-[var(--radius-card)] border border-border bg-white p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-brand">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }
  return content;
}

export default function ContactPage() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    publicApi.branches().then(setBranches).catch(console.error);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await publicApi.contact({
        name: String(fd.get('name')),
        email: String(fd.get('email')),
        phone: String(fd.get('phone') ?? ''),
        message: String(fd.get('message')),
      });
      setSent(true);
      toast('Message sent! Check your email for a confirmation.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div>
        <PageHero
          page="contact"
          eyebrow="Thank You"
          title="Message Received"
          subtitle="A confirmation has been sent to your email. Our team will get back to you within 24 hours."
        />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-text-muted">
            Check your inbox for a copy of your message. In the meantime, browse our shop or track an existing order.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/shop"
              className="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Browse Shop
            </Link>
            <Link
              to="/track"
              className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-semibold text-brand hover:bg-surface-alt"
            >
              Track Order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHero
        page="contact"
        eyebrow="Get in Touch"
        title="Contact Us"
        subtitle="Questions about electric bikes, service bookings, orders, or branch locations? We're ready to help."
      />

      <section className="bg-surface-alt/60 py-12 lg:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2 lg:gap-14 lg:px-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Reach Our Team
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-brand lg:text-3xl">
              We&apos;re Here to Help
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-text-muted lg:text-base">
              Whether you need help choosing an electric bike, booking a service appointment, or
              following up on an order. Reach out and a Crown Ev team member will respond promptly.
            </p>

            <div className="mt-8 space-y-4">
              {CONTACT_CARDS.map((card) => (
                <ContactInfoCard key={card.label} {...card} />
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
          >
            <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)] lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Send a Message
              </p>
              <h2 className="mt-2 font-display text-xl font-bold text-brand lg:text-2xl">
                Tell Us What You Need
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                Fill in the form below and a member of our team will be in touch shortly.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input name="name" label="Your Name" required placeholder="Full name" />
                  <Input name="email" label="Email Address" type="email" required placeholder="you@example.com" />
                </div>
                <Input name="phone" label="Phone Number" placeholder="+92 300 0000000" />
                <Textarea
                  name="message"
                  label="Message"
                  rows={5}
                  required
                  placeholder="How can we help you?"
                />
                <Button type="submit" variant="accent" size="lg" className="w-full" loading={loading}>
                  <Send className="h-4 w-4" /> Send Message
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      <BranchCardsSection
        branches={branches}
        eyebrow="Visit us"
        title="Our Branches"
        subtitle="Walk in for test rides, servicing, and genuine parts at any Crown Ev location."
        showDescription
        className="bg-gradient-to-b from-white to-surface-alt/40"
      />
    </div>
  );
}
