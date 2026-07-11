import { branchApi } from '../api/client';

type VoucherRow = {
  id: number;
  reference?: string | null;
  status?: string;
};

export type VoucherRefState = {
  activeIds: number[];
  cancelledIds: number[];
};

export function buildVoucherRefMap(vouchers: VoucherRow[]): Map<string, VoucherRefState> {
  const map = new Map<string, VoucherRefState>();
  for (const voucher of vouchers) {
    const ref = String(voucher.reference ?? '').trim();
    if (!ref) continue;
    const entry = map.get(ref) ?? { activeIds: [], cancelledIds: [] };
    if (voucher.status === 'CANCELLED') {
      entry.cancelledIds.push(voucher.id);
    } else {
      entry.activeIds.push(voucher.id);
    }
    map.set(ref, entry);
  }
  return map;
}

export async function loadBranchVoucherRefMap(branchId: number) {
  const vouchers = (await branchApi.vouchers(branchId)) as VoucherRow[];
  return buildVoucherRefMap(vouchers);
}

export async function cancelInvoiceVouchers(branchId: number, reference: string) {
  const map = await loadBranchVoucherRefMap(branchId);
  const entry = map.get(reference.trim());
  if (!entry?.activeIds.length) {
    throw new Error('No active voucher found for this invoice');
  }
  for (const id of entry.activeIds) {
    await branchApi.deleteVoucher(branchId, id);
  }
}

export async function restoreInvoiceVouchers(branchId: number, reference: string) {
  const map = await loadBranchVoucherRefMap(branchId);
  const entry = map.get(reference.trim());
  if (!entry?.cancelledIds.length) {
    throw new Error('No cancelled voucher found for this invoice');
  }
  for (const id of entry.cancelledIds) {
    await branchApi.restoreVoucher(branchId, id);
  }
}
