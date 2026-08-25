import React, { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import StatusBadge from '@/components/portal/admin/StatusBadge';

type AdminOrder = {
  id: string;
  orderNo: string;
  patientName: string;
  fulfillmentType: string;
  deliveryAddress?: string | null;
  status: string;
  paymentStatus?: string;
  total: string;
  createdAt: string;
  receivedAt?: string | null;
  items: Array<{ productName: string; quantity: number }>;
};

const ORDER_STATUSES = ['Pending', 'Payment Confirmed', 'Preparing', 'Ready for Pickup', 'Awaiting Courier', 'Out for Delivery', 'Delivered', 'Received', 'Completed', 'Cancelled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const result = await apiClient.getAdminOrders({ search, status: status === 'all' ? undefined : status });
    if (result.error) toast.error(result.error);
    else if (result.data) {
      setOrders(result.data.orders as AdminOrder[]);
      setLastRefresh(new Date());
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    const interval = window.setInterval(fetchOrders, 15000);
    return () => window.clearInterval(interval);
  }, [search, status]);

  const updateStatus = async (order: AdminOrder, nextStatus: string) => {
    setUpdatingId(order.id);
    const result = await apiClient.updateAdminOrderStatus(order.id, { status: nextStatus });
    setUpdatingId(null);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Could not update order.');
      return;
    }
    setOrders(current => current.map(item => item.id === order.id ? { ...item, status: nextStatus } : item));
    toast.success(`Order ${order.orderNo} updated`);
  };

  return (
    <div className="space-y-6 animate-in slide-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardList className="h-6 w-6 text-primary" />Orders Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">{orders.length} order{orders.length === 1 ? '' : 's'} · synchronized with the patient store</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {lastRefresh && <span>Updated {lastRefresh.toLocaleTimeString()}</span>}
          <button onClick={fetchOrders} disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order number, patient, or address..." className="min-h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </label>
        <select value={status} onChange={event => setStatus(event.target.value)} className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map(item => <option key={item}>{item}</option>)}
        </select>
      </div>

      {loading && !orders.length ? <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading orders...</div> : !orders.length ? <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center"><ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/50" /><p className="mt-3 font-medium">No orders found</p></div> : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Order</th><th className="px-5 py-3">Patient</th><th className="px-5 py-3">Products</th><th className="px-5 py-3">Fulfillment</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Delivery</th></tr></thead>
              <tbody className="divide-y divide-border">
                {orders.map(order => <tr key={order.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4"><p className="font-mono font-semibold">{order.orderNo}</p><p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString('en-PH')}</p></td>
                  <td className="px-5 py-4"><p className="font-medium">{order.patientName}</p><p className="max-w-44 truncate text-xs text-muted-foreground">{order.deliveryAddress || 'Pharmacy pickup'}</p></td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">{order.items.map(item => `${item.quantity} × ${item.productName}`).join(', ')}</td>
                  <td className="px-5 py-4 capitalize">{order.fulfillmentType}</td>
                  <td className="px-5 py-4 font-semibold">₱{Number(order.total).toLocaleString()}</td>
                  <td className="px-5 py-4"><select disabled={updatingId === order.id} value={order.paymentStatus ?? 'Pending'} onChange={async event => { setUpdatingId(order.id); const result = await apiClient.updateAdminOrderStatus(order.id, { paymentStatus: event.target.value }); setUpdatingId(null); if (result.error) toast.error(result.error); else { setOrders(current => current.map(item => item.id === order.id ? { ...item, paymentStatus: event.target.value } : item)); toast.success('Payment status updated'); } }} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-medium"><option>Pending</option><option>Paid</option><option>Failed</option><option>Refunded</option></select></td>
                  <td className="px-5 py-4"><select disabled={updatingId === order.id} value={order.status} onChange={event => updateStatus(order, event.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-medium"><option>{order.status}</option>{ORDER_STATUSES.filter(item => item !== order.status).map(item => <option key={item}>{item}</option>)}</select>{order.status === 'Received' && <p className="mt-1 text-[11px] font-medium text-emerald-700">Customer confirmed delivery</p>}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-border md:hidden">
            {orders.map(order => <article key={order.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-mono font-semibold">{order.orderNo}</p><p className="text-sm">{order.patientName}</p><p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString('en-PH')}</p></div><StatusBadge status={order.status} /></div>
              <p className="text-xs text-muted-foreground">{order.items.map(item => `${item.quantity} × ${item.productName}`).join(', ')}</p>
              <div className="flex items-center justify-between gap-3"><span className="font-semibold">₱{Number(order.total).toLocaleString()}</span><select disabled={updatingId === order.id} value={order.status} onChange={event => updateStatus(order, event.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"><option>{order.status}</option>{ORDER_STATUSES.filter(item => item !== order.status).map(item => <option key={item}>{item}</option>)}</select></div>
              {order.status === 'Received' && <p className="text-xs font-medium text-emerald-700">Customer confirmed delivery</p>}
            </article>)}
          </div>
        </div>
      )}
    </div>
  );
}