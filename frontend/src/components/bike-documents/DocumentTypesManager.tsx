import { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useDeleteConfirm } from '../crud/CrudHelpers';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DataTable } from '../ui/DataTable';
import { Plus, Loader2 } from 'lucide-react';

type Row = Record<string, any>;

/**
 * Manage the admin-configurable list of bike document types (Warranty Card, Form F, etc).
 * Rendered inline inside the Bike Documents page's "Manage Document Types" modal —
 * this is intentionally page-chrome-free (no PageHeader) so it can drop into a Modal.
 */
export function DocumentTypesManager({ onChange }: { onChange?: () => void }) {
  const { toast } = useToast();
  const [types, setTypes] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadTypes = async () => {
    setLoading(true);
    try {
      const data = await adminApi.documentTypes();
      setTypes(data as Row[]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load document types', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await adminApi.createDocumentType(newName);
      setNewName('');
      toast('Document type added', 'success');
      await loadTypes();
      onChange?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(id: number, currentActive: boolean) {
    setTogglingId(id);
    try {
      await adminApi.setDocumentTypeActive(id, !currentActive);
      toast(`Document type ${currentActive ? 'deactivated' : 'activated'}`, 'success');
      await loadTypes();
      onChange?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  const del = useDeleteConfirm<Row>(
    async (item) => {
      try {
        await adminApi.deleteDocumentType(item.id);
        toast('Document type deleted', 'success');
        await loadTypes();
        onChange?.();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to delete', 'error');
        throw err;
      }
    },
    { message: (row) => `Delete "${row.name}"? This cannot be undone.` },
  );

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Document Name',
        render: (r: Row) => <span className="font-semibold text-ink">{r.name}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        render: (r: Row) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              r.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {r.isActive ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right' as const,
        render: (r: Row) => {
          const isToggling = togglingId === r.id;
          return (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={isToggling}
                onClick={() => handleToggleActive(r.id, r.isActive)}
              >
                {r.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button size="sm" variant="danger" onClick={() => del.setTarget(r)}>
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [togglingId, del.setTarget],
  );

  return (
    <>
      {del.modal}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-[var(--radius-card)] border border-border bg-white p-4">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <DataTable columns={columns} data={types} emptyMessage="No document types configured yet" />
        )}
      </div>

      <div className="h-fit rounded-[var(--radius-card)] border border-border bg-white p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-brand">Add Document Type</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <Input
            label="Type Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Sales Certificate"
            required
          />
          <Button type="submit" className="w-full" loading={saving}>
            <Plus className="mr-1 h-4 w-4" />
            Add Type
          </Button>
        </form>
      </div>
    </div>
    </>
  );
}
