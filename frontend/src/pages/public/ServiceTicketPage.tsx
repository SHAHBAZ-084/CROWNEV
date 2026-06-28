import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Download, Ticket } from 'lucide-react';
import { publicApi } from '../../api/client';
import { PageHero } from '../../components/public/PageHero';
import { MotionSection } from '../../components/public/MotionSection';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { downloadBookingReceipt } from '../../lib/receiptDownload';
import { formatDate, formatTime } from '../../lib/format';

export default function ServiceTicketPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const bookingId = Number(id);
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [preview, setPreview] = useState<{
    date?: string | null;
    confirmedTime?: string | null;
    branch?: { name: string; location: string };
  } | null>(null);

  const loadTicket = useCallback(async (address: string, autoPrint = false) => {
    if (!bookingId || Number.isNaN(bookingId)) {
      setError('Invalid booking link.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const receipt = await publicApi.bookingTicket(bookingId, address.trim());
      setPreview({
        date: receipt.date as string | null,
        confirmedTime: receipt.confirmedTime as string | null,
        branch: receipt.branch as { name: string; location: string },
      });
      if (autoPrint) {
        downloadBookingReceipt(receipt);
        setDownloaded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load ticket');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    const fromEmail = searchParams.get('email');
    if (fromEmail && bookingId && !Number.isNaN(bookingId)) {
      setEmail(fromEmail);
      void loadTicket(fromEmail, true);
    }
  }, [searchParams, bookingId, loadTicket]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void loadTicket(email, true);
  }

  return (
    <div>
      <PageHero
        page="contact"
        eyebrow="Service Visit"
        title="Download Visit Ticket"
        subtitle="No login required. Confirm your email to open your printable ticket."
      />

      <MotionSection as="div" className="mx-auto max-w-lg px-4 pb-16 pt-4">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface-alt p-6 shadow-[var(--shadow-card)]">
          {bookingId && !Number.isNaN(bookingId) && (
            <p className="mb-4 text-sm text-text-muted">
              Booking reference: <strong className="text-brand">#{bookingId}</strong>
            </p>
          )}

          {downloaded && preview?.date && preview.confirmedTime && (
            <div className="mb-6 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm">
              <p className="font-medium text-brand">Ticket ready</p>
              <p className="mt-1 text-text-muted">
                {formatDate(String(preview.date))} at {formatTime(preview.confirmedTime)}
                {preview.branch ? ` · ${preview.branch.name}` : ''}
              </p>
              <p className="mt-2 text-xs text-text-muted">
                If the print window did not open, allow pop-ups and tap download again.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-warning">{error}</p>}
            <Input
              label="Email used for booking"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Button type="submit" variant="accent" className="w-full" loading={loading}>
              <Download className="h-4 w-4" />
              Download Visit Ticket
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-border bg-surface-alt/40 p-4 text-sm text-text-muted">
            <Ticket className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <p>
              Already signed in? Go to{' '}
              <Link to="/login?redirect=%2Fcustomer%2Fbookings" className="font-medium text-brand-light hover:underline">
                My Bookings
              </Link>{' '}
              in your customer dashboard.
            </p>
          </div>
        </div>
      </MotionSection>
    </div>
  );
}
