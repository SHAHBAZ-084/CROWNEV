import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { customerApi, publicApi } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { PageHero } from '../../components/public/PageHero';

export default function BookServicePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [services, setServices] = useState<{ id: number; name: string; basePrice: string; duration: number }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    publicApi.branches().then(setBranches).catch(console.error);
  }, []);

  useEffect(() => {
    if (branchId) {
      publicApi.services(parseInt(branchId, 10)).then(setServices).catch(console.error);
    } else setServices([]);
  }, [branchId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) { navigate('/login?redirect=/book-service'); return; }
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await customerApi.createBooking({
        branchId: parseInt(branchId, 10),
        serviceId: parseInt(String(fd.get('serviceId')), 10),
        date: String(fd.get('date')),
        time: String(fd.get('time')),
        notes: String(fd.get('notes') ?? ''),
      });
      toast('Service booked successfully!', 'success');
      navigate('/customer/bookings');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Booking failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHero
        page="bookService"
        title="Book a Service"
        subtitle="Maintenance, repair, or installation at your nearest branch"
      />

      <div className="mx-auto max-w-xl px-4 pb-16 pt-8 lg:px-8">
        {!user && (
          <div className="mb-6 rounded-xl border border-border bg-surface-alt p-4 text-sm text-text-muted">
            Please <a href="/login" className="text-brand-light font-medium">sign in</a> to book a service.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)]">
          <Select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>

          <Select label="Service" name="serviceId" required disabled={!branchId}>
            <option value="">Select service</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — PKR {Number(s.basePrice).toLocaleString()} ({s.duration} min)</option>
            ))}
          </Select>

          <Input label="Date" name="date" type="date" required />
          <Input label="Time" name="time" type="time" required />
          <Textarea label="Notes (optional)" name="notes" rows={3} />

          <Button type="submit" variant="accent" size="lg" className="w-full" loading={loading} disabled={!user}>
            Book Appointment
          </Button>
        </form>
      </div>
    </div>
  );
}
