import { ViewVoucherPanel, type VoucherType } from './ViewVoucherPanel';
import { Modal } from '../ui/Modal';

export function ViewVoucherModal({
  open,
  onClose,
  branchId,
  defaultType = '',
}: {
  open: boolean;
  onClose: () => void;
  branchId: number | null;
  defaultType?: VoucherType | '';
}) {
  return (
    <Modal open={open} onClose={onClose} title="View Voucher" size="lg">
      <ViewVoucherPanel branchId={branchId} defaultType={defaultType} />
    </Modal>
  );
}
