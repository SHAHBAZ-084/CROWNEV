import { type FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { publicApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';

export default function ContactPage() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await publicApi.contact({
        name: String(fd.get('name')),
        email: String(fd.get('email')),
        phone: String(fd.get('phone') ?? ''),
        message: String(fd.get('message')),
      });
      setSent(true);
      toast('Message sent!', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send', 'error');
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-success">Thank You!</h1>
        <p className="mt-2 text-text-muted">We&apos;ll get back to you within 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-brand">Contact Us</h1>
        <p className="mt-2 text-text-muted">Questions about bikes, service, or orders?</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Input name="name" label="Name" required />
          <Input name="email" label="Email" type="email" required />
          <Input name="phone" label="Phone" />
          <Textarea name="message" label="Message" rows={5} required />
          <Button type="submit" variant="accent" className="w-full">Send Message</Button>
        </form>
      </motion.div>
    </div>
  );
}
