/** Shared invoice print/PDF styling — page size unchanged; crisper font + slightly bigger logo. */
export const invoicePrintArea =
  'print-area rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-sm antialiased [font-family:var(--font-body)]';

/** Compact but readable — slightly larger than before per client feedback that it looked short. */
export const invoiceLogoSize = 'sm' as const;
export const invoiceLogoClass = 'shrink-0 !h-16 !max-w-[190px]';

export const invoiceMetaText = 'text-xs font-semibold text-slate-700';
export const invoiceSectionLabel =
  'mb-2 text-xs font-semibold uppercase tracking-wide text-slate-800';
export const invoiceFieldLabel = 'font-semibold text-slate-700';
export const invoiceFieldValue = 'font-semibold text-slate-900';
export const invoiceTableHead =
  'border-b-2 border-slate-300 bg-slate-100 text-left text-xs font-semibold uppercase text-slate-800';
export const invoiceSubtext = 'text-xs font-semibold text-slate-700';
export const invoiceTotalsLabel = 'font-semibold text-slate-800';
export const invoiceTableCell = 'font-semibold text-slate-900';
