import type { ServiceInvoiceData } from '../../types';
import { formatPKR, formatDate } from '../../lib/format';

function Rule({ char = '*' }: { char?: string }) {
  const line = char.repeat(24);
  return <p className="my-1.5 text-center text-[9px] tracking-normal text-black">{line}</p>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-0.5 text-[10px] text-black">
      <span className="shrink-0">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  );
}

/** Inline 72mm thermal-style preview — matches print receipt layout. */
export function ServiceThermalReceiptPreview({ data }: { data: ServiceInvoiceData }) {
  return (
    <div className="mx-auto w-full max-w-[72mm] border border-dashed border-border bg-white px-2 py-3 font-mono text-black shadow-sm">
      <p className="text-center text-sm font-bold tracking-widest">CROWN EV</p>
      <p className="text-center text-[10px]">{data.branch.name}</p>
      <p className="text-center text-[10px]">{data.branch.location}</p>
      {data.branch.phone && <p className="text-center text-[10px]">Tel. {data.branch.phone}</p>}

      <Rule />
      <p className="text-center text-[11px] font-bold tracking-widest">SERVICE INVOICE</p>
      <Rule />

      <DetailRow label="Invoice #" value={data.invoiceNumber} />
      <DetailRow label="Reference" value={data.reference} />
      <DetailRow label="Date" value={formatDate(data.date)} />

      <Rule char="-" />

      <DetailRow label="Customer" value={data.customer.name} />
      {data.customer.phone && <DetailRow label="Phone" value={data.customer.phone} />}

      {data.items.length > 0 && (
        <>
          <Rule char="-" />
          <p className="text-center text-[11px] font-bold tracking-widest">PARTS USED</p>
          {data.items.map((item, i) => (
            <div key={i} className="border-b border-dashed border-gray-300 py-1 text-[9px]">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="font-bold">{formatPKR(item.total)}</span>
              </div>
              <p className="text-[8px] text-gray-700">
                x{item.quantity} @ {formatPKR(item.unitPrice)}
              </p>
            </div>
          ))}
          <DetailRow label="Parts subtotal" value={formatPKR(data.partsTotal)} />
        </>
      )}

      {data.labourCost > 0 && (
        <>
          <Rule char="-" />
          <DetailRow label="Labour cost" value={formatPKR(data.labourCost)} />
        </>
      )}

      {data.notes?.trim() && (
        <>
          <Rule char="-" />
          <DetailRow label="Notes" value={data.notes.trim()} />
        </>
      )}

      <Rule />
      <p className="text-center text-[11px] font-bold tracking-widest">TOTAL DUE</p>
      <p className="text-center text-base font-bold">{formatPKR(data.total)}</p>
      <p className="text-center text-[9px]">Payment due on collection</p>

      <Rule />
      <p className="text-center text-[9px]">Keep this receipt</p>
      <p className="text-center text-xs font-bold tracking-wide">THANK YOU!</p>
    </div>
  );
}
