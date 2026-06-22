export function formatPKR(amount: number | string) {
  return `PKR ${Number(amount).toLocaleString('en-PK')}`;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Running balance: positive = Dr, negative = Cr (never show negative Dr). */
export function formatLedgerBalance(balance: number | string) {
  const n = Number(balance);
  const abs = Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 0 ? `${abs} Dr` : `${abs} Cr`;
}

/** Split signed balance into trial-balance Dr / Cr columns. */
export function splitTrialBalanceAmount(balance: number | string) {
  const n = Number(balance);
  if (n > 0) return { debit: n, credit: 0 };
  if (n < 0) return { debit: 0, credit: Math.abs(n) };
  return { debit: 0, credit: 0 };
}

/** Per entry: Debit column amount or Credit column amount (Balance = ΣDebit − ΣCredit). */
export function ledgerEntryAmounts(entry: { type: string; amount: number | string }) {
  const amt = Number(entry.amount);
  if (entry.type === 'DEBIT') return { debit: amt, credit: 0 };
  return { debit: 0, credit: amt };
}

export function sumLedgerEntryTotals(entries: { type: string; amount: number | string }[]) {
  return entries.reduce(
    (acc, e) => {
      const { debit, credit } = ledgerEntryAmounts(e);
      acc.totalDebit += debit;
      acc.totalCredit += credit;
      return acc;
    },
    { totalDebit: 0, totalCredit: 0 },
  );
}

/** Opening balance before the first posted entry. */
export function openingBalanceBeforeEntry(entry: { type: string; amount: number | string; balance: number | string }) {
  const { debit, credit } = ledgerEntryAmounts(entry);
  return Number(entry.balance) - debit + credit;
}
