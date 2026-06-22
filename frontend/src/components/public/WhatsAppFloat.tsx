import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FOOTER_CONTACT } from '../../lib/placeholders';

const DISMISS_KEY = 'crown-ev-whatsapp-dismissed';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function WhatsAppFloat() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const waDigits = FOOTER_CONTACT.whatsapp.replace(/\D/g, '');
  const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(FOOTER_CONTACT.whatsappMessage)}`;

  function hideWidget() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
    setOpen(false);
  }

  function restoreWidget() {
    localStorage.removeItem(DISMISS_KEY);
    setDismissed(false);
  }

  if (dismissed) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={restoreWidget}
        aria-label="Show WhatsApp chat"
        className="fixed bottom-24 right-0 z-50 flex items-center gap-1.5 rounded-l-full border border-border border-r-0 bg-white py-2 pl-3 pr-2 text-xs font-semibold text-[#25D366] shadow-[var(--shadow-card)] hover:bg-surface-alt"
      >
        <WhatsAppIcon className="h-4 w-4" />
        Chat
      </motion.button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 sm:right-5">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="w-[min(100vw-2.5rem,18rem)] overflow-hidden rounded-2xl border border-border bg-white shadow-[var(--shadow-card-hover)]"
          >
            <div className="bg-[#25D366] px-4 py-3 text-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-bold">Crown Eve Support</p>
                  <p className="text-xs text-white/90">Typically replies within an hour</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 hover:bg-white/15"
                  aria-label="Close WhatsApp panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <p className="text-sm leading-relaxed text-text-muted">
                Questions about bikes, orders, or service? Chat with us on WhatsApp.
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1fb855]"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Start Chat
              </a>
              <button
                type="button"
                onClick={hideWidget}
                className="w-full text-center text-xs text-text-muted hover:text-brand"
              >
                Hide WhatsApp button
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close WhatsApp' : 'Open WhatsApp chat'}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-[#25D366]/20 transition-shadow hover:shadow-xl"
      >
        {open ? <X className="h-6 w-6" /> : <WhatsAppIcon className="h-7 w-7" />}
      </motion.button>
    </div>
  );
}

export function WhatsAppNavLink({ className = '' }: { className?: string }) {
  const waDigits = FOOTER_CONTACT.whatsapp.replace(/\D/g, '');
  const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(FOOTER_CONTACT.whatsappMessage)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] transition-colors hover:text-[#1fb855] ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
      WhatsApp
    </a>
  );
}
