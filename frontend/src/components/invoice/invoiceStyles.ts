/** Shared invoice print/PDF styling — font sizes unchanged; stronger text contrast. */
export const invoicePrintArea =
  'print-area rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-800 shadow-sm';

/** Compact but readable — between the old tiny logo and oversized md. */
export const invoiceLogoSize = 'sm' as const;
export const invoiceLogoClass = 'shrink-0 !h-14 !max-w-[170px]';

export const invoiceMetaText = 'text-xs text-slate-700';
export const invoiceSectionLabel =
  'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-800';
export const invoiceFieldLabel = 'text-slate-700';
export const invoiceFieldValue = 'text-slate-900';
export const invoiceTableHead =
  'border-b-2 border-slate-300 bg-slate-100 text-left text-xs uppercase text-slate-800';
export const invoiceSubtext = 'text-xs text-slate-700';
export const invoiceTotalsLabel = 'text-slate-800';
export const invoiceTableCell = 'text-slate-900';
