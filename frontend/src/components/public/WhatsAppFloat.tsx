import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toWhatsAppHref } from '../../lib/placeholders';
import { WhatsAppIcon } from '../icons/BrandIcons';

const DISMISS_KEY = 'crown-ev-whatsapp-dismissed';

export function WhatsAppFloat() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const waUrl = toWhatsAppHref();

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
        className="fixed bottom-24 right-0 z-50 flex items-center gap-1.5 rounded-l-full border border-border border-r-0 bg-surface-alt py-2 pl-3 pr-2 text-xs font-semibold text-[#25D366] shadow-[var(--shadow-card)] hover:bg-surface-alt"
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
            className="w-[min(100vw-2.5rem,18rem)] overflow-hidden rounded-2xl border border-border bg-surface-alt shadow-[var(--shadow-card-hover)]"
          >
            <div className="bg-[#25D366] px-4 py-3 text-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-bold">Crown Ev Support</p>
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
  const waUrl = toWhatsAppHref();

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] transition-colors hover:text-[#1fb855] ${className}`}
    >
      <WhatsAppIcon className="h-4 w-4" />
      WhatsApp
    </a>
  );
}
