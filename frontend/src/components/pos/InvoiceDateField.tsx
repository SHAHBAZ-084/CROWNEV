import { Input } from '../ui/Input';

type InvoiceDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function InvoiceDateField({ value, onChange }: InvoiceDateFieldProps) {
  return (
    <Input
      label="Invoice date (optional)"
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="Leave blank to use today's date"
    />
  );
}

export function formatIsoDateList(iso: string) {
  const raw = iso.slice(0, 10);
  const [y, m, d] = raw.split('-');
  if (!y || !m || !d) return raw;
  return `${d}-${m}-${y}`;
}

export function formatInvoiceListDate(row: Record<string, unknown>) {
  return formatIsoDateList(String(row.invoiceDate ?? row.createdAt));
}
