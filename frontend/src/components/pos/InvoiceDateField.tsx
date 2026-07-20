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

function formatInvoiceListDate(row: Record<string, unknown>) {
  return String(row.invoiceDate ?? row.createdAt).slice(0, 10);
}

export { formatInvoiceListDate };
