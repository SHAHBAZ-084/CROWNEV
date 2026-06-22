import { useRef, useState } from 'react';
import { Download, Printer, Receipt } from 'lucide-react';
import type { ServiceInvoiceData } from '../../types';
import { formatPKR, formatDate } from '../../lib/format';
import { captureInvoiceElement, openPrintWindow } from '../../lib/invoiceCapture';
import { downloadServiceInvoiceReceipt } from '../../lib/receiptDownload';
import { ServiceThermalReceiptPreview } from './ServiceThermalReceiptPreview';
import { Button } from '../ui/Button';
import { Logo } from '../brand/Logo';

export function ServiceInvoice({
  data,
  showActions = true,
}: {
  data: ServiceInvoiceData;
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
      const imgData = canvas.toDataURL('image/png');
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, w, Math.min(h, pageH));
      pdf.save(`service-${data.invoiceNumber}.pdf`);
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
          <Button type="button" variant="secondary" size="sm" onClick={() => downloadServiceInvoiceReceipt(data)}>
            <Receipt className="h-3.5 w-3.5" />
            Print Receipt
          </Button>
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

      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Thermal receipt</p>
        <ServiceThermalReceiptPreview data={data} />
      </div>

      <div
        id="service-invoice-print-area"
        ref={printRef}
        className="print-area rounded-xl border border-border bg-white p-8 text-sm text-text shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="!h-10 !max-w-[140px]" />
            <div>
              <p className="font-semibold text-brand">{data.branch.name}</p>
              <p className="text-xs text-text-muted">{data.branch.location}</p>
              <p className="text-xs text-text-muted">Phone: {data.branch.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-accent">SERVICE INVOICE</p>
            <p className="font-mono text-xs text-text-muted">{data.invoiceNumber}</p>
            <p className="text-xs text-text-muted">{formatDate(data.date)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Billed To</p>
            <p className="font-medium">{data.customer.name}</p>
            {data.customer.phone && <p className="text-text-muted">{data.customer.phone}</p>}
            {data.customer.email && <p className="text-text-muted">{data.customer.email}</p>}
            {data.customer.address && <p className="text-text-muted">{data.customer.address}</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Invoice Info</p>
            <p><span className="text-text-muted">Reference:</span> <span className="font-mono">{data.reference}</span></p>
            {data.notes && <p><span className="text-text-muted">Notes:</span> {data.notes}</p>}
          </div>
        </div>

        {data.items.length > 0 && (
          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-surface-alt/50 text-left text-xs uppercase text-text-muted">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Part / Product</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Unit Price</th>
                <th className="px-2 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={idx} className="border-b border-border/40 align-top">
                  <td className="px-2 py-3">{idx + 1}</td>
                  <td className="px-2 py-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-text-muted">{item.type}</p>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatPKR(item.unitPrice)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatPKR(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            {data.items.length > 0 && (
              <div className="flex justify-between">
                <span className="text-text-muted">Parts subtotal</span>
                <span className="tabular-nums">{formatPKR(data.partsTotal)}</span>
              </div>
            )}
            {data.labourCost > 0 && (
              <div className="flex justify-between">
                <span className="text-text-muted">Labour cost</span>
                <span className="tabular-nums">{formatPKR(data.labourCost)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums text-brand">{formatPKR(data.total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-8 border-t border-border pt-4 text-center text-xs text-text-muted">
          This document is proof of service. Generated by Crown EV Management System.
          <br />
          Thank you for choosing Crown EV!
        </p>
      </div>
    </div>
  );
}

export function ServiceInvoiceModalContent({
  loading,
  invoice,
  error,
}: {
  loading: boolean;
  invoice: ServiceInvoiceData | null;
  error?: string;
}) {
  if (loading) return <p className="py-8 text-center text-text-muted">Loading invoice…</p>;
  if (error) return <p className="py-8 text-center text-warning">{error}</p>;
  if (!invoice) return null;
  if (!invoice.invoiceAvailable) {
    return <p className="py-8 text-center text-text-muted">Invoice not available.</p>;
  }
  return <ServiceInvoice data={invoice} />;
}
