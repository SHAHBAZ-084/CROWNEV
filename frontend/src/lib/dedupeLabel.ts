import type { SearchSelectOption } from '../components/ui/SearchSelect';

type NamedItem = { id: number | string; name: string };

export function buildDedupedLabels<T extends NamedItem>(
  items: T[],
  extra: (item: T) => string[],
): Map<string | number, string> {
  const labels = new Map<string | number, string>();
  for (const it of items) {
    const parts = extra(it).filter(Boolean);
    if (!parts.length) {
      labels.set(it.id, it.name);
      continue;
    }
    const suffix = parts[0].startsWith('(') ? ` ${parts.join(' ')}` : ` — ${parts.join(' ')}`;
    labels.set(it.id, `${it.name}${suffix}`);
  }
  return labels;
}

export function parseAccountCode(code: string): { kind: 'customer' | 'supplier'; id: number } | null {
  const m = /^([CS])(\d+)$/.exec(code.trim());
  if (!m) return null;
  return { kind: m[1] === 'C' ? 'customer' : 'supplier', id: parseInt(m[2], 10) };
}

type LinkedRow = Record<string, unknown>;

export function buildAccountSelectOptions(
  accounts: Array<{ id: number | string; name: string; code?: unknown; category?: string }>,
  customers: LinkedRow[],
  suppliers: LinkedRow[],
): SearchSelectOption[] {
  const customersById = new Map(customers.map((c) => [Number(c.id), c]));
  const suppliersById = new Map(suppliers.map((s) => [Number(s.id), s]));

  const customerLinked = accounts.flatMap((a) => {
    const parsed = parseAccountCode(String(a.code ?? ''));
    if (!parsed || parsed.kind !== 'customer') return [];
    return [{ id: a.id, name: String(a.name), linked: customersById.get(parsed.id) }];
  });

  const supplierLinked = accounts.flatMap((a) => {
    const parsed = parseAccountCode(String(a.code ?? ''));
    if (!parsed || parsed.kind !== 'supplier') return [];
    return [{ id: a.id, name: String(a.name), linked: suppliersById.get(parsed.id) }];
  });

  const customerLabels = buildDedupedLabels(customerLinked, (it) => [
    it.linked?.cnic ? String(it.linked.cnic) : '',
    it.linked?.fatherName ? `(S/O ${it.linked.fatherName})` : '',
  ]);

  const supplierLabels = buildDedupedLabels(supplierLinked, (it) => [
    it.linked?.phone ? String(it.linked.phone) : '',
    it.linked?.contactPerson ? `(${it.linked.contactPerson})` : '',
  ]);

  return accounts.map((a) => {
    const parsed = parseAccountCode(String(a.code ?? ''));
    if (!parsed) {
      const name = String(a.name);
      const category = a.category?.trim() || 'Account';
      const code = String(a.code ?? '').trim();
      return {
        value: String(a.id),
        label: code ? `${name} — (${category} · ${code})` : `${name} — (${category})`,
      };
    }
    const labelMap = parsed.kind === 'customer' ? customerLabels : supplierLabels;
    return {
      value: String(a.id),
      label: labelMap.get(a.id) ?? String(a.name),
    };
  });
}
