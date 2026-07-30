import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../../contexts/ToastContext';

export function RowActions({
  onEdit,
  onDelete,
  deleteLabel,
  extra,
  editDisabled,
  deleteDisabled,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  extra?: React.ReactNode;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {extra}
      {onEdit && !editDisabled && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-brand hover:text-brand-light hover:bg-brand/5"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && !deleteDisabled && (
        <button
          type="button"
          onClick={onDelete}
          className={`inline-flex items-center gap-1 rounded-lg text-warning hover:bg-warning/10 ${deleteLabel ? 'px-2 py-1 text-xs font-medium' : 'p-1.5'}`}
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
  requirePassword,
}: {
  open: boolean;
  label: string;
  message?: string;
  onClose: () => void;
  onConfirm: (password?: string) => void;
  loading?: boolean;
  requirePassword?: boolean;
}) {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  const canConfirm = !requirePassword || password.trim().length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Confirm delete" size="sm">
      <p className="text-sm text-ink-muted">
        {message ?? <>Delete <strong>{label}</strong>? This cannot be undone.</>}
      </p>
      {requirePassword && (
        <div className="mt-4">
          <Input
            label="Your password"
            type="password"
            passwordToggle
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter your password to confirm"
          />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant="danger"
          loading={loading}
          disabled={!canConfirm}
          onClick={() => onConfirm(requirePassword ? password : undefined)}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}

export function useDeleteConfirm<T extends { id?: string | number; name?: string; email?: string }>(
  onDelete: (item: T, password?: string) => Promise<void>,
  options?: { message?: (item: T) => string; requirePassword?: boolean }
) {
  const [target, setTarget] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function confirm(password?: string) {
    if (!target) return;
    if (options?.requirePassword && !password?.trim()) {
      toast('Password is required', 'error');
      return;
    }
    setLoading(true);
    try {
      await onDelete(target, password);
      setTarget(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
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
        requirePassword={options?.requirePassword}
        onClose={() => setTarget(null)}
        onConfirm={confirm}
        loading={loading}
      />
    ) : null,
  };
}

export function FormActions({
  onCancel,
  loading,
  submitDisabled,
  submitTitle,
}: {
  onCancel: () => void;
  loading?: boolean;
  submitDisabled?: boolean;
  submitTitle?: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button type="submit" variant="accent" loading={loading} disabled={submitDisabled} title={submitTitle}>Save</Button>
    </div>
  );
}
