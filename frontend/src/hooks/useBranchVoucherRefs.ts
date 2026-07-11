import { useCallback, useEffect, useState } from 'react';
import { loadBranchVoucherRefMap, type VoucherRefState } from '../lib/invoiceVouchers';

export function useBranchVoucherRefs(branchId: number | undefined, refreshKey = 0) {
  const [voucherByRef, setVoucherByRef] = useState<Map<string, VoucherRefState>>(new Map());

  const reload = useCallback(() => {
    if (!branchId) return;
    loadBranchVoucherRefMap(branchId)
      .then(setVoucherByRef)
      .catch(console.error);
  }, [branchId]);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  return { voucherByRef, reloadVoucherRefs: reload };
}
