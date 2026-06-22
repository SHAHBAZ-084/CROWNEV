import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Printer } from 'lucide-react';
import type { PurchaseInvoiceData } from '../../types';
import { formatPKR, formatDate } from '../../lib/format';
import { Button } from '../ui/Button';
import { Logo } from '../brand/Logo';

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        }),
    ),
  );
}

async function captureInvoiceElement(source: HTMLElement): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;background:#fff;z-index:-1';
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.boxShadow = 'none';
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    await waitForImages(clone);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 800,
      windowWidth: 800,
      logging: false,
    });
  } finally {
    host.remove();
  }
}

function openPrintWindow(canvas: HTMLCanvasElement, title: string) {
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!win) {
    throw new Error('Please allow pop-ups to print or save the invoice');
  }
  win.document.write(`<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; justify-content: center; padding: 16px; }
  img { width: 100%; max-width: 800px; height: auto; }
  @media print { body { padding: 0; } img { max-width: 100%; } }
</style></head>
<body><img src="${dataUrl}" alt="Invoice" /></body></html>`);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

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
      const imgData = canvas.toDataURL('image/png');
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, w, Math.min(h, pageH));
      pdf.save(`purchase-${data.invoiceNumber}.pdf`);
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
            <p className="text-lg font-bold text-accent">PURCHASE INVOICE</p>
            <p className="font-mono text-xs text-text-muted">{data.invoiceNumber}</p>
            <p className="text-xs text-text-muted">{formatDate(data.date)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Purchased From</p>
            <p className="font-medium">{data.supplier.name}</p>
            {data.supplier.contactPerson && (
              <p className="text-text-muted">Contact: {data.supplier.contactPerson}</p>
            )}
            {data.supplier.phone && <p className="text-text-muted">{data.supplier.phone}</p>}
            {data.supplier.email && <p className="text-text-muted">{data.supplier.email}</p>}
            {data.supplier.address && <p className="text-text-muted">{data.supplier.address}</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Invoice Info</p>
            {data.reference && (
              <p><span className="text-text-muted">Reference:</span> <span className="font-mono">{data.reference}</span></p>
            )}
            {data.notes && (
              <p className="mt-1"><span className="text-text-muted">Notes:</span> {data.notes}</p>
            )}
          </div>
        </div>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-border bg-surface-alt/50 text-left text-xs uppercase text-text-muted">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Unit Cost</th>
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
                  {item.chassisNumber && (
                    <p className="text-xs text-text-muted">Chassis: {item.chassisNumber}</p>
                  )}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="px-2 py-3 text-right tabular-nums">{formatPKR(item.unitCost)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{formatPKR(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span className="tabular-nums">{formatPKR(data.subtotal)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums text-brand">{formatPKR(data.total)}</span>
            </div>
          </div>
        </div>

        <p className="mt-8 border-t border-border pt-4 text-center text-xs text-text-muted">
          This document is proof of purchase. Generated by Crown EV Management System.
        </p>
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
