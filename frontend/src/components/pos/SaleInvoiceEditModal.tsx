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
  type: 'BIKE' | 'PART';
  unitPrice: string;
  color: string;
  chassisNumber: string;
  engineNumber: string;
  motorNumber: string;
  identityLocked: boolean;
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
              type: item.type,
              unitPrice: String(item.unitPrice),
              color: item.color ?? '',
              chassisNumber: item.chassisNumber ?? '',
              engineNumber: item.engineNumber ?? '',
              motorNumber: item.motorNumber ?? '',
              identityLocked: !!item.identityLocked,
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
      const payload: (typeof items)[number] = {
        orderItemId: line.orderItemId,
        unitPrice: price,
      };
      if (line.type === 'BIKE') {
        payload.color = line.color.trim() || null;
        if (!line.identityLocked) {
          if (line.chassisNumber.trim()) payload.chassisNumber = line.chassisNumber.trim();
          payload.engineNumber = line.engineNumber.trim() || null;
          payload.motorNumber = line.motorNumber.trim() || null;
        }
      }
      items.push(payload);
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
            <div key={line.orderItemId} className="space-y-3 rounded-lg border border-border bg-surface-alt/40 p-4">
              <p className="font-semibold text-ink">{line.label}</p>
              {line.type === 'BIKE' && line.identityLocked && (
                <p className="text-xs text-warning">
                  This unit is invoiced elsewhere — only price and color can be changed.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Unit price (PKR)"
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
                {line.type === 'BIKE' && (
                  <>
                    <Input
                      label="Color"
                      value={line.color}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) => (r.orderItemId === line.orderItemId ? { ...r, color: e.target.value } : r)),
                        )
                      }
                    />
                    <Input
                      label="Chassis number"
                      value={line.chassisNumber}
                      disabled={line.identityLocked}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) =>
                            r.orderItemId === line.orderItemId ? { ...r, chassisNumber: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <Input
                      label="Engine number"
                      value={line.engineNumber}
                      disabled={line.identityLocked}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) =>
                            r.orderItemId === line.orderItemId ? { ...r, engineNumber: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <Input
                      label="Motor number"
                      value={line.motorNumber}
                      disabled={line.identityLocked}
                      onChange={(e) =>
                        setLines((rows) =>
                          rows.map((r) =>
                            r.orderItemId === line.orderItemId ? { ...r, motorNumber: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </>
                )}
              </div>
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
