import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function RowActions({
  onEdit,
  onDelete,
  deleteLabel,
  extra,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {extra}
      {onEdit && (
        <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-brand-light hover:bg-brand/5" title="Edit">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={`inline-flex items-center gap-1 rounded-lg text-warning hover:bg-red-50 ${deleteLabel ? 'px-2 py-1 text-xs font-medium' : 'p-1.5'}`}
          title="Delete"
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          {deleteLabel}
        </button>
      )}
    </div>
  );
}

export function DeleteConfirm({
  open,
  label,
  message,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  label: string;
  message?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm delete" size="sm">
      <p className="text-sm text-text-muted">
        {message ?? <>Delete <strong>{label}</strong>? This cannot be undone.</>}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>Delete</Button>
      </div>
    </Modal>
  );
}

export function useDeleteConfirm<T extends { id?: string | number; name?: string; email?: string }>(
  onDelete: (item: T) => Promise<void>,
  options?: { message?: (item: T) => string }
) {
  const [target, setTarget] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!target) return;
    setLoading(true);
    try {
      await onDelete(target);
      setTarget(null);
    } finally {
      setLoading(false);
    }
  }

  return {
    target,
    setTarget,
    loading,
    confirm,
    modal: target ? (
      <DeleteConfirm
        open
        label={String((target as Record<string, unknown>).name ?? (target as Record<string, unknown>).email ?? target.id)}
        message={options?.message?.(target)}
        onClose={() => setTarget(null)}
        onConfirm={confirm}
        loading={loading}
      />
    ) : null,
  };
}

export function FormActions({ onCancel, loading }: { onCancel: () => void; loading?: boolean }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button type="submit" variant="accent" loading={loading}>Save</Button>
    </div>
  );
}
