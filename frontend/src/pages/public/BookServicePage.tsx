import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getLoginUrl } from '../../lib/authRedirect';
import { useToast } from '../../contexts/ToastContext';
import { customerApi, publicApi } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Input';
import { PageHero } from '../../components/public/PageHero';
import { PageHeader } from '../../components/layout/PageTransition';
import { MotionSection } from '../../components/public/MotionSection';

export default function BookServicePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    publicApi.branches({ visibleOnly: true }).then(setBranches).catch(console.error);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) { navigate(getLoginUrl('/book-service')); return; }
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await customerApi.createBooking({
        branchId: parseInt(branchId, 10),
        notes: String(fd.get('notes') ?? '').trim() || undefined,
      });
      toast('Booking request submitted!', 'success');
      navigate('/customer/bookings');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Booking failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  const isCustomerDashboard = user?.role === 'CUSTOMER';

  return (
    <div>
      {isCustomerDashboard ? (
        <PageHeader
          title="Book a Service"
          subtitle="Request maintenance or repair at your nearest branch. We'll confirm your appointment."
        />
      ) : (
        <PageHero
          page="bookService"
          eyebrow="Crown Ev Service"
          title="Book a Service"
          subtitle="Request maintenance or repair at your nearest branch. We'll confirm your appointment."
        />
      )}

      <div className={isCustomerDashboard ? '' : 'bg-subtle'}>
        <MotionSection as="div" className={`mx-auto max-w-xl ${isCustomerDashboard ? '' : 'px-4 pb-16 pt-8 lg:px-8'}`}>
          {!user && (
            <div className="mb-6 rounded-xl border border-border-light bg-elevated p-4 text-sm text-ink-muted">
              Please <a href={getLoginUrl('/book-service')} className="font-medium text-brand hover:text-brand-light">sign in</a> to book a service.
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-[var(--radius-card)] border border-border-light bg-elevated p-6 shadow-[var(--shadow-elevated)] lg:p-8"
          >
            <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>

            <Textarea label="Notes (optional)" name="notes" rows={3} placeholder="Describe your issue or request…" />

            <p className="text-xs text-ink-muted">
              Date and time will be assigned by the branch after they review your request.
            </p>

            <Button type="submit" variant="accent" size="lg" className="w-full" loading={loading} disabled={!user || !branchId}>
              Submit Request
            </Button>
          </form>
        </MotionSection>
      </div>
    </div>
  );
}
