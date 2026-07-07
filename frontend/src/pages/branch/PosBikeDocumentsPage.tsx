import { useCallback, useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { branchApi, adminApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce } from '../../hooks/useDebounce';
import { PageHeader } from '../../components/layout/PageTransition';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DataTable } from '../../components/ui/DataTable';
import { Search, Loader2 } from 'lucide-react';

type Row = Record<string, any>;

export default function PosBikeDocumentsPage() {
  const location = useLocation();
  const { toast } = useToast();
  const isAdmin = location.pathname.startsWith('/admin');

  // Branch state
  const [branches, setBranches] = useState<Row[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  
  // Search and list state
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_SUPPLIER' | 'PENDING_CUSTOMER'>('ALL');
  const [bikes, setBikes] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // Checklist modal state
  const [selectedChassis, setSelectedChassis] = useState<Row | null>(null);
  const [checklist, setChecklist] = useState<Row | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Load branches if admin
  useEffect(() => {
    if (isAdmin) {
      adminApi.branches()
        .then((r) => setBranches(r as Row[]))
        .catch(console.error);
    }
  }, [isAdmin]);

  // Load bikes list
  const loadBikes = useCallback(async () => {
    setLoading(true);
    try {
      let data: Row[] = [];
      if (isAdmin) {
        data = await adminApi.allBikeDocuments({
          search: search || undefined,
          status: statusFilter,
          branchId: selectedBranchId ? selectedBranchId : undefined,
        });
      } else {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        const branchId = user?.branchId;
        if (branchId) {
          data = await branchApi.bikeDocuments(branchId, {
            search: search || undefined,
            status: statusFilter,
          });
        }
      }
      setBikes(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load bikes', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, search, statusFilter, selectedBranchId, toast]);

  useEffect(() => {
    loadBikes();
  }, [loadBikes]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  // Fetch checklist for modal
  const openChecklist = async (chassis: Row) => {
    setSelectedChassis(chassis);
    setLoadingChecklist(true);
    try {
      const data = await branchApi.bikeDocumentChecklist(chassis.branchId, chassis.id);
      setChecklist(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load checklist', 'error');
      setSelectedChassis(null);
    } finally {
      setLoadingChecklist(false);
    }
  };

  const closeChecklist = () => {
    setSelectedChassis(null);
    setChecklist(null);
  };

  // Toggle document checklist item
  const handleToggleDoc = async (
    doc: Row,
    field: 'receivedFromSupplier' | 'givenToCustomer',
    checked: boolean
  ) => {
    if (!selectedChassis) return;
    const toggleKey = `${doc.id}-${field}`;
    setTogglingId(toggleKey);
    try {
      await branchApi.updateBikeDocument(selectedChassis.branchId, selectedChassis.id, doc.id, {
        [field]: checked,
      });
      const updated = await branchApi.bikeDocumentChecklist(selectedChassis.branchId, selectedChassis.id);
      setChecklist(updated);
      toast('Document checklist updated', 'success');
      loadBikes();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const columns = useMemo(() => {
    const list = [
      {
        key: 'chassisNumber',
        header: 'Chassis Number',
        render: (r: Row) => <span className="font-mono font-medium">{r.chassisNumber}</span>,
      },
      {
        key: 'product',
        header: 'Model',
        render: (r: Row) => <span>{String(r.product?.name ?? '—')}</span>,
      },
    ];

    if (isAdmin) {
      list.push({
        key: 'branch',
        header: 'Branch',
        render: (r: Row) => <span>{String(r.branch?.name ?? '—')}</span>,
      });
    }

    list.push(
      {
        key: 'status',
        header: 'Status',
        render: (r: Row) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              r.status === 'SOLD'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {r.status === 'SOLD' ? 'Sold' : 'In Stock'}
          </span>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        render: (r: Row) => <span>{r.status === 'SOLD' ? String(r.customerName ?? 'Walk-in Customer') : '—'}</span>,
      },
      {
        key: 'supplierPending',
        header: 'Supplier Docs',
        render: (r: Row) => {
          const total = r.documents?.length ?? 0;
          const received = total - r.pendingSupplierCount;
          return (
            <span className={r.pendingSupplierCount > 0 ? 'text-orange-600 font-semibold' : 'text-green-600 font-semibold'}>
              {received} / {total}
            </span>
          );
        },
      },
      {
        key: 'customerPending',
        header: 'Customer Docs',
        render: (r: Row) => {
          if (r.status !== 'SOLD') return <span className="text-gray-400">—</span>;
          const total = r.documents?.length ?? 0;
          const given = total - r.pendingCustomerCount;
          return (
            <span className={r.pendingCustomerCount > 0 ? 'text-orange-600 font-semibold' : 'text-green-600 font-semibold'}>
              {given} / {total}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: '',
        render: (r: Row) => (
          <Button size="sm" variant="ghost" onClick={() => openChecklist(r)}>
            View
          </Button>
        ),
      }
    );

    return list;
  }, [isAdmin]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bike Documents"
        subtitle="Manage and track physical document handovers from suppliers to customers"
      />

      <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="mb-6 flex flex-wrap gap-3">
          <div className="flex max-w-xs flex-1 gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search chassis, customer..."
            />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Document Statuses</option>
              <option value="PENDING_SUPPLIER">Missing Supplier Docs</option>
              <option value="PENDING_CUSTOMER">Missing Customer Docs</option>
            </Select>
          </div>

          {isAdmin && (
            <div className="w-64">
              <SearchSelect
                placeholder="All Branches"
                value={selectedBranchId}
                onChange={setSelectedBranchId}
                options={branches.map((b) => ({ value: String(b.id), label: String(b.name) }))}
              />
            </div>
          )}

          {search && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSearchInput('')}
            >
              Clear Search
            </Button>
          )}
        </form>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={bikes}
            emptyMessage="No matching bike documents tracked yet"
          />
        )}
      </div>

      <Modal
        open={selectedChassis !== null}
        onClose={closeChecklist}
        title={`Documents for Chassis: ${selectedChassis?.chassisNumber ?? ''}`}
        size="lg"
      >
        {loadingChecklist ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-surface-alt p-4 text-sm">
              <div>
                <span className="text-gray-500">Bike Model:</span>{' '}
                <strong className="text-ink">{checklist?.product?.name}</strong>
              </div>
              <div>
                <span className="text-gray-500">Sale status:</span>{' '}
                <strong className="text-ink">
                  {selectedChassis?.status === 'SOLD' ? 'Sold' : 'In Stock'}
                </strong>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Received from supplier */}
              <div className="rounded-xl border border-border p-4 bg-white">
                <h3 className="mb-4 font-display text-sm font-bold text-brand">Received from Supplier</h3>
                <div className="space-y-3">
                  {checklist?.documents?.map((doc: Row) => {
                    const toggling = togglingId === `${doc.id}-receivedFromSupplier`;
                    return (
                      <div key={doc.id} className="flex items-start gap-3 rounded-lg border border-border/40 p-2.5 hover:bg-surface-alt/20">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                          checked={doc.receivedFromSupplier}
                          disabled={toggling}
                          onChange={(e) => handleToggleDoc(doc, 'receivedFromSupplier', e.target.checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink">{doc.documentType?.name}</p>
                          {doc.receivedFromSupplier && doc.receivedAt && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              On {new Date(doc.receivedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {toggling && <Loader2 className="h-4 w-4 animate-spin text-brand mt-1" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Given to customer */}
              <div className="rounded-xl border border-border p-4 bg-white">
                <h3 className="mb-4 font-display text-sm font-bold text-brand">Given to Customer</h3>
                {selectedChassis?.status !== 'SOLD' ? (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-center p-4">
                    <p className="text-xs text-gray-400">
                      This bike has not been sold yet.<br />Documents cannot be given to a customer.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checklist?.documents?.map((doc: Row) => {
                      const toggling = togglingId === `${doc.id}-givenToCustomer`;
                      const disabled = !doc.receivedFromSupplier || toggling;
                      return (
                        <div
                          key={doc.id}
                          className={`flex items-start gap-3 rounded-lg border p-2.5 ${
                            !doc.receivedFromSupplier
                              ? 'border-gray-100 bg-gray-50/50 opacity-60'
                              : 'border-border/40 hover:bg-surface-alt/20'
                          }`}
                          title={!doc.receivedFromSupplier ? 'Receive from supplier first' : undefined}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                            checked={doc.givenToCustomer}
                            disabled={disabled}
                            onChange={(e) => handleToggleDoc(doc, 'givenToCustomer', e.target.checked)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ink">{doc.documentType?.name}</p>
                            {!doc.receivedFromSupplier && (
                              <p className="text-[10px] text-orange-600 font-medium mt-0.5">
                                Mark as received first
                              </p>
                            )}
                            {doc.givenToCustomer && doc.givenAt && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                On {new Date(doc.givenAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          {toggling && <Loader2 className="h-4 w-4 animate-spin text-brand mt-1" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={closeChecklist}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
