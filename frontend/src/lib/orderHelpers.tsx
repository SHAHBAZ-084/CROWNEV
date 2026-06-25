import type { Order } from '../types';

const STEPS = ['PENDING', 'CONFIRMED', 'DELIVERED'] as const;

export function OrderStatusTimeline({ status }: { status: string }) {
  const cancelled = status === 'CANCELLED';
  const currentIdx = cancelled ? -1 : STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, idx) => {
        const done = !cancelled && idx <= currentIdx;
        const active = !cancelled && idx === currentIdx;
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
              <span className={`text-xs capitalize ${active ? 'font-semibold text-orange-500' : 'text-slate-500'}`}>
                {step.toLowerCase()}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
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

export function isInvoiceAvailable(order: Order): boolean {
  return (
    order.status === 'DELIVERED' ||
    (order.status === 'CONFIRMED' && order.paymentStatus === 'APPROVED') ||
    order.paymentStatus === 'PAID'
  );
}
