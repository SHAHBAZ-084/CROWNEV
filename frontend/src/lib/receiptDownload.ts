import html2canvasPro from 'html2canvas-pro';

function formatDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value: unknown): string {
  if (!value) return '';
  const s = String(value);
  const [h, m] = s.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return s;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m ?? '00'} ${ampm}`;
}

function esc(value: unknown): string {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasDisplayValue(value: unknown): boolean {
  return esc(value) !== '';
}

function row(label: string, value: string): string {
  return `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`;
}

const RECEIPT_WIDTH = '72mm';

const THERMAL_RECEIPT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { width: ${RECEIPT_WIDTH}; margin: 0 auto; }
  @page { size: ${RECEIPT_WIDTH} auto; margin: 3mm; }
  body {
    width: ${RECEIPT_WIDTH};
    max-width: ${RECEIPT_WIDTH};
    margin: 0 auto;
    font-family: "Courier New", Courier, monospace;
    font-size: 11px;
    line-height: 1.35;
    color: #000;
    background: #fff;
    padding: 8px 6px 16px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .center { text-align: center; }
  .shop { font-size: 14px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 2px; }
  .meta { font-size: 10px; line-height: 1.35; margin-bottom: 1px; }
  .rule { text-align: center; font-size: 9px; margin: 6px 0; letter-spacing: 0; overflow: hidden; }
  .bold { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; margin: 2px 0; }
  .big { font-size: 16px; font-weight: 700; margin: 4px 0 2px; color: #000; }
  .mid { font-size: 12px; font-weight: 700; margin-bottom: 2px; }
  .small { font-size: 9px; color: #000; margin: 2px 0; }
  table.details { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 10px; }
  table.details td { padding: 2px 0; vertical-align: top; color: #000; }
  table.details .label { width: 48%; color: #000; padding-right: 4px; }
  table.details .value { width: 52%; text-align: right; font-weight: 700; word-break: break-word; color: #000; }
  table.items { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 9px; }
  table.items td { padding: 3px 0; vertical-align: top; color: #000; border-bottom: 1px dashed #ccc; }
  table.items .name { width: 62%; padding-right: 4px; }
  table.items .amt { width: 38%; text-align: right; font-weight: 700; }
  .thanks { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; margin: 8px 0 4px; }
  .barcode {
    display: block; margin: 6px auto 0; height: 28px; width: 85%; max-width: 58mm;
    background: repeating-linear-gradient(90deg, #000 0 1.5px, #fff 1.5px 3px, #000 3px 4px, #fff 4px 6px);
  }
  @media screen {
    body { margin: 20px auto; box-shadow: 0 4px 20px rgb(0 0 0 / 15%); border: 1px solid #ddd; }
  }
  @media print {
    html, body {
      width: ${RECEIPT_WIDTH} !important;
      max-width: ${RECEIPT_WIDTH} !important;
      margin: 0 auto !important;
      padding: 4px 6px 12px !important;
      box-shadow: none !important;
      border: none !important;
    }
    table.details td, table.items td, .small, .big, .bold { color: #000 !important; }
  }
`;

/**
 * Renders a full thermal-receipt HTML document (72mm layout) into a real PDF —
 * not an .html file. Loads the markup into a hidden iframe so the receipt's
 * own <style> block applies exactly as written, captures it with html2canvas,
 * then sizes the PDF page to match the receipt's physical 72mm width (plus a
 * small margin) so it looks like an actual slip rather than a stamp in the
 * middle of a big blank page.
 */
async function downloadHtmlAsFile(html: string, filename: string) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:320px;height:600px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve) => {
      const doc = iframe.contentDocument;
      if (!doc) {
        resolve();
        return;
      }
      iframe.onload = () => resolve();
      doc.open();
      doc.write(html);
      doc.close();
    });

    // Layout settles on the next couple of frames — receipt uses system
    // monospace fonts only, so there's no web-font load to wait on.
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const body = iframe.contentDocument?.body;
    if (!body) throw new Error('Could not render the receipt for download');

    const canvas = await html2canvasPro(body, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    if (!canvas.width || !canvas.height) {
      throw new Error('Receipt capture is empty');
    }

    const { default: jsPDF } = await import('jspdf');

    // The receipt body is a fixed 72mm-wide thermal layout — match the PDF
    // page to that physical width exactly, with height following the
    // captured aspect ratio, plus a small margin all round.
    const contentWidthMm = 72;
    const marginMm = 4;
    const contentHeightMm = contentWidthMm * (canvas.height / canvas.width);
    const pageW = contentWidthMm + marginMm * 2;
    const pageH = contentHeightMm + marginMm * 2;

    const pdf = new jsPDF({ unit: 'mm', format: [pageW, pageH] });
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      marginMm,
      marginMm,
      contentWidthMm,
      contentHeightMm,
      undefined,
      'FAST',
    );
    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  } finally {
    iframe.remove();
  }
}

function formatPkrReceipt(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'PKR 0';
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function thermalHeader(branch: { name: string; location: string; phone?: string | null }, title: string) {
  return `
  <p class="center shop">CROWN EV</p>
  <p class="center meta">${esc(branch.name)}</p>
  <p class="center meta">${esc(branch.location)}</p>
  ${hasDisplayValue(branch.phone) ? `<p class="center meta">Tel. ${esc(branch.phone)}</p>` : ''}
  <div class="rule">************************</div>
  <p class="center bold">${title}</p>
  <div class="rule">************************</div>`;
}

function thermalFooter(refLabel: string) {
  return `
  <div class="rule">************************</div>
  <p class="center small">${esc(refLabel)}</p>
  <p class="center thanks">THANK YOU!</p>
  <div class="barcode" aria-hidden="true"></div>`;
}

export async function downloadBookingReceipt(receipt: Record<string, unknown>) {
  const branch = (receipt.branch ?? {}) as Record<string, unknown>;
  const customer = (receipt.customer ?? {}) as Record<string, unknown>;
  const service = (receipt.service ?? {}) as Record<string, unknown>;
  const visitDate = receipt.date;
  const visitTime = receipt.confirmedTime ?? receipt.time;
  const hasVisitSchedule = Boolean(visitDate && visitTime);

  const serviceName = esc(service.name ?? 'Service request');
  const serviceDuration = service.duration ? ` (${esc(service.duration)} min)` : '';

  const scheduleBlock = hasVisitSchedule
    ? `<div class="rule">************************</div>
  <p class="center bold">SCHEDULED VISIT</p>
  <p class="center big">${formatTime(visitTime)}</p>
  <p class="center mid">${formatDate(visitDate)}</p>
  <p class="center small">Arrive on time</p>`
    : `<div class="rule">************************</div>
  <p class="center small">Visit pending</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${RECEIPT_WIDTH}, initial-scale=1" />
  <title>Booking #${esc(receipt.bookingId)}</title>
  <style>${THERMAL_RECEIPT_CSS}</style>
</head>
<body>
  ${thermalHeader(branch as { name: string; location: string; phone?: string }, 'SERVICE BOOKING')}

  <table class="details">
    ${row('Booking #', esc(receipt.bookingId))}
    ${row('Status', esc(receipt.status))}
  </table>

  <div class="rule">------------------------</div>

  <table class="details">
    ${row('Customer', esc(customer.name))}
    ${hasDisplayValue(customer.phone) ? row('Phone', esc(customer.phone)) : ''}
    ${row('Service', `${serviceName}${serviceDuration}`)}
  </table>

  ${scheduleBlock}

  ${thermalFooter('Show at branch')}
</body>
</html>`;

  await downloadHtmlAsFile(html, `booking-ticket-${esc(receipt.bookingId) || 'ticket'}`);
}

export function buildServiceInvoiceReceiptHtml(invoice: {
  invoiceNumber: string;
  reference: string;
  date: string;
  branch: { name: string; location: string; phone?: string | null };
  customer: { name: string; phone?: string | null };
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  labourCost: number;
  partsTotal: number;
  total: number;
  notes?: string;
}) {
  const branch = invoice.branch;
  const customer = invoice.customer;
  const labour = Number(invoice.labourCost) || 0;
  const partsTotal = Number(invoice.partsTotal) || 0;
  const total = Number(invoice.total) || 0;

  const itemRows = invoice.items
    .map(
      (p) => `<tr>
        <td class="name">${esc(p.name)}<br /><span style="font-size:8px;">x${p.quantity} @ ${formatPkrReceipt(p.unitPrice)}</span></td>
        <td class="amt">${formatPkrReceipt(p.total)}</td>
      </tr>`,
    )
    .join('');

  const partsBlock =
    invoice.items.length > 0
      ? `<div class="rule">------------------------</div>
  <p class="center bold">PARTS USED</p>
  <table class="items">${itemRows}</table>
  <table class="details">${row('Parts subtotal', formatPkrReceipt(partsTotal))}</table>`
      : '';

  const labourBlock =
    labour > 0
      ? `<div class="rule">------------------------</div>
  <table class="details">${row('Labour cost', formatPkrReceipt(labour))}</table>`
      : '';

  const notesBlock = invoice.notes?.trim()
    ? `<div class="rule">------------------------</div>
  <table class="details">${row('Notes', esc(invoice.notes.trim()))}</table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${RECEIPT_WIDTH}, initial-scale=1" />
  <title>${esc(invoice.invoiceNumber)}</title>
  <style>${THERMAL_RECEIPT_CSS}</style>
</head>
<body>
  ${thermalHeader(branch, 'SERVICE INVOICE')}

  <table class="details">
    ${row('Invoice #', esc(invoice.invoiceNumber))}
    ${row('Reference', esc(invoice.reference))}
    ${row('Date', formatDate(invoice.date))}
  </table>

  <div class="rule">------------------------</div>

  <table class="details">
    ${row('Customer', esc(customer.name))}
    ${hasDisplayValue(customer.phone) ? row('Phone', esc(customer.phone)) : ''}
  </table>

  ${partsBlock}
  ${labourBlock}
  ${notesBlock}

  <div class="rule">************************</div>
  <p class="center bold">TOTAL DUE</p>
  <p class="center big">${formatPkrReceipt(total)}</p>
  <p class="center small">Payment due on collection</p>

  ${thermalFooter('Keep this receipt')}
</body>
</html>`;
}

export async function downloadServiceInvoiceReceipt(invoice: {
  invoiceNumber: string;
  reference: string;
  date: string;
  branch: { name: string; location: string; phone?: string | null };
  customer: { name: string; phone?: string | null };
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  labourCost: number;
  partsTotal: number;
  total: number;
  notes?: string;
}) {
  await downloadHtmlAsFile(
    buildServiceInvoiceReceiptHtml(invoice),
    `service-invoice-${esc(invoice.invoiceNumber) || 'receipt'}`,
  );
}
