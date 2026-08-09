import { formatDate, formatLedgerBalance, formatPKR } from './format';

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
  return name.replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 80);
}

export async function exportToExcel<T>(
  filename: string,
  sheetName: string,
  columns: ReportColumn<T>[],
  rows: T[],
  meta?: { title?: string; subtitle?: string },
) {
  const ExcelJS = await import('exceljs');
  const headerRow = columns.map((c) => c.header);
  const dataRows = rows.map((row) => columns.map((c) => c.value(row)));
  const sheetRows: (string | number)[][] = [];

  if (meta?.title) sheetRows.push([meta.title]);
  if (meta?.subtitle) sheetRows.push([meta.subtitle]);
  if (meta?.title || meta?.subtitle) sheetRows.push([]);
  sheetRows.push(headerRow, ...dataRows);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  for (const row of sheetRows) {
    ws.addRow(row);
  }
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${sanitizeFilename(filename)}.xlsx`,
  );
}

export async function exportToPdf<T>(
  filename: string,
  columns: ReportColumn<T>[],
  rows: T[],
  meta?: {
    title?: string;
    subtitle?: string;
    boldRows?: number[];
    summaryTable?: { label: string; value: string; bold?: boolean }[];
  },
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
    styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 8, cellPadding: 4 },
    headStyles: { font: 'helvetica', fontStyle: 'bold', fillColor: [234, 88, 12], textColor: 255 },
    didParseCell: (data) => {
      if (data.section === 'body' && meta?.boldRows?.includes(data.row.index)) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 40, right: 40 },
  });

  if (meta?.summaryTable?.length) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    autoTable(doc, {
      startY: finalY + 16,
      body: meta.summaryTable.map((r) => [r.label, r.value]),
      styles: { font: 'helvetica', fontStyle: 'normal', fontSize: 9, cellPadding: 5 },
      columnStyles: { 0: { cellWidth: 150 }, 1: { halign: 'right' } },
      didParseCell: (data) => {
        if (meta.summaryTable![data.row.index]?.bold) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
      theme: 'plain',
      margin: { left: 40, right: 40 },
      tableWidth: 260,
    });
  }

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
  type: string;
  itemCode: string;
  name: string;
  color: string;
  quantity: number;
  alertAt: string;
  lowStock: string;
};

export const INVENTORY_EXPORT_COLUMNS: ReportColumn<InventoryExportRow>[] = [
  { header: 'Branch', value: (r) => r.branch },
  { header: 'Type', value: (r) => r.type },
  { header: 'Item Code / Chassis #', value: (r) => r.itemCode },
  { header: 'Name', value: (r) => r.name },
  { header: 'Color', value: (r) => r.color },
  { header: 'Quantity', value: (r) => r.quantity },
  { header: 'Alert At', value: (r) => r.alertAt },
  { header: 'Low Stock', value: (r) => r.lowStock },
];

export type PartsPriceListExportRow = {
  name: string;
  model: string;
  brand: string;
  category: string;
  price: string;
  salePrice: string;
};

export const PARTS_PRICE_LIST_COLUMNS: ReportColumn<PartsPriceListExportRow>[] = [
  { header: 'Part Name', value: (r) => r.name },
  { header: 'Model', value: (r) => r.model },
  { header: 'Brand', value: (r) => r.brand },
  { header: 'Category', value: (r) => r.category },
  { header: 'List Price (PKR)', value: (r) => r.price },
  { header: 'Website Sale Price (PKR)', value: (r) => r.salePrice },
];

export type StockSummaryExportRow = {
  branch: string;
  model: string;
  quantity: number | string;
};

const STOCK_SUMMARY_COLUMNS: ReportColumn<StockSummaryExportRow>[] = [
  { header: 'Branch', value: (r) => r.branch },
  { header: 'Model', value: (r) => r.model },
  { header: 'Quantity', value: (r) => r.quantity },
];

export async function exportStockSummaryReport(
  branches: { branchName: string; bikeModels: { name: string; quantity: number }[]; totalBikeUnits: number; totalPartUnits: number }[],
  totals: { totalBikeUnits: number; totalPartUnits: number },
) {
  const rows: StockSummaryExportRow[] = branches.flatMap((b) =>
    b.bikeModels.length
      ? b.bikeModels.map((m): StockSummaryExportRow => ({ branch: b.branchName, model: m.name, quantity: m.quantity }))
      : [{ branch: b.branchName, model: 'No bikes in stock', quantity: '' }]
  );
  const boldRows: number[] = [];
  const summaryTable = [
    { label: 'Total Bikes', value: String(totals.totalBikeUnits) },
    { label: 'Total Parts', value: String(totals.totalPartUnits) },
  ];
  await exportToPdf('stock_summary', STOCK_SUMMARY_COLUMNS, rows, {
    title: 'Stock Summary Report',
    subtitle: `Generated ${new Date().toLocaleDateString()}`,
    boldRows,
    summaryTable,
  });
}

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

export type ProfitLossItemRow = {
  modelName: string;
  chassisNumber: string;
  salePrice: number;
  purchasePrice: number;
  profit: number;
};

type ProfitLossSaleExportRow = {
  modelName: string;
  chassisNumber: string;
  salePrice: string;
  purchasePrice: string;
  profit: string;
};

const PROFIT_LOSS_SALE_COLUMNS: ReportColumn<ProfitLossSaleExportRow>[] = [
  { header: 'Model', value: (r) => r.modelName },
  { header: 'Chassis Number', value: (r) => r.chassisNumber },
  { header: 'Sale Price', value: (r) => r.salePrice },
  { header: 'Purchase Price', value: (r) => r.purchasePrice },
  { header: 'Profit', value: (r) => r.profit },
];

export async function exportProfitLossReport(
  revenueType: 'sale' | 'service',
  items: ProfitLossItemRow[],
  summary: { totalRevenue: number; totalProfit: number; expense: number; netProfit: number },
  dateRange?: { from?: string; to?: string },
) {
  const rangeText = [
    dateRange?.from ? `From ${formatDate(dateRange.from)}` : null,
    dateRange?.to ? `To ${formatDate(dateRange.to)}` : null,
  ].filter(Boolean).join(' · ');

  const title = revenueType === 'sale' ? 'Profit & Loss — Sale Revenue' : 'Profit & Loss — Service Revenue';
  const meta = { title, subtitle: rangeText || 'All dates' };
  const filename = `profit_loss_${revenueType}${rangeText ? `_${dateRange?.from ?? ''}_${dateRange?.to ?? ''}` : ''}`;

  if (revenueType === 'sale') {
    const exportRows: ProfitLossSaleExportRow[] = items.map((i) => ({
      modelName: i.modelName,
      chassisNumber: i.chassisNumber,
      salePrice: formatPKR(i.salePrice),
      purchasePrice: formatPKR(i.purchasePrice),
      profit: formatPKR(i.profit),
    }));
    const summaryTable = [
      { label: 'Total Revenue', value: formatPKR(summary.totalRevenue) },
      { label: 'Total Profit', value: formatPKR(summary.totalProfit) },
      { label: 'Expense', value: formatPKR(summary.expense) },
      { label: 'Net Profit', value: formatPKR(summary.netProfit), bold: true },
    ];
    await exportToPdf(filename, PROFIT_LOSS_SALE_COLUMNS, exportRows, { ...meta, summaryTable });
    return;
  }

  const summaryRows: SalesSummaryExportRow[] = [
    { metric: 'Total Revenue', value: formatPKR(summary.totalRevenue) },
    { metric: 'Expense', value: formatPKR(summary.expense) },
    { metric: 'Net Profit', value: formatPKR(summary.netProfit) },
  ];
  await exportSalesSummaryPdf(filename, summaryRows, meta);
}
