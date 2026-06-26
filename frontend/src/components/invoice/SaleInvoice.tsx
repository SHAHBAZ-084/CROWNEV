import { useRef, useState } from 'react';
import { Check, Download, Printer } from 'lucide-react';
import type { InvoiceData } from '../../types';
import { formatPKR, formatDate } from '../../lib/format';
import { captureInvoiceElement, openPrintWindow, saveCanvasAsPdf } from '../../lib/invoiceCapture';
import { Button } from '../ui/Button';
import { Logo } from '../brand/Logo';

function paymentLabel(method: InvoiceData['paymentMethod'], status: InvoiceData['paymentStatus']) {
  if (method === 'CASH') return 'Paid in Cash';
  if (status === 'APPROVED' || status === 'PAID') return 'Paid via Bank Transfer, verified';
  return 'Bank Transfer, pending verification';
}

function showPaidStamp(data: InvoiceData) {
  return data.paymentStatus === 'PAID' || data.paymentStatus === 'APPROVED';
}

export function SaleInvoice({
  data,
  showActions = true,
}: {
  data: InvoiceData;
  showActions?: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function downloadPdf() {
    if (!printRef.current) return;
    setExportError('');
    setDownloading(true);
    try {
      const canvas = await captureInvoiceElement(printRef.current);
      await saveCanvasAsPdf(canvas, `invoice-${data.invoiceNumber}.pdf`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  }

  async function handlePrint() {
    if (!printRef.current) return;
    setExportError('');
    setPrinting(true);
    try {
      const canvas = await captureInvoiceElement(printRef.current);
      openPrintWindow(canvas, data.invoiceNumber);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to open print preview');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div>
      {showActions && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" loading={printing} onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button type="button" variant="accent" size="sm" loading={downloading} onClick={downloadPdf}>
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
        </div>
      )}
      {exportError && <p className="mb-3 text-sm text-warning">{exportError}</p>}

      <div
        id="invoice-print-area"
        ref={printRef}
        className="print-area rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-700 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="!h-10 !max-w-[140px]" />
            <div>
              <p className="font-semibold text-slate-900">{data.branch.name}</p>
              <p className="text-xs text-slate-500">{data.branch.location}</p>
              <p className="text-xs text-slate-500">Phone: {data.branch.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-orange-500">SALE INVOICE</p>
            <p className="font-mono text-xs text-slate-500">{data.invoiceNumber}</p>
            <p className="text-xs text-slate-500">{formatDate(data.date)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Billed To</p>
            <p className="font-medium text-slate-900">{data.customer.name}</p>
            {data.customer.phone && <p className="text-slate-500">{data.customer.phone}</p>}
            {data.customer.email && <p className="text-slate-500">{data.customer.email}</p>}
            {data.customer.address && <p className="text-slate-500">{data.customer.address}</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Order Info</p>
            {data.orderType === 'POS' ? (
              data.saleReference && (
                <p><span className="text-slate-500">Reference:</span> <span className="font-mono">{data.saleReference}</span></p>
              )
            ) : (
              data.trackingId && (
                <p><span className="text-slate-500">Tracking:</span> <span className="font-mono">{data.trackingId}</span></p>
              )
            )}
            <p><span className="text-slate-500">Payment:</span> {data.paymentMethod.replace('_', ' ')}</p>
            <p><span className="text-slate-500">Status:</span> {data.status}</p>
            {data.biltyTrackingId && (
              <p><span className="text-slate-500">Bilty:</span> {data.biltyTrackingId}</p>
            )}
          </div>
        </div>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Unit Price</th>
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200 align-top">
                <td className="px-2 py-3">{idx + 1}</td>
                <td className="px-2 py-3">
                  <p className="font-medium text-slate-900">{item.name}</p>
                  {item.color && <p className="text-xs text-slate-500">Color: {item.color}</p>}
                  {item.chassisNumber && (
                    <p className="text-xs text-slate-500">Chassis: {item.chassisNumber}</p>
                  )}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="px-2 py-3 text-right tabular-nums">{formatPKR(item.unitPrice)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{formatPKR(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="tabular-nums text-slate-900">{formatPKR(data.subtotal)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums text-orange-500">{formatPKR(data.total)}</span>
            </div>
          </div>
        </div>

        {showPaidStamp(data) && (
          <div className="mx-auto mt-8 max-w-md rounded-xl border-2 border-success bg-success/5 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-success">
              <Check className="h-5 w-5" />
              <span className="text-lg font-bold">AMOUNT PAID</span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums">{formatPKR(data.total)}</p>
            <p className="text-sm text-slate-500">{paymentLabel(data.paymentMethod, data.paymentStatus)}</p>
          </div>
        )}

      </div>
    </div>
  );
}

export function InvoiceModalContent({
  loading,
  invoice,
  error,
}: {
  loading: boolean;
  invoice: InvoiceData | null;
  error?: string;
}) {
  if (loading) return <p className="py-8 text-center text-slate-500">Loading invoice…</p>;
  if (error) return <p className="py-8 text-center text-warning">{error}</p>;
  if (!invoice) return null;
  if (!invoice.invoiceAvailable) {
    return (
      <p className="py-8 text-center text-slate-500">
        Invoice pending. Available once the order is delivered and payment is verified.
      </p>
    );
  }
  return <SaleInvoice data={invoice} />;
}
