/** Shared top-row layout for POS sale, purchase, and service invoice forms. */
export const INVOICE_HEADER_ROW_CLASS =
  'mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,1fr)]';

/** Full-width notes row below the account / invoice # / date header. */
export const INVOICE_NOTES_ROW_CLASS = 'mb-6';

/** Customer / supplier account field — wider on desktop, full width when stacked. */
export const INVOICE_ACCOUNT_CELL_CLASS = 'min-w-0 sm:col-span-2 lg:col-span-1';
