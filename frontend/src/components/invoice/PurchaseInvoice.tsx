import { useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { PurchaseInvoiceData } from '../../types';
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
import { ProductItemMetaLines } from '../../lib/productItemMeta';

export function PurchaseInvoice({
  data,
  showActions = true,
}: {
  data: PurchaseInvoiceData;
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
      await saveCanvasAsPdf(canvas, `purchase-${data.invoiceNumber}.pdf`);
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
        id="purchase-invoice-print-area"
        ref={printRef}
        className={invoicePrintArea}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-300 pb-4">
          <div className="flex items-start gap-4">
            <Logo size={invoiceLogoSize} className={invoiceLogoClass} />
            <div>
              <p className="font-semibold text-slate-900">{data.branch.name}</p>
              <p className={invoiceMetaText}>{data.branch.location}</p>
              <p className={invoiceMetaText}>Phone: {data.branch.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-orange-500">PURCHASE INVOICE</p>
            <p className={`font-mono ${invoiceMetaText}`}>{data.invoiceNumber}</p>
            <p className={invoiceMetaText}>{formatDate(data.date)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className={invoiceSectionLabel}>Purchased From</p>
            <p className="font-medium text-slate-900">{data.supplier.name}</p>
            {data.supplier.contactPerson && (
              <p className={invoiceFieldLabel}>Contact: {data.supplier.contactPerson}</p>
            )}
            {data.supplier.phone && <p className={invoiceFieldLabel}>{data.supplier.phone}</p>}
            {data.supplier.email && <p className={invoiceFieldLabel}>{data.supplier.email}</p>}
            {data.supplier.address && <p className={invoiceFieldLabel}>{data.supplier.address}</p>}
          </div>
          <div>
            <p className={invoiceSectionLabel}>Invoice Info</p>
            {data.reference && (
              <p><span className={invoiceFieldLabel}>Reference:</span> <span className={`font-mono ${invoiceFieldValue}`}>{data.reference}</span></p>
            )}
            {data.notes && (
              <p className="mt-1"><span className={invoiceFieldLabel}>Notes:</span> <span className={invoiceFieldValue}>{data.notes}</span></p>
            )}
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-sm">
          <thead>
            <tr className={invoiceTableHead}>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Product</th>
              <th className="px-2 py-1.5 text-right">Qty</th>
              <th className="px-2 py-1.5 text-right">Unit Cost</th>
              <th className="px-2 py-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-200 align-top">
                <td className={`px-2 py-2 ${invoiceTableCell}`}>{idx + 1}</td>
                <td className="px-2 py-2">
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <ProductItemMetaLines item={item} subtextClassName={invoiceSubtext} />
                  <p className={invoiceSubtext}>{item.type}</p>
                  {item.chassisNumber && !item.bikeUnits?.length && (
                    <p className={invoiceSubtext}>Chassis number: {item.chassisNumber}</p>
                  )}
                  {item.bikeUnits && item.bikeUnits.length > 0 && (
                    <div className={invoiceSubtext}>
                      {item.bikeUnits.map((u, uIdx) => (
                        <p key={uIdx}>
                          Chassis: {u.chassisNumber}
                          {u.engineNumber ? ` · Engine: ${u.engineNumber}` : ''}
                          {u.motorNumber ? ` · Motor: ${u.motorNumber}` : ''}
                          {u.color ? ` · Color: ${u.color}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </td>
                <td className={`px-2 py-2 text-right tabular-nums ${invoiceTableCell}`}>{item.quantity}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${invoiceTableCell}`}>{formatPKR(item.unitCost)}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${invoiceTableCell}`}>{formatPKR(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className={invoiceTotalsLabel}>Subtotal</span>
              <span className={`tabular-nums ${invoiceFieldValue}`}>{formatPKR(data.subtotal)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums text-orange-500">{formatPKR(data.total)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export function PurchaseInvoiceModalContent({
  loading,
  invoice,
  error,
}: {
  loading: boolean;
  invoice: PurchaseInvoiceData | null;
  error?: string;
}) {
  if (loading) return <p className="py-8 text-center text-text-muted">Loading invoice…</p>;
  if (error) return <p className="py-8 text-center text-warning">{error}</p>;
  if (!invoice) return null;
  if (!invoice.invoiceAvailable) {
    return <p className="py-8 text-center text-text-muted">Invoice not available.</p>;
  }
  return <PurchaseInvoice data={invoice} />;
}
