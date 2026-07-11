import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useBranchPermission } from '../../hooks/useBranchPermission';
import { useToast } from '../../contexts/ToastContext';
import { cancelInvoiceVouchers, type VoucherRefState } from '../../lib/invoiceVouchers';

type Props = {
  branchId: number;
  reference: string;
  voucherState?: VoucherRefState;
  canEdit?: boolean;
  onView: () => void;
  onEdit?: () => void;
  onChanged: () => void;
};

export function PosInvoiceRowActions({
  branchId,
  reference,
  voucherState,
  canEdit = true,
  onView,
  onEdit,
  onChanged,
}: Props) {
  const { toast } = useToast();
  const { canUpdate, canDelete, restrictedTitle } = useBranchPermission();
  const [cancelling, setCancelling] = useState(false);

  const hasActive = (voucherState?.activeIds.length ?? 0) > 0;

  async function handleCancel() {
    if (!window.confirm(`Cancel invoice #${reference}? Linked accounting vouchers will be reversed.`)) return;
    setCancelling(true);
    try {
      await cancelInvoiceVouchers(branchId, reference);
      toast('Invoice cancelled', 'success');
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to cancel invoice', 'error');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" variant="secondary" onClick={onView}>
        View
      </Button>
      {canEdit && onEdit && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onEdit}
          disabled={!canUpdate}
          title={!canUpdate ? restrictedTitle : undefined}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
      )}
      {hasActive && (
        <Button
          size="sm"
          variant="danger"
          loading={cancelling}
          onClick={handleCancel}
          disabled={!canDelete}
          title={!canDelete ? restrictedTitle : 'Cancel invoice vouchers'}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Cancel
        </Button>
      )}
    </div>
  );
}
