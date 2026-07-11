import { useEffect, useState } from 'react';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import type { PurchaseInvoiceData } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Loader2 } from 'lucide-react';

type BikeUnitEdit = {
  chassisId: number;
  label: string;
  unitCost: string;
  color: string;
  chassisNumber: string;
  engineNumber: string;
  motorNumber: string;
  identityLocked: boolean;
};

type PartLineEdit = {
  purchaseItemId: number;
  label: string;
  unitCost: string;
};

export function PurchaseInvoiceEditModal({
  open,
  purchaseId,
  onClose,
  onSaved,
}: {
  open: boolean;
  purchaseId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bikeUnits, setBikeUnits] = useState<BikeUnitEdit[]>([]);
  const [partLines, setPartLines] = useState<PartLineEdit[]>([]);

  useEffect(() => {
    if (!open || purchaseId == null) return;
    setLoading(true);
    branchApi
      .purchaseInvoice(purchaseId)
      .then((inv: PurchaseInvoiceData) => {
        const bikes: BikeUnitEdit[] = [];
        const parts: PartLineEdit[] = [];
        for (const item of inv.items) {
          if (item.type === 'BIKE' && item.bikeUnits?.length) {
            for (const unit of item.bikeUnits) {
              bikes.push({
                chassisId: unit.chassisId!,
                label: item.name,
                unitCost: String(unit.purchasePrice ?? item.unitCost),
                color: unit.color ?? '',
                chassisNumber: unit.chassisNumber,
                engineNumber: unit.engineNumber ?? '',
                motorNumber: unit.motorNumber ?? '',
                identityLocked: !!unit.identityLocked,
              });
            }
          } else if (item.type === 'PART' && item.purchaseItemId != null) {
            parts.push({
              purchaseItemId: item.purchaseItemId,
              label: item.name,
              unitCost: String(item.unitCost),
            });
          }
        }
        setBikeUnits(bikes);
        setPartLines(parts);
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Failed to load purchase', 'error');
        onClose();
      })
      .finally(() => setLoading(false));
  }, [open, purchaseId, onClose, toast]);

  async function handleSave() {
    if (purchaseId == null) return;
    const items: Parameters<typeof branchApi.updatePurchaseInvoice>[1]['items'] = [];

    for (const unit of bikeUnits) {
      const payload: (typeof items)[number] = { chassisId: unit.chassisId };
      const cost = parseFloat(unit.unitCost);
      if (Number.isFinite(cost) && cost > 0) payload.unitCost = cost;
      payload.color = unit.color.trim() || null;
      if (!unit.identityLocked) {
        if (unit.chassisNumber.trim()) payload.chassisNumber = unit.chassisNumber.trim();
        payload.engineNumber = unit.engineNumber.trim() || null;
        payload.motorNumber = unit.motorNumber.trim() || null;
      }
      items.push(payload);
    }

    for (const line of partLines) {
      const cost = parseFloat(line.unitCost);
      if (!Number.isFinite(cost) || cost <= 0) {
        toast(`Enter a valid cost for ${line.label}`, 'error');
        return;
      }
      items.push({ purchaseItemId: line.purchaseItemId, unitCost: cost });
    }

    if (!items.length) {
      toast('Nothing to update', 'error');
      return;
    }

    setSaving(true);
    try {
      await branchApi.updatePurchaseInvoice(purchaseId, { items });
      toast('Purchase invoice updated', 'success');
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update purchase', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Purchase Invoice" size="lg" tallContent>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : (
        <div className="space-y-6">
          {bikeUnits.map((unit) => (
            <div key={unit.chassisId} className="space-y-3 rounded-lg border border-border bg-surface-alt/40 p-4">
              <p className="font-semibold text-ink">{unit.label}</p>
              {unit.identityLocked && (
                <p className="text-xs text-warning">
                  This unit is sold or invoiced — only price and color can be changed.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Unit cost (PKR)"
                  type="number"
                  min={0}
                  step={0.01}
                  value={unit.unitCost}
                  onChange={(e) =>
                    setBikeUnits((rows) =>
                      rows.map((r) => (r.chassisId === unit.chassisId ? { ...r, unitCost: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  label="Color"
                  value={unit.color}
                  onChange={(e) =>
                    setBikeUnits((rows) =>
                      rows.map((r) => (r.chassisId === unit.chassisId ? { ...r, color: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  label="Chassis number"
                  value={unit.chassisNumber}
                  disabled={unit.identityLocked}
                  onChange={(e) =>
                    setBikeUnits((rows) =>
                      rows.map((r) => (r.chassisId === unit.chassisId ? { ...r, chassisNumber: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  label="Engine number"
                  value={unit.engineNumber}
                  disabled={unit.identityLocked}
                  onChange={(e) =>
                    setBikeUnits((rows) =>
                      rows.map((r) => (r.chassisId === unit.chassisId ? { ...r, engineNumber: e.target.value } : r)),
                    )
                  }
                />
                <Input
                  label="Motor number"
                  value={unit.motorNumber}
                  disabled={unit.identityLocked}
                  onChange={(e) =>
                    setBikeUnits((rows) =>
                      rows.map((r) => (r.chassisId === unit.chassisId ? { ...r, motorNumber: e.target.value } : r)),
                    )
                  }
                />
              </div>
            </div>
          ))}

          {partLines.map((line) => (
            <div key={line.purchaseItemId} className="rounded-lg border border-border bg-surface-alt/40 p-4">
              <Input
                label={`${line.label} — unit cost (PKR)`}
                type="number"
                min={0}
                step={0.01}
                value={line.unitCost}
                onChange={(e) =>
                  setPartLines((rows) =>
                    rows.map((r) => (r.purchaseItemId === line.purchaseItemId ? { ...r, unitCost: e.target.value } : r)),
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
