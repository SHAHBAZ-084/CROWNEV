import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Mail, MapPin, Phone, Send, CheckCircle2 } from 'lucide-react';
import { publicApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import type { Branch } from '../../types';
import { PageHero } from '../../components/public/PageHero';
import { BranchCardsSection } from '../../components/public/BranchCard';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import { FOOTER_CONTACT, toTelHref } from '../../lib/placeholders';



function ContactInfoCard({
  icon: Icon,
  label,
  value,
  phones,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value?: string;
  phones?: readonly string[];
  href?: string;
}) {
  const content = (
    <div className="flex gap-4 rounded-[var(--radius-card)] border border-border-light bg-elevated p-5 shadow-[var(--shadow-elevated)] transition-shadow hover:shadow-[var(--shadow-elevated-hover)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {phones ? (
          <ul className="mt-1 space-y-1">
            {phones.map((phone) => (
              <li key={phone}>
                <a
                  href={toTelHref(phone)}
                  className="text-sm leading-relaxed text-ink-muted transition-colors hover:text-brand"
                >
                  {phone}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{value}</p>
        )}
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
  const [contact, setContact] = useState<{
    email: string;
    phones: string[] | readonly string[];
    phone: string;
    whatsapp: string;
    address: string;
    whatsappMessage: string;
  }>(FOOTER_CONTACT);

  useEffect(() => {
    Promise.all([
      publicApi.branches({ visibleOnly: true }),
      publicApi.footerContact()
    ])
      .then(([branchesData, contactData]) => {
        setBranches(branchesData);
        setContact({
          email: contactData.email,
          phones: contactData.phones,
          phone: contactData.phones[0] || '',
          whatsapp: contactData.phones[0] || '',
          address: contactData.address,
          whatsappMessage: FOOTER_CONTACT.whatsappMessage,
        });
      })
      .catch(console.error);
  }, []);

  const contactCards = [
    {
      icon: MapPin,
      label: 'Head Office',
      value: contact.address,
      href: undefined,
    },
    {
      icon: Mail,
      label: 'Email Us',
      value: contact.email,
      href: `mailto:${contact.email}`,
    },
    {
      icon: Phone,
      label: 'Call Us',
      phones: contact.phones,
    },
    {
      icon: Clock,
      label: 'Business Hours',
      value: 'Mon to Sat, 10:00 AM to 8:00 PM PKT',
      href: undefined,
    },
  ] as const;

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
      <div className="bg-subtle">
        <section className="mx-auto max-w-2xl px-4 py-16 text-center lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <CheckCircle2 className="h-7 w-7 text-accent" strokeWidth={2.25} />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Thank You</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-ink lg:text-4xl">Message Received</h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted lg:text-base">
              A confirmation has been sent to your email. Our team will get back to you within 24 hours.
            </p>

            <div className="mx-auto mt-8 max-w-lg rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)] lg:p-8">
              <p className="text-sm leading-relaxed text-ink-muted">
                Check your inbox for a copy of your message. In the meantime, browse our shop or book a service at
                your nearest branch.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                <Link to="/shop" className="w-full sm:w-auto">
                  <Button variant="accent" size="md" className="w-full sm:w-auto">
                    Browse Shop
                  </Button>
                </Link>
                <Link to="/book-service" className="w-full sm:w-auto">
                  <Button variant="secondary" size="md" className="w-full sm:w-auto">
                    Book Service
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
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

      <section className="bg-subtle py-12 lg:py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2 lg:gap-14 lg:px-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Reach Our Team
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink lg:text-3xl">
              We&apos;re Here to Help
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted lg:text-base">
              Whether you need help choosing an electric bike, booking a service appointment, or
              following up on an order. Reach out and a Crown Ev team member will respond promptly.
            </p>

            <div className="mt-8 space-y-4">
              {contactCards.map((card) => (
                <ContactInfoCard key={card.label} {...card} />
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
          >
            <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)] lg:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Send a Message
              </p>
              <h2 className="mt-2 font-display text-xl font-bold text-ink lg:text-2xl">
                Tell Us What You Need
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
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
        className="bg-elevated"
        tone="light"
      />
    </div>
  );
}
