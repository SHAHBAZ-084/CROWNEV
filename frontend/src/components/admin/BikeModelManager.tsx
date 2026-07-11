import { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useDeleteConfirm } from '../crud/CrudHelpers';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DataTable } from '../ui/DataTable';
import { Plus, Loader2, Pencil } from 'lucide-react';

type Row = { id: number; name: string };

/**
 * Manage the admin-configurable list of bike model names (used on bikes and part compatibility tags).
 * Rendered inside a Modal from AdminProductsPage — no PageHeader so it drops into existing chrome.
 */
export function BikeModelManager({ onChange }: { onChange?: () => void }) {
  const { toast } = useToast();
  const [models, setModels] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadModels = async () => {
    setLoading(true);
    try {
      const data = await adminApi.bikeModels();
      setModels(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load bike models', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await adminApi.createBikeModel(newName);
      setNewName('');
      toast('Bike model added', 'success');
      await loadModels();
      onChange?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add', 'error');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setEditName(row.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return;
    setUpdatingId(id);
    try {
      await adminApi.updateBikeModel(id, editName);
      toast('Bike model updated', 'success');
      setEditingId(null);
      setEditName('');
      await loadModels();
      onChange?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update', 'error');
    } finally {
      setUpdatingId(null);
    }
  }

  const del = useDeleteConfirm<Row>(
    async (item) => {
      try {
        await adminApi.deleteBikeModel(item.id);
        toast('Bike model deleted', 'success');
        if (editingId === item.id) cancelEdit();
        await loadModels();
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
        header: 'Model Name',
        render: (r: Row) =>
          editingId === r.id ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              aria-label="Edit model name"
            />
          ) : (
            <span className="font-semibold text-ink">{r.name}</span>
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right' as const,
        render: (r: Row) => {
          if (editingId === r.id) {
            return (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={updatingId === r.id}>
                  Cancel
                </Button>
                <Button size="sm" loading={updatingId === r.id} onClick={() => saveEdit(r.id)}>
                  Save
                </Button>
              </div>
            );
          }
          return (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => startEdit(r)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="danger" onClick={() => del.setTarget(r)}>
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [editingId, editName, updatingId, del.setTarget],
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
            <DataTable columns={columns} data={models} emptyMessage="No bike models configured yet" />
          )}
        </div>

        <div className="h-fit rounded-[var(--radius-card)] border border-border bg-white p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-brand">Add Bike Model</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input
              label="Model Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. CR-V2"
              required
            />
            <Button type="submit" className="w-full" loading={saving}>
              <Plus className="mr-1 h-4 w-4" />
              Add Model
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
