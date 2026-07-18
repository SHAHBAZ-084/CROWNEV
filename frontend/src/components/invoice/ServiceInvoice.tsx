import { useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { ServiceInvoiceData } from '../../types';
import { formatPKR, formatDate } from '../../lib/format';
import { captureInvoiceElement, openPrintWindow, saveCanvasAsPdf } from '../../lib/invoiceCapture';
import { Button } from '../ui/Button';
import { Logo } from '../brand/Logo';
import {
  invoiceFieldLabel,
  invoiceFieldValue,
  invoiceLogoClass,
  invoiceLogoSize,
  invoiceMetaText,
  invoicePrintArea,
  invoiceSectionLabel,
  invoiceSubtext,
  invoiceTableCell,
  invoiceTableHead,
  invoiceTotalsLabel,
} from './invoiceStyles';

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
      await saveCanvasAsPdf(canvas, `service-${data.invoiceNumber}.pdf`);
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
        id="service-invoice-print-area"
        ref={printRef}
        className={invoicePrintArea}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-4">
          <div className="flex items-start gap-4">
            <Logo size={invoiceLogoSize} className={invoiceLogoClass} />
            <div>
              <p className="text-base font-semibold text-black">{data.branch.name}</p>
              <p className={invoiceMetaText}>{data.branch.location}</p>
              <p className={invoiceMetaText}>Phone: {data.branch.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-black">SERVICE INVOICE</p>
            <p className={`font-mono ${invoiceMetaText}`}>{data.invoiceNumber}</p>
            <p className={invoiceMetaText}>{formatDate(data.date)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className={invoiceSectionLabel}>Billed To</p>
            <p className="text-base font-medium text-black">{data.customer.name}</p>
            {data.customer.phone && <p className={invoiceFieldLabel}>{data.customer.phone}</p>}
            {data.customer.email && <p className={invoiceFieldLabel}>{data.customer.email}</p>}
            {data.customer.address && <p className={invoiceFieldLabel}>{data.customer.address}</p>}
          </div>
          <div>
            <p className={invoiceSectionLabel}>Invoice Info</p>
            <p><span className={invoiceFieldLabel}>Reference:</span> <span className={`font-mono ${invoiceFieldValue}`}>{data.reference}</span></p>
            {data.notes && <p><span className={invoiceFieldLabel}>Notes:</span> <span className={invoiceFieldValue}>{data.notes}</span></p>}
          </div>
        </div>

        {data.items.length > 0 && (
          <table className="mt-5 w-full border-collapse text-sm">
            <thead>
              <tr className={invoiceTableHead}>
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Part / Product</th>
                <th className="px-2 py-1.5 text-right">Qty</th>
                <th className="px-2 py-1.5 text-right">Unit Price</th>
                <th className="px-2 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-200 align-top">
                  <td className={`px-2 py-2 ${invoiceTableCell}`}>{idx + 1}</td>
                  <td className="px-2 py-2">
                    <p className="text-base font-medium text-black">{item.name}</p>
                    <p className={invoiceSubtext}>{item.type}</p>
                    {item.color && <p className={invoiceSubtext}>Color: {item.color}</p>}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${invoiceTableCell}`}>{item.quantity}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${invoiceTableCell}`}>{formatPKR(item.unitPrice)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${invoiceTableCell}`}>{formatPKR(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-3 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            {data.items.length > 0 && (
              <div className="flex justify-between">
                <span className={invoiceTotalsLabel}>Parts subtotal</span>
                <span className={`tabular-nums ${invoiceFieldValue}`}>{formatPKR(data.partsTotal)}</span>
              </div>
            )}
            {data.labourCost > 0 && (
              <div className="flex justify-between">
                <span className={invoiceTotalsLabel}>Labour cost</span>
                <span className={`tabular-nums ${invoiceFieldValue}`}>{formatPKR(data.labourCost)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-black">
              <span>Total</span>
              <span className="tabular-nums text-black">{formatPKR(data.total)}</span>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-3 text-center text-xs">
              Visit us on{' '}
              <a href="https://www.crownevcenter.com" className="font-semibold text-accent">
                www.crownevcenter.com
              </a>
            </div>
          </div>
        </div>

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
