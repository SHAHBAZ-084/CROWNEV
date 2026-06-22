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
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label: string, value: string): string {
  return `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`;
}

const RECEIPT_WIDTH = '72mm';

export function downloadBookingReceipt(receipt: Record<string, unknown>) {
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
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      width: ${RECEIPT_WIDTH};
      margin: 0 auto;
    }
    @page {
      size: ${RECEIPT_WIDTH} auto;
      margin: 3mm;
    }
    body {
      width: ${RECEIPT_WIDTH};
      max-width: ${RECEIPT_WIDTH};
      margin: 0 auto;
      font-family: "Courier New", Courier, monospace;
      font-size: 11px;
      line-height: 1.3;
      color: #000;
      background: #fff;
      padding: 8px 6px 12px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .center { text-align: center; }
    .shop {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      margin-bottom: 2px;
    }
    .meta {
      font-size: 10px;
      line-height: 1.35;
      margin-bottom: 1px;
    }
    .rule {
      text-align: center;
      font-size: 9px;
      margin: 6px 0;
      letter-spacing: 0;
      overflow: hidden;
    }
    .bold {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      margin: 2px 0;
    }
    .big {
      font-size: 16px;
      font-weight: 700;
      margin: 3px 0 1px;
    }
    .mid {
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .small {
      font-size: 9px;
      color: #333;
      margin: 2px 0;
    }
    table.details {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 10px;
    }
    table.details td {
      padding: 2px 0;
      vertical-align: top;
    }
    table.details .label {
      width: 42%;
      color: #222;
      padding-right: 4px;
    }
    table.details .value {
      width: 58%;
      text-align: right;
      font-weight: 700;
      word-break: break-word;
    }
    .thanks {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      margin: 8px 0 4px;
    }
    .barcode {
      display: block;
      margin: 6px auto 0;
      height: 28px;
      width: 85%;
      max-width: 58mm;
      background: repeating-linear-gradient(
        90deg,
        #000 0 1.5px,
        #fff 1.5px 3px,
        #000 3px 4px,
        #fff 4px 6px
      );
    }
    @media screen {
      body {
        margin: 20px auto;
        box-shadow: 0 4px 20px rgb(0 0 0 / 15%);
        border: 1px solid #ddd;
      }
    }
    @media print {
      html, body {
        width: ${RECEIPT_WIDTH} !important;
        max-width: ${RECEIPT_WIDTH} !important;
        margin: 0 auto !important;
        padding: 4px 6px !important;
        box-shadow: none !important;
        border: none !important;
      }
    }
  </style>
</head>
<body>
  <p class="center shop">CROWN EV</p>
  <p class="center meta">${esc(branch.name)}</p>
  <p class="center meta">${esc(branch.location)}</p>
  ${branch.phone ? `<p class="center meta">Tel. ${esc(branch.phone)}</p>` : ''}

  <div class="rule">************************</div>
  <p class="center bold">SERVICE BOOKING</p>
  <div class="rule">************************</div>

  <table class="details">
    ${row('Booking #', esc(receipt.bookingId))}
    ${row('Status', esc(receipt.status))}
  </table>

  <div class="rule">------------------------</div>

  <table class="details">
    ${row('Customer', esc(customer.name))}
    ${customer.phone ? row('Phone', esc(customer.phone)) : ''}
    ${row('Service', `${serviceName}${serviceDuration}`)}
  </table>

  ${scheduleBlock}

  <div class="rule">************************</div>
  <p class="center small">Show at branch</p>
  <p class="center thanks">THANK YOU!</p>
  <div class="barcode" aria-hidden="true"></div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 150);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=320,height=520,scrollbars=yes');
  if (!win) {
    alert('Please allow pop-ups to download the receipt.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
