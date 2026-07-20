import { useEffect, useState } from 'react';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import type { PurchaseInvoiceData } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SupplierAsyncSearchSelect } from '../ui/EntityAsyncSearchSelect';
import { Loader2, Trash2 } from 'lucide-react';

type BikeUnitEdit = {
  chassisId: number;
  label: string;
  unitCost: string;
  color: string;
  chassisNumber: string;
  engineNumber: string;
  motorNumber: string;
  identityLocked: boolean;
  removable: boolean;
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
  const [supplierId, setSupplierId] = useState('');
  const [initialSupplierId, setInitialSupplierId] = useState('');
  const [supplierLocked, setSupplierLocked] = useState(false);
  const [purchaseBranchId, setPurchaseBranchId] = useState<number | null>(null);
  const [bikeUnits, setBikeUnits] = useState<BikeUnitEdit[]>([]);
  const [partLines, setPartLines] = useState<PartLineEdit[]>([]);
  const [removedChassisIds, setRemovedChassisIds] = useState<number[]>([]);
  const [removedPartItemIds, setRemovedPartItemIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open || purchaseId == null) return;
    setRemovedChassisIds([]);
    setRemovedPartItemIds([]);
    setLoading(true);
    Promise.all([
      branchApi.purchaseInvoice(purchaseId),
      branchApi.purchase(purchaseId),
    ])
      .then(async ([inv, rawPurchase]) => {
        const purchase = rawPurchase as {
          supplierId: number;
          branchId: number;
          chassis?: Array<{ status: string }>;
        };
        const currentSupplierId = String(purchase.supplierId);
        setSupplierId(currentSupplierId);
        setInitialSupplierId(currentSupplierId);
        setPurchaseBranchId(purchase.branchId);
        setSupplierLocked(Boolean(purchase.chassis?.some((c) => c.status !== 'IN_STOCK')));

        const bikes: BikeUnitEdit[] = [];
        const parts: PartLineEdit[] = [];
        for (const item of (inv as PurchaseInvoiceData).items) {
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
                removable: unit.removable ?? false,
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

  function removeBikeUnit(chassisId: number) {
    const unit = bikeUnits.find((u) => u.chassisId === chassisId);
    if (!unit) return;
    if (!unit.removable) {
      toast('This unit is sold/reserved and cannot be removed from the invoice', 'error');
      return;
    }
    const remainingUnits = bikeUnits.length - 1 - removedChassisIds.filter((id) => id !== chassisId).length;
    const remainingParts = partLines.length - removedPartItemIds.length;
    if (remainingUnits + remainingParts <= 0) {
      toast(
        'Purchase invoice must have at least one item. Use Delete Invoice to remove the whole purchase.',
        'error',
      );
      return;
    }
    setRemovedChassisIds((ids) => (ids.includes(chassisId) ? ids : [...ids, chassisId]));
    setBikeUnits((rows) => rows.filter((r) => r.chassisId !== chassisId));
  }

  function removePartLine(purchaseItemId: number) {
    const remainingUnits = bikeUnits.length;
    const remainingParts = partLines.length - 1 - removedPartItemIds.filter((id) => id !== purchaseItemId).length;
    if (remainingUnits + remainingParts <= 0) {
      toast(
        'Purchase invoice must have at least one item. Use Delete Invoice to remove the whole purchase.',
        'error',
      );
      return;
    }
    setRemovedPartItemIds((ids) => (ids.includes(purchaseItemId) ? ids : [...ids, purchaseItemId]));
    setPartLines((rows) => rows.filter((r) => r.purchaseItemId !== purchaseItemId));
  }

  async function handleSave() {
    if (purchaseId == null) return;
    if (!supplierId) {
      toast('Select a supplier', 'error');
      return;
    }

    const items: NonNullable<Parameters<typeof branchApi.updatePurchaseInvoice>[1]['items']> = [];

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

    const removals: NonNullable<Parameters<typeof branchApi.updatePurchaseInvoice>[1]['removals']> = [
      ...removedChassisIds.map((chassisId) => ({ chassisId })),
      ...removedPartItemIds.map((purchaseItemId) => ({ purchaseItemId })),
    ];

    if (!items.length && !removals.length) {
      toast('Nothing to update', 'error');
      return;
    }

    const payload: Parameters<typeof branchApi.updatePurchaseInvoice>[1] = {};
    if (items.length) payload.items = items;
    if (removals.length) payload.removals = removals;
    if (!supplierLocked && Number(supplierId) !== Number(initialSupplierId)) {
      payload.supplierId = Number(supplierId);
    }

    setSaving(true);
    try {
      await branchApi.updatePurchaseInvoice(purchaseId, payload);
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
          <SupplierAsyncSearchSelect
            branchId={purchaseBranchId}
            label="Supplier account"
            value={supplierId}
            onChange={setSupplierId}
            placeholder="Search supplier…"
            disabled={supplierLocked}
          />
          {supplierLocked && (
            <p className="text-xs text-warning">
              Supplier can&apos;t be changed — this invoice has bikes that are no longer in stock
              (sold or reserved).
            </p>
          )}

          {bikeUnits.map((unit) => (
            <div key={unit.chassisId} className="space-y-3 rounded-lg border border-border bg-surface-alt/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink">{unit.label}</p>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={!unit.removable}
                  title={
                    unit.removable
                      ? 'Remove this unit from the invoice'
                      : 'This unit is sold/reserved and cannot be removed'
                  }
                  onClick={() => removeBikeUnit(unit.chassisId)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
              {unit.identityLocked && (
                <p className="text-xs text-warning">
                  This unit is sold or invoiced — only price and color can be changed.
                </p>
              )}
              {!unit.removable && !unit.identityLocked && (
                <p className="text-xs text-warning">
                  This unit is reserved and cannot be removed from the invoice.
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
            <div key={line.purchaseItemId} className="space-y-3 rounded-lg border border-border bg-surface-alt/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink">{line.label}</p>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  title="Remove this line from the invoice"
                  onClick={() => removePartLine(line.purchaseItemId)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
              <Input
                label={`Unit cost (PKR)`}
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
