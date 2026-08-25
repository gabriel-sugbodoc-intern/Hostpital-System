import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Package, Filter, AlertTriangle, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import SearchFilter from '@/components/portal/admin/SearchFilter';
import StatusBadge from '@/components/portal/admin/StatusBadge';

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  price: string;
  stock: number;
  reorderLevel: number;
  brand: string;
  supplier: string;
  prescriptionRequired: number;
  imageUrl: string;
  unitPrice?: number;
  status: string;
};

const CATEGORIES = [
  'Over-the-Counter Medicines',
  'Prescription Medicines (Demo Only)',
  'Vitamins & Supplements',
  'Medical Supplies',
  'First Aid',
  'Personal Care',
  'Medical Devices',
];

function ProductModal({ product, onClose, onSave }: {
  product: Partial<Product> | null;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
}) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    category: product?.category ?? CATEGORIES[0],
    price: product?.price ?? '',
    stock: product?.stock ?? 0,
    reorderLevel: product?.reorderLevel ?? 10,
    brand: product?.brand ?? '',
    supplier: product?.supplier ?? 'MedSupply Cebu',
    prescriptionRequired: (product?.prescriptionRequired ?? 0) === 1,
  });
  const [saving, setSaving] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? target.checked : value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) { toast.error('Name and price are required.'); return; }
    setSaving(true);
    await onSave({ ...form, prescriptionRequired: form.prescriptionRequired ? 1 : 0 });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-bold text-foreground">{isEdit ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Product Name *</label>
            <input name="name" value={form.name} onChange={handle} required className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category</label>
            <select name="category" value={form.category} onChange={handle} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Price (₱) *</label>
              <input name="price" value={form.price} onChange={handle} required type="number" min="0" step="0.01" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Stock</label>
              <input name="stock" value={form.stock} onChange={handle} type="number" min="0" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Reorder Level</label>
              <input name="reorderLevel" value={form.reorderLevel} onChange={handle} type="number" min="0" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Brand</label>
              <input name="brand" value={form.brand} onChange={handle} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Supplier</label>
            <input name="supplier" value={form.supplier} onChange={handle} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handle} rows={2} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="prescriptionRequired" name="prescriptionRequired" checked={form.prescriptionRequired} onChange={handle} className="rounded border-input w-4 h-4" />
            <label htmlFor="prescriptionRequired" className="text-sm text-foreground select-none cursor-pointer">Prescription required</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  // undefined = modal closed; null = creating new; Product = editing
  const [modalProduct, setModalProduct] = useState<Partial<Product> | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    apiClient.getAdminInventory?.({
      search: searchQuery,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }).then(({ data, error }) => {
      if (error) toast.error(error);
      else if (data) setProducts((data as any).products ?? []);
    }).finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, [searchQuery, categoryFilter, statusFilter]);

  const filteredProducts = products.filter(p => {
    return !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const categories = Array.from(new Set(products.map(p => p.category)));
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.reorderLevel).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  const handleSave = async (data: Record<string, any>) => {
    if (modalProduct?.id) {
      const result = await apiClient.updateAdminProduct(modalProduct.id, data);
      if (result.error) { toast.error(result.error); return; }
      toast.success('Product updated.');
      setProducts(prev => prev.map(p => p.id === modalProduct.id ? { ...p, ...(result.data?.product as Product) } : p));
    } else {
      const result = await apiClient.createAdminProduct(data);
      if (result.error) { toast.error(result.error); return; }
      toast.success('Product created.');
      load();
    }
    setModalProduct(undefined);
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeletingId(product.id);
    const result = await apiClient.deleteAdminProduct(product.id);
    setDeletingId(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success('Product deleted.');
    setProducts(prev => prev.filter(p => p.id !== product.id));
  };

  const updateStock = async (product: Product) => {
    const nextStock = window.prompt(`Update stock for "${product.name}":`, String(product.stock));
    if (nextStock === null) return;
    const stock = Number(nextStock);
    if (!Number.isInteger(stock) || stock < 0) { toast.error('Stock must be a non-negative whole number.'); return; }
    const result = await apiClient.updateAdminInventoryStock(product.id, stock);
    if (result.error || !result.data) { toast.error(result.error ?? 'Could not update stock.'); return; }
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, ...(result.data!.product as Product) } : p));
    toast.success('Stock updated.');
  };

  return (
    <div className="space-y-6 animate-in slide-up">
      {modalProduct !== undefined && (
        <ProductModal product={modalProduct} onClose={() => setModalProduct(undefined)} onSave={handleSave} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Store Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            {lowStockCount > 0 && <span className="ml-2 text-orange-600 font-medium">{lowStockCount} low stock</span>}
            {outOfStockCount > 0 && <span className="ml-1 text-red-600 font-medium">· {outOfStockCount} out of stock</span>}
          </p>
        </div>
        <button
          onClick={() => setModalProduct(null)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Alert */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-700 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-orange-900">Inventory Alert</p>
            <p className="text-sm text-orange-800 mt-1">
              {outOfStockCount > 0 && `${outOfStockCount} item${outOfStockCount !== 1 ? 's' : ''} out of stock. `}
              {lowStockCount > 0 && `${lowStockCount} item${lowStockCount !== 1 ? 's' : ''} below reorder level.`}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchFilter value={searchQuery} onChange={setSearchQuery} placeholder="Search by product name or category..." className="flex-1" />
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="font-medium text-foreground">No products found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or add a new product.</p>
          <button onClick={() => setModalProduct(null)} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Add Product</button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Stock</th>
                  <th className="px-4 py-3 text-left font-medium">Price</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map(product => {
                  const isLow = product.stock > 0 && product.stock <= product.reorderLevel;
                  const isOut = product.stock === 0;
                  const price = product.unitPrice ?? Number(product.price);
                  return (
                    <tr key={product.id} className={`hover:bg-muted/30 transition-colors ${isOut ? 'bg-red-50/50' : isLow ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{product.name}</div>
                        {product.brand && <div className="text-xs text-muted-foreground">{product.brand}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{product.category}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-foreground'}`}>{product.stock}</span>
                        <span className="text-xs text-muted-foreground ml-1">(min {product.reorderLevel})</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">₱{price.toFixed(2)}</td>
                      <td className="px-4 py-3"><StatusBadge status={product.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{product.supplier || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => updateStock(product)} className="rounded-lg border border-primary/30 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">Stock</button>
                          <button onClick={() => setModalProduct(product)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(product)} disabled={deletingId === product.id} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border">
            {filteredProducts.map(product => {
              const isLow = product.stock > 0 && product.stock <= product.reorderLevel;
              const isOut = product.stock === 0;
              const price = product.unitPrice ?? Number(product.price);
              return (
                <div key={product.id} className={`px-4 py-4 ${isOut ? 'bg-red-50/50' : isLow ? 'bg-orange-50/50' : ''}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{product.category}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setModalProduct(product)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(product)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div><span className="text-muted-foreground">Stock: </span><span className={`font-bold ${isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-foreground'}`}>{product.stock}</span></div>
                    <div><span className="text-muted-foreground">Price: </span><span className="font-mono">₱{price.toFixed(2)}</span></div>
                  </div>
                  <button onClick={() => updateStock(product)} className="mt-2 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10">Update Stock</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
