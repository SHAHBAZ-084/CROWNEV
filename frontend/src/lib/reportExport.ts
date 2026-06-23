import { formatDate, formatLedgerBalance } from './format';

export type ReportColumn<T> = {
  header: string;
  value: (row: T) => string | number;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').slice(0, 80);
}

export async function exportToExcel<T>(
  filename: string,
  sheetName: string,
  columns: ReportColumn<T>[],
  rows: T[],
  meta?: { title?: string; subtitle?: string },
) {
  const XLSX = await import('xlsx');
  const headerRow = columns.map((c) => c.header);
  const dataRows = rows.map((row) => columns.map((c) => c.value(row)));
  const sheetRows: (string | number)[][] = [];

  if (meta?.title) sheetRows.push([meta.title]);
  if (meta?.subtitle) sheetRows.push([meta.subtitle]);
  if (meta?.title || meta?.subtitle) sheetRows.push([]);
  sheetRows.push(headerRow, ...dataRows);

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${sanitizeFilename(filename)}.xlsx`,
  );
}

export async function exportToPdf<T>(
  filename: string,
  columns: ReportColumn<T>[],
  rows: T[],
  meta?: { title?: string; subtitle?: string },
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'pt' });
  let startY = 40;

  if (meta?.title) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(meta.title, 40, startY);
    startY += 18;
  }
  if (meta?.subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(meta.subtitle, 40, startY);
    doc.setTextColor(0);
    startY += 16;
  }

  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.value(row)))),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [234, 88, 12], textColor: 255 },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${sanitizeFilename(filename)}.pdf`);
}

export type LedgerExportRow = {
  date: string;
  voucherNo: string;
  ref: string | null;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

const LEDGER_COLUMNS: ReportColumn<LedgerExportRow>[] = [
  { header: 'Date', value: (r) => (r.date ? formatDate(r.date) : '') },
  { header: 'Voucher#', value: (r) => r.voucherNo },
  { header: 'Ref#', value: (r) => r.ref ?? '' },
  { header: 'Type', value: (r) => r.type },
  { header: 'Description', value: (r) => r.description || '' },
  { header: 'Debit', value: (r) => (r.debit > 0 ? r.debit : '') },
  { header: 'Credit', value: (r) => (r.credit > 0 ? r.credit : '') },
  { header: 'Balance', value: (r) => formatLedgerBalance(r.balance) },
];

export async function exportLedgerReport(
  format: 'excel' | 'pdf',
  accountLabel: string,
  rows: LedgerExportRow[],
  summary: { totalDebit: number; totalCredit: number; closingBalance: number },
  dateRange?: { from?: string; to?: string },
) {
  const rangeText = [
    dateRange?.from ? `From ${formatDate(dateRange.from)}` : null,
    dateRange?.to ? `To ${formatDate(dateRange.to)}` : null,
  ].filter(Boolean).join(' · ');

  const exportRows: LedgerExportRow[] = [
    ...rows,
    {
      date: '',
      voucherNo: '',
      ref: null,
      type: 'Total / Closing',
      description: '',
      debit: summary.totalDebit,
      credit: summary.totalCredit,
      balance: summary.closingBalance,
    },
  ];

  const meta = {
    title: `Account Ledger: ${accountLabel}`,
    subtitle: rangeText || 'All dates',
  };
  const filename = `ledger_${accountLabel}${rangeText ? `_${dateRange?.from ?? ''}_${dateRange?.to ?? ''}` : ''}`;

  if (format === 'excel') {
    await exportToExcel(filename, 'Ledger', LEDGER_COLUMNS, exportRows, meta);
  } else {
    await exportToPdf(filename, LEDGER_COLUMNS, exportRows, meta);
  }
}

export type TrialBalanceExportRow = {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
};

const TRIAL_BALANCE_COLUMNS: ReportColumn<TrialBalanceExportRow>[] = [
  { header: 'Code', value: (r) => r.accountCode },
  { header: 'Account', value: (r) => r.accountName },
  { header: 'Type', value: (r) => r.accountType },
  { header: 'Debit (Dr)', value: (r) => (r.debit > 0 ? r.debit : '') },
  { header: 'Credit (Cr)', value: (r) => (r.credit > 0 ? r.credit : '') },
];

export async function exportTrialBalanceReport(
  format: 'excel' | 'pdf',
  rows: TrialBalanceExportRow[],
  totals: { totalDebit: number; totalCredit: number },
) {
  const exportRows: TrialBalanceExportRow[] = [
    ...rows,
    {
      accountCode: '',
      accountName: 'Total',
      accountType: '',
      debit: totals.totalDebit,
      credit: totals.totalCredit,
    },
  ];

  const meta = { title: 'Detail Trial Balance' };
  const filename = 'trial_balance';

  if (format === 'excel') {
    await exportToExcel(filename, 'Trial Balance', TRIAL_BALANCE_COLUMNS, exportRows, meta);
  } else {
    await exportToPdf(filename, TRIAL_BALANCE_COLUMNS, exportRows, meta);
  }
}

export type OrderExportRow = {
  id: string | number;
  branch: string;
  customer: string;
  type: string;
  status: string;
  total: string | number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
};

export const ORDER_EXPORT_COLUMNS: ReportColumn<OrderExportRow>[] = [
  { header: 'ID', value: (r) => r.id },
  { header: 'Branch', value: (r) => r.branch },
  { header: 'Customer', value: (r) => r.customer },
  { header: 'Type', value: (r) => r.type },
  { header: 'Status', value: (r) => r.status },
  { header: 'Total (PKR)', value: (r) => Number(r.total).toLocaleString('en-PK') },
  { header: 'Payment', value: (r) => r.paymentMethod },
  { header: 'Pay Status', value: (r) => r.paymentStatus },
  { header: 'Date', value: (r) => (r.createdAt ? formatDate(r.createdAt) : '') },
];

export type InventoryExportRow = {
  branch: string;
  itemCode: string;
  partName: string;
  quantity: number;
  alertAt: number;
  lowStock: string;
};

export const INVENTORY_EXPORT_COLUMNS: ReportColumn<InventoryExportRow>[] = [
  { header: 'Branch', value: (r) => r.branch },
  { header: 'Item Code', value: (r) => r.itemCode },
  { header: 'Part Name', value: (r) => r.partName },
  { header: 'Quantity', value: (r) => r.quantity },
  { header: 'Alert At', value: (r) => r.alertAt },
  { header: 'Low Stock', value: (r) => r.lowStock },
];

export type SalesSummaryExportRow = {
  metric: string;
  value: string;
};

export async function exportSalesSummaryPdf(
  filename: string,
  rows: SalesSummaryExportRow[],
  meta: { title: string; subtitle: string },
) {
  const columns: ReportColumn<SalesSummaryExportRow>[] = [
    { header: 'Metric', value: (r) => r.metric },
    { header: 'Value', value: (r) => r.value },
  ];
  await exportToPdf(filename, columns, rows, meta);
}
