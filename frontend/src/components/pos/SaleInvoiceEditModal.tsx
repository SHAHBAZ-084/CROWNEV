import { useEffect, useState } from 'react';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import type { InvoiceData } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Loader2 } from 'lucide-react';

type LineEdit = {
  orderItemId: number;
  label: string;
  unitPrice: string;
};

export function SaleInvoiceEditModal({
  open,
  orderId,
  onClose,
  onSaved,
}: {
  open: boolean;
  orderId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<LineEdit[]>([]);

  useEffect(() => {
    if (!open || orderId == null) return;
    setLoading(true);
    branchApi
      .orderInvoice(orderId)
      .then((inv: InvoiceData) => {
        setLines(
          inv.items
            .filter((item) => item.orderItemId != null)
            .map((item) => ({
              orderItemId: item.orderItemId!,
              label: item.name,
              unitPrice: String(item.unitPrice),
            })),
        );
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Failed to load sale invoice', 'error');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, orderId, onClose, toast]);

  async function handleSave() {
    if (orderId == null) return;
    const items: Parameters<typeof branchApi.updateOrderItems>[1]['items'] = [];
    for (const line of lines) {
      const price = parseFloat(line.unitPrice);
      if (!Number.isFinite(price) || price <= 0) {
        toast(`Enter a valid price for ${line.label}`, 'error');
        return;
      }
      items.push({ orderItemId: line.orderItemId, unitPrice: price });
    }

    setSaving(true);
    try {
      await branchApi.updateOrderItems(orderId, { items });
      toast('Sale invoice updated', 'success');
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update sale', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Sale Invoice" size="lg" tallContent>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : (
        <div className="space-y-6">
          {lines.map((line) => (
            <div key={line.orderItemId} className="rounded-lg border border-border bg-surface-alt/40 p-4">
              <Input
                label={`${line.label} — unit price (PKR)`}
                type="number"
                min={0}
                step={0.01}
                value={line.unitPrice}
                onChange={(e) =>
                  setLines((rows) =>
                    rows.map((r) => (r.orderItemId === line.orderItemId ? { ...r, unitPrice: e.target.value } : r)),
                  )
                }
              />
            </div>
          ))}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="accent" loading={saving} onClick={handleSave}>
              Save changes
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
