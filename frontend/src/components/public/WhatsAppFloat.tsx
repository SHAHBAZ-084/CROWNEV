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
        className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] right-0 z-50 flex items-center gap-1.5 rounded-l-full border border-border border-r-0 bg-surface-alt py-2 pl-3 pr-2 text-xs font-semibold text-[#25D366] shadow-[var(--shadow-card)] hover:bg-surface-alt"
      >
        <WhatsAppIcon className="h-4 w-4" />
        Chat
      </motion.button>
    );
  }

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 z-50 flex flex-col items-end gap-2 sm:bottom-20 sm:right-5 sm:gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="w-[min(calc(100vw-2rem),16rem)] overflow-hidden rounded-xl border border-border bg-surface-alt shadow-[var(--shadow-card-hover)] sm:w-[min(100vw-2.5rem,18rem)] sm:rounded-2xl"
          >
            <div className="bg-[#25D366] px-3 py-2 text-white sm:px-4 sm:py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-xs font-bold sm:text-sm">Crown Ev Support</p>
                  <p className="hidden text-xs text-white/90 sm:block">Typically replies within an hour</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-lg p-0.5 hover:bg-white/15 sm:p-1"
                  aria-label="Close WhatsApp panel"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 p-3 sm:space-y-3 sm:p-4">
              <p className="text-xs leading-snug text-text-muted sm:text-sm sm:leading-relaxed">
                Questions about bikes, orders, or service? Chat with us on WhatsApp.
              </p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1fb855] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <WhatsAppIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Start Chat
              </a>
              <button
                type="button"
                onClick={hideWidget}
                className="w-full py-0.5 text-center text-[11px] text-text-muted hover:text-brand sm:py-0 sm:text-xs"
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
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg ring-4 ring-[#25D366]/20 transition-shadow hover:shadow-xl sm:h-14 sm:w-14"
      >
        {open ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <WhatsAppIcon className="h-6 w-6 sm:h-7 sm:w-7" />}
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
