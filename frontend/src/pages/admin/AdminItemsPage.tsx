import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Info } from 'lucide-react';
import { itemsApi, adminApi } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader } from '../../components/layout/PageTransition';
import { Button } from '../../components/ui/Button';
import { DataTable } from '../../components/ui/DataTable';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { TablePagination } from '../../components/ui/TablePagination';
import { SearchSelect } from '../../components/ui/SearchSelect';
import type { Item, Product } from '../../types';

export default function AdminItemsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  // Filters
  const [search, setSearch] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isActive, setIsActive] = useState('true');

  // Metadata for forms
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Modal State
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formProductId, setFormProductId] = useState('');
  const [formColor, setFormColor] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formSalePrice, setFormSalePrice] = useState('');
  const [formStockQty, setFormStockQty] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch Items
  const loadItems = () => {
    setLoading(true);
    itemsApi
      .list({
        page: String(page),
        limit: String(limit),
        search,
        brandId,
        categoryId,
        isActive,
      })
      .then((res) => {
        setItems(res.data);
        setTotal(res.pagination.total);
      })
      .catch((err) => {
        console.error(err);
        toast(err instanceof Error ? err.message : 'Failed to load items', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
  }, [page, brandId, categoryId, isActive]);

  // Load brands, categories, and products on mount
  useEffect(() => {
    adminApi.brands().then(setBrands).catch(console.error);
    adminApi.categories().then(setCategories).catch(console.error);
    adminApi.products({ limit: '1000' }).then((res) => setProducts(res.data)).catch(console.error);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadItems();
  };

  // Resolve colors for the selected product in Form
  const activeFormProduct = products.find((p) => p.id === formProductId);
  const availableColors = activeFormProduct?.colorOptions
    ? activeFormProduct.colorOptions.map((c) => (typeof c === 'string' ? c : c.name))
    : [];

  // Reset form
  const resetForm = (item?: Item) => {
    if (item) {
      setSelectedItem(item);
      setFormProductId(item.productId);
      setFormColor(item.color || '');
      setFormModel(item.model || '');
      setFormCostPrice(String(item.costPrice));
      setFormSalePrice(String(item.salePrice));
      setFormStockQty(String(item.stockQty));
      setFormIsActive(item.isActive);
    } else {
      setSelectedItem(null);
      setFormProductId('');
      setFormColor('');
      setFormModel('');
      setFormCostPrice('');
      setFormSalePrice('');
      setFormStockQty('0');
      setFormIsActive(true);
    }
  };

  const handleCreateOpen = () => {
    resetForm();
    setModal('create');
  };

  const handleEditOpen = (item: Item) => {
    resetForm(item);
    setModal('edit');
  };

  const handleDeleteOpen = (item: Item) => {
    setSelectedItem(item);
    setModal('delete');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProductId) {
      toast('Please select a product', 'error');
      return;
    }
    const cost = parseFloat(formCostPrice);
    const sale = parseFloat(formSalePrice);
    if (isNaN(cost) || cost < 0) {
      toast('Please enter a valid cost price', 'error');
      return;
    }
    if (isNaN(sale) || sale < 0) {
      toast('Please enter a valid sale price', 'error');
      return;
    }

    setSaving(true);
    const body = {
      productId: formProductId,
      color: formColor || undefined,
      model: formModel || undefined,
      costPrice: cost,
      salePrice: sale,
      stockQty: parseInt(formStockQty, 10) || 0,
      isActive: formIsActive,
    };

    try {
      if (modal === 'create') {
        await itemsApi.create(body);
        toast('Item code created successfully', 'success');
      } else if (modal === 'edit' && selectedItem) {
        await itemsApi.update(selectedItem.id, body);
        toast('Item code updated successfully', 'success');
      }
      setModal(null);
      loadItems();
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : 'Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      await itemsApi.delete(selectedItem.id);
      toast('Item deactivated successfully', 'success');
      setModal(null);
      loadItems();
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : 'Failed to delete item', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper to format item code cosmetically
  const formatItemCode = (id: number) => {
    return `ITM-${String(id).padStart(4, '0')}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items Catalog"
        subtitle="Manage unified items variants, pricing and codes"
        action={
          <Button variant="accent" onClick={handleCreateOpen} className="gap-2 shadow-lg shadow-orange-500/20">
            <Plus className="h-4 w-4" />
            New Item Code
          </Button>
        }
      />

      {/* Filter Panel */}
      <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated/60 p-4 shadow-[var(--shadow-elevated)] backdrop-blur-md">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-ink-muted">Search Items</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                placeholder="Search code or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border-light bg-surface pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="w-[160px]">
            <label className="mb-1.5 block text-xs font-semibold text-ink-muted">Brand</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[160px]">
            <label className="mb-1.5 block text-xs font-semibold text-ink-muted">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[140px]">
            <label className="mb-1.5 block text-xs font-semibold text-ink-muted">Status</label>
            <select
              value={isActive}
              onChange={(e) => setIsActive(e.target.value)}
              className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
            >
              <option value="true">Active Only</option>
              <option value="false">Inactive Only</option>
              <option value="">All</option>
            </select>
          </div>

          <Button type="submit" variant="secondary" className="gap-2">
            Filter
          </Button>
        </form>
      </div>

      {/* Data Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-border-light bg-elevated shadow-[var(--shadow-elevated)] overflow-hidden">
          <DataTable
            data={items}
            columns={[
              {
                key: 'id',
                header: 'Item Code',
                render: (r) => <span className="font-mono font-bold text-orange-500">{formatItemCode(r.id)}</span>,
              },
              {
                key: 'product',
                header: 'Product Name',
                render: (r) => (
                  <div>
                    <p className="font-medium text-ink">{r.product.name}</p>
                    <p className="text-xs text-ink-muted">{r.product.type}</p>
                  </div>
                ),
              },
              {
                key: 'brand',
                header: 'Brand / Category',
                render: (r) => (
                  <span className="text-sm text-ink-muted">
                    {r.product.brand?.name ?? '-'} / {r.product.category?.name ?? '-'}
                  </span>
                ),
              },
              {
                key: 'model',
                header: 'Model',
                render: (r) => <span className="text-sm text-ink">{r.model || '-'}</span>,
              },
              {
                key: 'color',
                header: 'Color',
                render: (r) => (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                    {r.color || 'Default'}
                  </span>
                ),
              },
              {
                key: 'costPrice',
                header: 'Cost Price',
                render: (r) => <span className="font-mono text-sm">PKR {Number(r.costPrice).toLocaleString()}</span>,
              },
              {
                key: 'salePrice',
                header: 'Sale Price',
                render: (r) => <span className="font-mono text-sm font-semibold">PKR {Number(r.salePrice).toLocaleString()}</span>,
              },
              {
                key: 'stockQty',
                header: 'Stock',
                render: (r) => (
                  <span className={`font-semibold ${r.stockQty <= 2 ? 'text-warning' : 'text-emerald-600'}`}>
                    {r.stockQty} units
                  </span>
                ),
              },
              {
                key: 'isActive',
                header: 'Status',
                render: (r) => (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      r.isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10' : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10'
                    }`}
                  >
                    {r.isActive ? 'Active' : 'Inactive'}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (r) => (
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleEditOpen(r)} className="p-2">
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleDeleteOpen(r)} className="p-2 text-warning hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
          <TablePagination
            page={page}
            totalPages={Math.ceil(total / limit)}
            totalItems={total}
            rangeStart={total === 0 ? 0 : (page - 1) * limit + 1}
            rangeEnd={Math.min(page * limit, total)}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'edit' ? 'Edit Item Details' : 'Create New Item Code'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">Catalog Product</label>
            <SearchSelect
              value={formProductId}
              onChange={(id) => {
                setFormProductId(id);
                setFormColor(''); // reset selected color on product change
              }}
              disabled={modal === 'edit'}
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.type})`,
              }))}
              placeholder="Select Catalog Product..."
              required
            />
            {activeFormProduct && (
              <p className="mt-1 text-xs text-ink-muted">
                Type: {activeFormProduct.type} · Brand: {activeFormProduct.brand?.name ?? '-'} · Category: {activeFormProduct.category?.name ?? '-'}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Color Variant</label>
              {availableColors.length > 0 ? (
                <select
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                >
                  <option value="">No Color (Default)</option>
                  {availableColors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Red, Blue, Black"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Sub-Model Override (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Standard, Sports Edition"
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Cost Price (PKR)</label>
              <input
                type="number"
                placeholder="0"
                value={formCostPrice}
                onChange={(e) => setFormCostPrice(e.target.value)}
                className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                min="0"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Sale Price (PKR)</label>
              <input
                type="number"
                placeholder="0"
                value={formSalePrice}
                onChange={(e) => setFormSalePrice(e.target.value)}
                className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none"
                min="0"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Initial Stock Qty</label>
              <input
                type="number"
                placeholder="0"
                value={formStockQty}
                onChange={(e) => setFormStockQty(e.target.value)}
                disabled={modal === 'edit'}
                className="w-full rounded-lg border border-border-light bg-surface px-3 py-2 text-sm text-ink focus:border-orange-500 focus:outline-none disabled:bg-slate-50"
                min="0"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border-light text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="isActive" className="text-sm font-semibold text-ink">
              This Item Code is Active
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-border-light pt-4">
            <Button type="button" variant="secondary" onClick={() => setModal(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={saving}>
              {modal === 'edit' ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={modal === 'delete'} onClose={() => setModal(null)} title="Confirm Deactivate">
        <div className="space-y-4">
          <div className="flex gap-3">
            <Info className="h-6 w-6 text-warning flex-shrink-0" />
            <p className="text-sm text-ink-muted">
              Are you sure you want to deactivate item{' '}
              <strong className="text-ink">{selectedItem && formatItemCode(selectedItem.id)}</strong> ({selectedItem?.product.name})?
              Deactivating it will mark it inactive so it won't be listed or selectable on new invoices.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="accent" onClick={handleDeleteConfirm} loading={saving} className="bg-red-500 hover:bg-red-600 focus:ring-red-500">
              Deactivate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
