import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useBranchPermission } from '../../hooks/useBranchPermission';
import { useToast } from '../../contexts/ToastContext';

type Props = {
  reference: string;
  canEdit?: boolean;
  onView: () => void;
  onEdit?: () => void;
  onDelete: () => Promise<void>;
  onChanged: () => void;
};

export function PosInvoiceRowActions({
  reference,
  canEdit = true,
  onView,
  onEdit,
  onDelete,
  onChanged,
}: Props) {
  const { toast } = useToast();
  const { canUpdate, canDelete, restrictedTitle } = useBranchPermission();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Permanently delete invoice #${reference}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete();
      toast('Invoice deleted', 'success');
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete invoice', 'error');
    } finally {
      setDeleting(false);
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
      <Button
        size="sm"
        variant="danger"
        loading={deleting}
        onClick={handleDelete}
        disabled={!canDelete}
        title={!canDelete ? restrictedTitle : 'Permanently delete invoice'}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        Delete
      </Button>
    </div>
  );
}
