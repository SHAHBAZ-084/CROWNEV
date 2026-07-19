import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { branchApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useBranchPermission } from '../../hooks/useBranchPermission';
import { InvoiceModalContent } from '../invoice/SaleInvoice';
import { PurchaseInvoiceModalContent } from '../invoice/PurchaseInvoice';
import { ServiceInvoiceModalContent } from '../invoice/ServiceInvoice';
import {
  deletePurchaseInvoiceCompletely,
  deleteSaleInvoiceCompletely,
  deleteServiceInvoiceCompletely,
} from '../../lib/invoiceVouchers';
import { SaleInvoiceEditModal } from './SaleInvoiceEditModal';
import { PurchaseInvoiceEditModal } from './PurchaseInvoiceEditModal';
import type { InvoiceData, PurchaseInvoiceData, ServiceInvoiceData } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type Row = Record<string, unknown>;
export type InvoiceSearchType = 'sale' | 'purchase' | 'service';

export const INVOICE_TYPE_LABELS: Record<InvoiceSearchType, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  service: 'Service',
};

function rowInvoiceNumber(type: InvoiceSearchType, row: Row): string {
  if (type === 'sale') return String(row.saleReference ?? '').trim();
  if (type === 'purchase') return String(row.invoiceNumber ?? row.documentRef ?? '').trim();
  return String(row.reference ?? '').trim();
}

export function ViewInvoicePanel({ branchId }: { branchId: number | null }) {
  const { toast } = useToast();
  const { canUpdate, canDelete, restrictedTitle } = useBranchPermission();
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchType, setSearchType] = useState<InvoiceSearchType>('sale');
  const [searchNo, setSearchNo] = useState('');
  const [matchedRow, setMatchedRow] = useState<Row | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [saleInvoice, setSaleInvoice] = useState<InvoiceData | null>(null);
  const [purchaseInvoice, setPurchaseInvoice] = useState<PurchaseInvoiceData | null>(null);
  const [serviceInvoice, setServiceInvoice] = useState<ServiceInvoiceData | null>(null);

  const [editSaleId, setEditSaleId] = useState<number | null>(null);
  const [editPurchaseId, setEditPurchaseId] = useState<number | null>(null);

  const loadList = useCallback(() => {
    if (!branchId) return;
    setLoading(true);
    const request =
      searchType === 'sale'
        ? branchApi.orders({ type: 'POS', limit: '500' })
        : searchType === 'purchase'
          ? branchApi.purchases(branchId, { limit: '500' })
          : branchApi.serviceInvoices(branchId, { limit: '500' });

    request
      .then((r) => setList(r.data as Row[]))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [branchId, searchType]);

  useEffect(() => {
    setSearchNo('');
    setMatchedRow(null);
    setNotFound(false);
    setSearched(false);
    setSaleInvoice(null);
    setPurchaseInvoice(null);
    setServiceInvoice(null);
    loadList();
  }, [loadList, searchType]);

  async function loadInvoiceDetail(type: InvoiceSearchType, row: Row) {
    const id = Number(row.id);
    setDetailLoading(true);
    setSaleInvoice(null);
    setPurchaseInvoice(null);
    setServiceInvoice(null);
    try {
      if (type === 'sale') {
        setSaleInvoice(await branchApi.orderInvoice(id));
      } else if (type === 'purchase') {
        setPurchaseInvoice(await branchApi.purchaseInvoice(id));
      } else {
        setServiceInvoice(await branchApi.serviceInvoice(id));
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load invoice', 'error');
      setMatchedRow(null);
      setNotFound(true);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchNo.trim().toLowerCase();
    if (!q) {
      setMatchedRow(null);
      setNotFound(true);
      setSearched(true);
      return;
    }
    const found = list.find((row) => rowInvoiceNumber(searchType, row).toLowerCase() === q);
    if (!found) {
      setMatchedRow(null);
      setNotFound(true);
      setSearched(true);
      return;
    }
    setMatchedRow(found);
    setNotFound(false);
    setSearched(true);
    void loadInvoiceDetail(searchType, found);
  }

  function clearResult() {
    setMatchedRow(null);
    setNotFound(false);
    setSearched(false);
    setSaleInvoice(null);
    setPurchaseInvoice(null);
    setServiceInvoice(null);
  }

  async function handleDelete() {
    if (!matchedRow) return;
    const ref = rowInvoiceNumber(searchType, matchedRow) || String(matchedRow.id);
    if (!window.confirm(`Permanently delete invoice #${ref}? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const id = Number(matchedRow.id);
      if (searchType === 'sale') {
        await deleteSaleInvoiceCompletely(id);
      } else if (searchType === 'purchase') {
        await deletePurchaseInvoiceCompletely(id);
      } else {
        await deleteServiceInvoiceCompletely(id);
      }
      toast('Invoice deleted', 'success');
      clearResult();
      setSearchNo('');
      loadList();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete invoice', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function handleEditSaved() {
    loadList();
    if (matchedRow) {
      void loadInvoiceDetail(searchType, matchedRow);
    }
  }

  const invoiceRef = matchedRow ? rowInvoiceNumber(searchType, matchedRow) || String(matchedRow.id) : '';
  const canEdit = searchType !== 'service';

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div className="space-y-1.5">
          <label htmlFor="view-invoice-type" className="block text-sm font-medium text-text">
            Category
          </label>
          <select
            id="view-invoice-type"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as InvoiceSearchType)}
            className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="sale">Sale</option>
            <option value="purchase">Purchase</option>
            <option value="service">Service</option>
          </select>
        </div>
        <Input
          label="Invoice Number"
          value={searchNo}
          onChange={(e) => setSearchNo(e.target.value)}
          placeholder="Enter invoice number..."
          required
        />
        <Button type="submit" variant="accent" size="sm" loading={loading} className="lg:mb-0.5">
          Search
        </Button>
      </form>

      {searched && notFound && (
        <p className="rounded-xl border border-border bg-surface-alt/50 px-4 py-3 text-sm text-text-muted">
          No invoice found for that number in {INVOICE_TYPE_LABELS[searchType]} invoices.
        </p>
      )}

      {matchedRow && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-text">
                {INVOICE_TYPE_LABELS[searchType]} Invoice #{invoiceRef}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!canUpdate || detailLoading}
                  title={!canUpdate ? restrictedTitle : undefined}
                  onClick={() => {
                    const id = Number(matchedRow.id);
                    if (searchType === 'sale') setEditSaleId(id);
                    else if (searchType === 'purchase') setEditPurchaseId(id);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                size="sm"
                loading={deleting}
                disabled={!canDelete || detailLoading}
                title={!canDelete ? restrictedTitle : 'Permanently delete invoice'}
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>

          {searchType === 'sale' && (
            <InvoiceModalContent loading={detailLoading} invoice={saleInvoice} />
          )}
          {searchType === 'purchase' && (
            <PurchaseInvoiceModalContent loading={detailLoading} invoice={purchaseInvoice} />
          )}
          {searchType === 'service' && (
            <ServiceInvoiceModalContent loading={detailLoading} invoice={serviceInvoice} />
          )}
        </div>
      )}

      <SaleInvoiceEditModal
        open={editSaleId !== null}
        orderId={editSaleId}
        onClose={() => setEditSaleId(null)}
        onSaved={handleEditSaved}
      />
      <PurchaseInvoiceEditModal
        open={editPurchaseId !== null}
        purchaseId={editPurchaseId}
        onClose={() => setEditPurchaseId(null)}
        onSaved={handleEditSaved}
      />
    </div>
  );
}
