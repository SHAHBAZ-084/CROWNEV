import type { Order } from '../types';
import { Badge } from '../components/ui/Badge';

const STEPS = [
  'AWAITING_BILTY_CHARGES',
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'CONFIRMED',
] as const;

const STEP_LABELS: Record<(typeof STEPS)[number], string> = {
  AWAITING_BILTY_CHARGES: 'Bilty charges',
  AWAITING_PAYMENT: 'Awaiting payment',
  PAYMENT_SUBMITTED: 'Awaiting verification',
  CONFIRMED: 'Confirmed',
};

export function orderStatusLabel(status: string): string {
  return STEP_LABELS[status as (typeof STEPS)[number]] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function OrderStatusTimeline({ status, shippingMethod }: { status: string; shippingMethod?: string | null }) {
  const cancelled = status === 'CANCELLED';
  const steps =
    shippingMethod === 'SELF'
      ? (['PAYMENT_SUBMITTED', 'CONFIRMED'] as const)
      : STEPS;
  const stepLabels =
    shippingMethod === 'SELF'
      ? { PAYMENT_SUBMITTED: 'Awaiting verification', CONFIRMED: 'Confirmed' }
      : STEP_LABELS;

  const currentIdx = cancelled ? -1 : steps.indexOf(status as (typeof steps)[number]);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => {
        const done = !cancelled && currentIdx >= 0 && idx <= currentIdx;
        const active = !cancelled && idx === currentIdx;
        const label = stepLabels[step as keyof typeof stepLabels] ?? step;
        return (
          <div key={step} className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  done ? 'bg-success text-white' : 'bg-slate-200 text-slate-500'
                } ${active ? 'ring-2 ring-success/40' : ''}`}
              >
                {idx + 1}
              </div>
              <span className={`text-center text-[10px] capitalize sm:text-xs ${active ? 'font-semibold text-orange-500' : 'text-slate-500'}`}>
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`mb-5 h-0.5 flex-1 ${done && idx < currentIdx ? 'bg-success' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
      {cancelled && (
        <span className="ml-2 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
          Cancelled
        </span>
      )}
    </div>
  );
}

export function orderCustomerName(order: Order): string {
  if (order.user) return `${order.user.firstName} ${order.user.lastName}`.trim();
  if (order.customer?.name) return order.customer.name;
  return order.customerName ?? '';
}

export function orderItemsSummary(order: Order): string {
  const items = order.items ?? [];
  if (items.length === 0) return '';
  const first = items[0].product?.name ?? 'Item';
  if (items.length === 1) return first;
  return `${first} +${items.length - 1} more`;
}

export function orderReference(order: Pick<Order, 'id' | 'publicId' | 'saleReference'>): string {
  if (order.saleReference?.trim()) return order.saleReference.trim();
  if (order.publicId) return `#${order.publicId.slice(0, 8).toUpperCase()}`;
  return `#${order.id}`;
}

export function isInvoiceAvailable(order: Order): boolean {
  return (
    order.status === 'CONFIRMED' &&
    (order.paymentStatus === 'APPROVED' || order.paymentStatus === 'PAID')
  );
}

export function needsCustomerPayment(order: Order): boolean {
  if (order.status === 'AWAITING_PAYMENT') return true;
  if (
    order.shippingMethod === 'SELF' &&
    order.status === 'PAYMENT_SUBMITTED' &&
    order.paymentStatus === 'REJECTED'
  ) {
    return true;
  }
  return false;
}

export function isAwaitingPaymentVerification(order: Order): boolean {
  return order.status === 'PAYMENT_SUBMITTED' && order.paymentStatus === 'PENDING';
}

export function formatPaymentStatus(order: Pick<Order, 'status' | 'paymentStatus'>): string {
  if (order.paymentStatus === 'APPROVED') return 'Verified';
  if (order.paymentStatus === 'REJECTED') return 'Rejected';
  if (order.paymentStatus === 'PAID') return 'Paid';
  if (isAwaitingPaymentVerification(order as Order)) return 'Awaiting verification';
  if (order.status === 'AWAITING_PAYMENT') return 'Payment required';
  return 'Pending';
}

export function paymentStatusVariant(
  order: Pick<Order, 'status' | 'paymentStatus'>,
): 'success' | 'warning' | 'info' | 'danger' | 'default' {
  if (order.paymentStatus === 'APPROVED' || order.paymentStatus === 'PAID') return 'success';
  if (order.paymentStatus === 'REJECTED') return 'danger';
  if (isAwaitingPaymentVerification(order as Order)) return 'warning';
  return 'warning';
}

export function PaymentStatusBadge({ order }: { order: Pick<Order, 'status' | 'paymentStatus'> }) {
  return <Badge variant={paymentStatusVariant(order)}>{formatPaymentStatus(order)}</Badge>;
}

export function isAwaitingBiltyCharges(order: Order): boolean {
  return order.status === 'AWAITING_BILTY_CHARGES';
}
