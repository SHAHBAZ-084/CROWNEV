/** Invoice display: append father name when present. */
export function formatCustomerNameWithFather(name: string, fatherName?: string | null): string {
  const trimmedFather = fatherName?.trim();
  if (!trimmedFather) return name;
  const trimmedName = name.trim() || name;
  return `${trimmedName} S/O ${trimmedFather}`;
}
