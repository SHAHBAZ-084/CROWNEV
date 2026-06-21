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
