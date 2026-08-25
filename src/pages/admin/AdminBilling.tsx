import React, { useEffect, useState, useMemo } from 'react';
import {
  CreditCard, RefreshCw, Search, ShoppingBag, DollarSign,
  Clock, CheckCircle2, AlertCircle, Eye, Download, X,
  Building2, Truck, User, Calendar, Hash, FileText, ArrowUpDown
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import StatusBadge from '@/components/portal/admin/StatusBadge';
import { exportInvoice } from '@/lib/pdf-export';

export interface BillItem {
  productName: string;
  brand?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AdminBill {
  id: string;
  invoiceNo: string;
  patientId?: string;
  patientName: string;
  patientEmail?: string;
  description: string;
  category: string;
  amount: string;
  status: string;
  paymentMethod?: string | null;
  createdAt: string;
  paidAt?: string | null;
  orderId?: string;
  orderNo?: string;
  transactionId?: string;
  fulfillmentType?: string;
  pickupBranch?: string;
  deliveryAddress?: string;
  deliveryFee?: number;
  subtotal?: number;
  items: BillItem[];
}

export default function AdminBilling() {
  const [bills, setBills] = useState<AdminBill[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<AdminBill | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await apiClient.getAdminBilling({
      search: search.trim() || undefined,
      status: status === 'all' ? undefined : status,
      category: category === 'all' ? undefined : category,
    });
    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      setBills(result.data.bills as AdminBill[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, [search, status, category]);

  // KPI Calculations
  const stats = useMemo(() => {
    let totalCollected = 0;
    let storeRevenue = 0;
    let outstanding = 0;
    let paidCount = 0;
    let storeOrdersCount = 0;

    for (const b of bills) {
      const amt = Number(b.amount) || 0;
      if (b.status === 'Paid') {
        totalCollected += amt;
        paidCount++;
        if (b.category === 'Medical Store' || b.orderNo) {
          storeRevenue += amt;
          storeOrdersCount++;
        }
      } else if (b.status === 'Pending' || b.status === 'Pending Payment') {
        outstanding += amt;
      }
    }

    return {
      totalCollected,
      storeRevenue,
      outstanding,
      paidCount,
      storeOrdersCount,
      totalCount: bills.length,
    };
  }, [bills]);

  const handleExportInvoice = (bill: AdminBill) => {
    exportInvoice({
      invoiceNo: bill.invoiceNo,
      patient: {
        name: bill.patientName,
      },
      date: new Date(bill.createdAt).toLocaleDateString('en-PH'),
      items: bill.items.map((i) => ({
        desc: `${i.productName}${i.brand ? ` (${i.brand})` : ''}`,
        qty: i.quantity,
        unitPrice: i.unitPrice,
        total: i.lineTotal,
      })),
      status: bill.status as any,
      paymentMethod: bill.paymentMethod || undefined,
      paidOn: bill.paidAt ? new Date(bill.paidAt).toLocaleDateString('en-PH') : undefined,
      deliveryFee: bill.deliveryFee,
      total: Number(bill.amount),
    });
  };

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <CreditCard className="h-6 w-6 text-primary" />
            Billing & Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete reconciliation of Medical Store purchases, patient bills, and Stripe transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Collected</p>
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">₱{stats.totalCollected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stats.paidCount} paid transactions</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medical Store Revenue</p>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">₱{stats.storeRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-muted-foreground">{stats.storeOrdersCount} store orders fulfilled</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outstanding Balance</p>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">₱{stats.outstanding.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pending patient settlements</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Invoices</p>
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{stats.totalCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Synchronized database records</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice #, order #, patient name, product, or Stripe ID..."
            className="min-h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Categories</option>
            <option value="Medical Store">Medical Store</option>
            <option value="Consultations">Consultations</option>
            <option value="Laboratory">Laboratory</option>
            <option value="Insurance">Insurance</option>
            <option value="Healthcare">Healthcare</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Outstanding / Pending</option>
            <option value="Failed">Failed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Refunded">Refunded</option>
          </select>
        </div>
      </div>

      {/* Bills & Transactions Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading && !bills.length ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
            Loading live billing and store records...
          </div>
        ) : !bills.length ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No billing records match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Invoice & Order</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Description & Store Info</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Payment / Ref</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <p className="font-mono font-semibold text-foreground">{bill.invoiceNo}</p>
                        {bill.orderNo && (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                            <ShoppingBag className="w-3 h-3" />
                            {bill.orderNo}
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(bill.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-foreground">{bill.patientName}</p>
                      {bill.patientEmail && <p className="text-xs text-muted-foreground">{bill.patientEmail}</p>}
                      {bill.patientId && <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">ID: {bill.patientId.slice(0, 8)}...</p>}
                    </td>
                    <td className="px-5 py-4 max-w-xs">
                      <p className="font-medium text-foreground truncate">{bill.description}</p>
                      {bill.pickupBranch && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-primary shrink-0" />
                          <span className="truncate">Branch: {bill.pickupBranch}</span>
                        </p>
                      )}
                      {bill.deliveryAddress && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Truck className="w-3 h-3 text-primary shrink-0" />
                          <span className="truncate">{bill.deliveryAddress}</span>
                        </p>
                      )}
                      {bill.items && bill.items.length > 0 && bill.category === 'Medical Store' && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {bill.items.reduce((sum, i) => sum + i.quantity, 0)} items ({bill.items.map(i => i.productName).slice(0, 2).join(', ')}{bill.items.length > 2 ? '...' : ''})
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        bill.category === 'Medical Store'
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                          : bill.category === 'Insurance'
                          ? 'bg-purple-500/10 text-purple-600 border-purple-500/30'
                          : 'bg-accent text-accent-foreground border-border'
                      }`}>
                        {bill.category}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-foreground">
                        ₱{Number(bill.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={bill.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">{bill.paymentMethod || (bill.status === 'Paid' ? 'Stripe' : '—')}</p>
                        {bill.transactionId && (
                          <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[130px]" title={bill.transactionId}>
                            #{bill.transactionId}
                          </p>
                        )}
                        {bill.paidAt && (
                          <p className="text-[10px] text-emerald-600">
                            Paid: {new Date(bill.paidAt).toLocaleDateString('en-PH')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedBill(bill)}
                          title="View Full Breakdown"
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </button>
                        <button
                          onClick={() => handleExportInvoice(bill)}
                          title="Export PDF Receipt"
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg border border-border transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Itemized Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Transaction & Invoice Details
                </h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{selectedBill.invoiceNo}</p>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Patient</p>
                  <p className="font-semibold text-foreground text-sm mt-0.5">{selectedBill.patientName}</p>
                  {selectedBill.patientEmail && <p className="text-xs text-muted-foreground truncate">{selectedBill.patientEmail}</p>}
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Category / Status</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{selectedBill.category}</span>
                    <StatusBadge status={selectedBill.status} />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3 col-span-2 sm:col-span-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total Amount</p>
                  <p className="font-bold text-primary text-lg mt-0.5">₱{Number(selectedBill.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Order & Store Metadata */}
              {(selectedBill.orderNo || selectedBill.pickupBranch || selectedBill.deliveryAddress || selectedBill.transactionId) && (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order & Payment Reference</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {selectedBill.orderNo && (
                      <p><span className="text-muted-foreground">Order Number:</span> <span className="font-mono font-medium">{selectedBill.orderNo}</span></p>
                    )}
                    {selectedBill.transactionId && (
                      <p><span className="text-muted-foreground">Stripe ID:</span> <span className="font-mono font-medium">#{selectedBill.transactionId}</span></p>
                    )}
                    {selectedBill.paymentMethod && (
                      <p><span className="text-muted-foreground">Payment Method:</span> <span className="font-medium">{selectedBill.paymentMethod}</span></p>
                    )}
                    {selectedBill.paidAt && (
                      <p><span className="text-muted-foreground">Paid At:</span> <span className="font-medium">{new Date(selectedBill.paidAt).toLocaleString('en-PH')}</span></p>
                    )}
                    {selectedBill.pickupBranch && (
                      <p className="sm:col-span-2"><span className="text-muted-foreground">Pickup Store / Branch:</span> <span className="font-medium">{selectedBill.pickupBranch}</span></p>
                    )}
                    {selectedBill.deliveryAddress && (
                      <p className="sm:col-span-2"><span className="text-muted-foreground">Delivery Address:</span> <span className="font-medium">{selectedBill.deliveryAddress}</span></p>
                    )}
                  </div>
                </div>
              )}

              {/* Itemized Table */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Itemized Charges</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">Item Description</th>
                        <th className="px-4 py-2.5 text-center w-16">Qty</th>
                        <th className="px-4 py-2.5 text-right w-28">Unit Price</th>
                        <th className="px-4 py-2.5 text-right w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedBill.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-foreground">{item.productName}</p>
                            {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-center text-muted-foreground">{item.quantity}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">₱{item.unitPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-foreground">₱{item.lineTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t border-border">
                      {selectedBill.deliveryFee !== undefined && selectedBill.deliveryFee > 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-1.5 text-right text-xs text-muted-foreground">Delivery Fee:</td>
                          <td className="px-4 py-1.5 text-right text-xs font-medium text-foreground">₱{selectedBill.deliveryFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-foreground">Grand Total:</td>
                        <td className="px-4 py-3 text-right font-bold text-primary text-base">₱{Number(selectedBill.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-4">
              <button
                onClick={() => handleExportInvoice(selectedBill)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
              >
                <Download className="w-4 h-4 text-primary" />
                Download PDF Receipt
              </button>
              <button
                onClick={() => setSelectedBill(null)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
