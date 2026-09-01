import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Receipt,
  Wallet,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  AlertCircle,
  Clock,
  Ban,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { exportInvoice } from "@/lib/pdf-export";
import { applyPaymentFulfillment } from "@/lib/billing-fulfillment";
import { safeFormatDate } from "@/lib/date-utils";
import StripeCardSection from "@/components/billing/StripeCardSection";

type PayStatus = "Pending" | "Paid" | "Failed" | "Refunded" | "Cancelled";

interface LineItem {
  desc: string;
  qty: number;
  unitPrice: number;
  total: number;
}
interface Invoice {
  id: string;
  invoiceNo: string;
  desc: string;
  date: string;
  dueDate?: string;
  amount: number;
  status: PayStatus;
  paymentMethod?: string;
  paidOn?: string;
  transactionId?: string;
  items: LineItem[];
  category?: string;
  orderNo?: string;
  deliveryFee?: number;
  tax?: number;
  discount?: number;
  pickupBranch?: string;
  deliveryAddress?: string;
}

const STATUS_CONFIG: Record<PayStatus, { label: string; color: string; icon: React.ReactNode }> = {
  Pending: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  Paid: {
    label: "Paid",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  Failed: {
    label: "Failed",
    color: "bg-destructive/10 text-destructive border-destructive/30",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  Refunded: {
    label: "Refunded",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    icon: <RefreshCw className="w-3.5 h-3.5" />,
  },
  Cancelled: {
    label: "Cancelled",
    color: "bg-muted text-muted-foreground border-border",
    icon: <Ban className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ status }: { status: PayStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

function InvoiceCard({ invoice, onPay }: { invoice: Invoice; onPay?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const handleExport = () => {
    exportInvoice({
      invoiceNo: invoice.invoiceNo,
      patient: { name: "Authenticated patient" },
      date: invoice.date,
      items: invoice.items,
      status: invoice.status,
      paymentMethod: invoice.paymentMethod,
      paidOn: invoice.paidOn,
      deliveryFee: invoice.deliveryFee,
      tax: invoice.tax,
      discount: invoice.discount,
      total: invoice.amount,
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={invoice.status} />
              <span className="text-xs text-muted-foreground font-mono">{invoice.invoiceNo}</span>
            </div>
            <h3 className="font-semibold text-foreground">{invoice.desc}</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>Date: {invoice.date}</span>
              {invoice.category && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-primary">
                  {invoice.category}
                </span>
              )}
              {invoice.orderNo && (
                <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Order: {invoice.orderNo}
                </span>
              )}
              {invoice.pickupBranch && (
                <span className="text-muted-foreground">Store: {invoice.pickupBranch}</span>
              )}
              {invoice.deliveryAddress && (
                <span
                  className="text-muted-foreground truncate max-w-[200px]"
                  title={invoice.deliveryAddress}
                >
                  Delivery: {invoice.deliveryAddress}
                </span>
              )}
              {invoice.dueDate && invoice.status === "Pending" && (
                <span className="text-amber-600 font-medium">Due: {invoice.dueDate}</span>
              )}
              {invoice.paymentMethod && <span>Via: {invoice.paymentMethod}</span>}
              {invoice.transactionId && <span className="font-mono">#{invoice.transactionId}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <span className="text-2xl font-bold text-foreground">
              ₱{invoice.amount.toLocaleString()}
            </span>
            <div className="flex gap-2">
              {invoice.status === "Pending" && onPay && (
                <button
                  onClick={onPay}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Pay Now
                </button>
              )}
              <button
                onClick={handleExport}
                title="Download Invoice"
                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg border border-border transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg border border-border transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Itemized breakdown */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 animate-in slide-in-from-top-1 duration-200">
          <div className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-3">
              Itemized Charges
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium text-center w-12">Qty</th>
                    <th className="pb-2 font-medium text-right w-28">Unit Price</th>
                    <th className="pb-2 font-medium text-right w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {invoice.items.map((item, i) => (
                    <tr key={i} className="text-foreground">
                      <td className="py-2 pr-4">{item.desc}</td>
                      <td className="py-2 text-center text-muted-foreground">{item.qty}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        ₱{item.unitPrice.toLocaleString()}
                      </td>
                      <td className="py-2 text-right font-semibold">
                        ₱{item.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={3} className="pt-3 text-right font-bold text-foreground text-sm">
                      Total Due
                    </td>
                    <td className="pt-3 text-right font-bold text-primary text-lg">
                      ₱{invoice.amount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const [isLoading, setIsLoading] = useState(true);
  const [outstanding, setOutstanding] = useState<Invoice[]>([]);
  const [history, setHistory] = useState<Invoice[]>([]);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payAmountError, setPayAmountError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<"all" | PayStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Embedded Stripe Elements (card) state
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [cardStage, setCardStage] = useState<"idle" | "form" | "success">("idle");
  const [cardError, setCardError] = useState("");
  const [paidReference, setPaidReference] = useState("");
  const [mobileNumber, setMobileNumber] = useState("09171234567");
  const [accountName, setAccountName] = useState("");

  const loadData = () => {
    setIsLoading(true);
    Promise.all([apiClient.getAccountData(), apiClient.getPaymentHistory()])
      .then(([accountResult, historyResult]) => {
        const data = accountResult.data;
        setAccountName(String(data?.profile?.name ?? ""));
        const bills = (data?.bills ?? []).map((bill: any) => ({
          id: bill.id,
          invoiceNo: bill.invoiceNo,
          desc: bill.description,
          date: safeFormatDate(bill.createdAt, "bill.created_at"),
          amount: Number(bill.amount),
          status: bill.status as PayStatus,
          category: bill.category,
          orderNo: bill.orderNo,
          paymentMethod: bill.paymentMethod,
          paidOn: bill.paidAt ? safeFormatDate(bill.paidAt, "bill.paid_at") : undefined,
          transactionId: bill.stripePaymentIntentId ?? undefined,
          pickupBranch: bill.pickupBranch || bill.details?.pickupBranch,
          deliveryAddress: bill.deliveryAddress || bill.details?.deliveryAddress,
          deliveryFee: Number(bill.details?.deliveryFee ?? 0),
          tax: Number(bill.details?.tax ?? 0),
          discount: Number(bill.details?.discount ?? 0),
          items: Array.isArray(bill.details?.items)
            ? bill.details.items.map((item: any) => ({
                desc: item.desc,
                qty: Number(item.qty),
                unitPrice: Number(item.unitPrice),
                total: Number(item.total),
              }))
            : [],
        }));
        const billByInvoice = new Map<string, Invoice>(
          bills.map((bill: Invoice) => [bill.invoiceNo, bill]),
        );
        const transactions = (historyResult.data?.transactions ?? []).map((transaction: any) => {
          const source = billByInvoice.get(transaction.invoiceNo);
          return {
            ...(source ?? {
              id: transaction.billId,
              invoiceNo: transaction.invoiceNo,
              desc: transaction.description || `${transaction.category || "Hospital"} payment`,
              date: new Date(transaction.createdAt || Date.now()).toLocaleDateString(),
              category: transaction.category,
              items: [],
            }),
            id: `transaction-${transaction.id}`,
            orderNo: source?.orderNo || transaction.orderNo,
            amount: Number(transaction.amount),
            status: transaction.status as PayStatus,
            paymentMethod: transaction.method || "Stripe",
            paidOn: new Date(transaction.createdAt || Date.now()).toLocaleDateString(),
            transactionId: transaction.transactionId,
            pickupBranch: source?.pickupBranch,
            deliveryAddress: source?.deliveryAddress,
          } as Invoice;
        });
        const transactionInvoiceNos = new Set(
          transactions.map((transaction: { invoiceNo: string }) => transaction.invoiceNo),
        );
        const legacyHistory = bills.filter(
          (bill: Invoice) =>
            bill.status !== "Pending" && !transactionInvoiceNos.has(bill.invoiceNo),
        );
        setOutstanding(bills.filter((bill: Invoice) => bill.status === "Pending"));
        setHistory([...transactions, ...legacyHistory]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
    apiClient.getPaymentConfig().then(({ data }) => {
      if (data?.configured) {
        setStripeConfigured(true);
        if (data.publishableKey) setStripePublishableKey(data.publishableKey);
      }
    });
  }, []);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("checkout_session_id");
    if (!sessionId) return;
    let disposed = false;

    apiClient
      .getCheckoutSession(sessionId)
      .then(async ({ data, error }) => {
        if (disposed) return;

        if (error || !data) {
          toast.error(error ?? "Could not verify the Stripe checkout session.");
          return;
        }

        // Only a Stripe-confirmed "paid" session may mark the bill Paid.
        // Pending / failed / cancelled sessions leave the invoice untouched.
        if (data.paymentStatus !== "paid" || !data.paymentIntentId) {
          toast.warning(
            `Payment not completed (status: ${String(data.paymentStatus)}). Your invoice remains unpaid — you can retry anytime.`,
          );
          return;
        }

        try {
          const result = await applyPaymentFulfillment({
            paymentIntentId: String(data.paymentIntentId),
            amountTotal: Number(data.amountTotal ?? 0),
            patientId: data.metadata?.patient_id || undefined,
            billId: data.metadata?.bill_id || undefined,
            invoiceNo: data.metadata?.invoice_no || undefined,
            orderId: data.metadata?.order_id || undefined,
            orderNo: data.metadata?.order_no || undefined,
            policyId: data.metadata?.policy_id || undefined,
            description: data.metadata?.description || undefined,
          });

          if (result.alreadyProcessed) {
            toast.info("This payment was already recorded in your billing history.");
          } else {
            toast.success("Payment confirmed — your invoice is now marked as Paid.", {
              description: `Stripe reference: ${result.paymentIntentId}`,
            });
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to record the payment locally.");
          return;
        }

        loadData(); // immediate refresh of outstanding/history lists
      })
      .finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });

    return () => {
      disposed = true;
    };
  }, []);

  const totalOutstanding = outstanding.reduce((s, b) => s + b.amount, 0);

  const closePayModal = () => {
    setPayingInvoice(null);
    setCardStage("idle");
    setClientSecret("");
    setCardError("");
    setIsProcessing(false);
  };

  const openPayModal = (invoice: Invoice) => {
    setPayingInvoice(invoice);
    setPayAmount(invoice.amount.toString());
    setPayAmountError("");
    setCardStage("idle");
    setClientSecret("");
    setCardError("");
  };

  const handlePaySingle = (invoice: Invoice) => {
    if (invoice.status !== "Pending") return;
    openPayModal(invoice);
  };

  const handlePayAll = () => {
    if (outstanding.length === 0) return;
    toast.info("Please pay each invoice separately", {
      description: "Each Stripe Checkout session is securely tied to one invoice.",
    });
  };

  const validatePayAmount = (raw: string, max: number): string => {
    const n = parseFloat(raw);
    if (!raw || isNaN(n)) return "Please enter an amount.";
    if (n <= 0) return "Amount must be greater than ₱0.";
    if (n > max) return `Amount cannot exceed ₱${max.toLocaleString()}.`;
    return "";
  };

  const processPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;

    const amountNum = parseFloat(payAmount);
    const err = validatePayAmount(payAmount, payingInvoice.amount);
    if (err) {
      setPayAmountError(err);
      return;
    }

    setIsProcessing(true);

    try {
      if (!stripeConfigured) {
        toast.error(
          "Stripe payments are not connected yet. Please contact the hospital billing office.",
        );
        return;
      }
      if (paymentMethod === "card") {
        // Fallback: without a publishable key we cannot mount Elements — use
        // the hosted Stripe Checkout redirect instead.
        if (!stripePublishableKey) {
          const returnPath = `${window.location.pathname}`;
          const { data: checkoutData, error: checkoutError } =
            await apiClient.createCheckoutSession(amountNum, payingInvoice.desc, {
              invoiceId: payingInvoice.id,
              invoiceNo: payingInvoice.invoiceNo,
              successUrl: `${window.location.origin}${returnPath}`,
              cancelUrl: `${window.location.origin}${returnPath}`,
            });
          if (checkoutError || !checkoutData?.url) {
            toast.error(checkoutError ?? "Unable to start Stripe Checkout.");
            return;
          }
          window.location.assign(checkoutData.url);
          return;
        }

        const { data, error } = await apiClient.createBillPaymentIntent({
          amount: amountNum,
          description: payingInvoice.desc,
          billId: payingInvoice.id,
          invoiceNo: payingInvoice.invoiceNo,
        });
        if (error || !data?.clientSecret) {
          toast.error(error ?? "Unable to initialize the card payment.");
          return;
        }
        setCardError("");
        setClientSecret(data.clientSecret);
        setCardStage("form");
        return;
      }

      toast.error("Unable to start payment for this invoice.");
    } catch {
      toast.error("Payment failed. Please try again or contact billing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardSuccess = async (paymentIntentId: string) => {
    if (!payingInvoice) return;
    try {
      const result = await applyPaymentFulfillment({
        paymentIntentId,
        amountTotal: parseFloat(payAmount),
        billId: payingInvoice.id,
        invoiceNo: payingInvoice.invoiceNo,
        description: payingInvoice.desc,
      });
      setPaidReference(result.paymentIntentId || paymentIntentId);
      setCardStage("success");
      loadData();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Payment captured but recording failed. Contact billing.",
      );
    }
  };

  const handleCardError = (message: string) => {
    setCardError(message);
  };

  const filteredHistory = history.filter(
    (invoice) =>
      (activeHistoryTab === "all" || invoice.status === activeHistoryTab) &&
      (categoryFilter === "all" || invoice.category === categoryFilter),
  );
  const filteredOutstanding = outstanding.filter(
    (invoice) => categoryFilter === "all" || invoice.category === categoryFilter,
  );
  const categories = Array.from(
    new Set([...outstanding, ...history].map((invoice) => invoice.category ?? "Hospital Services")),
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing & Payments</h1>
          <p className="text-muted-foreground">Manage your hospital bills and payment history.</p>
        </div>
        {stripeConfigured && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Stripe payments active</span>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border border-amber-200 dark:border-amber-700/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-amber-600">₱{totalOutstanding.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {outstanding.length} invoice{outstanding.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="bg-card border border-emerald-200 dark:border-emerald-700/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-emerald-600">
            ₱
            {history
              .filter((h) => h.status === "Paid")
              .reduce((s, b) => s + b.amount, 0)
              .toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {history.filter((h) => h.status === "Paid").length} payment
            {history.filter((h) => h.status === "Paid").length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="col-span-2 md:col-span-1 bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Secure Checkout</p>
            <p className="text-sm font-semibold text-foreground">Pay each invoice separately</p>
          </div>
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Outstanding Invoices */}
      <section>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-primary" /> Outstanding Invoices
        </h2>
        {filteredOutstanding.length === 0 ? (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground">
              {outstanding.length === 0 ? "All caught up!" : "No matching bills"}
            </h3>
            <p className="text-muted-foreground mt-1">
              {outstanding.length === 0
                ? "You have no outstanding bills to pay."
                : "Try another billing category."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOutstanding.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} onPay={() => handlePaySingle(inv)} />
            ))}
          </div>
        )}
      </section>

      {/* Payment History */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" /> Payment History
          </h2>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 flex-wrap">
            {(["all", "Paid", "Pending", "Refunded", "Cancelled", "Failed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveHistoryTab(tab)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeHistoryTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab === "all" ? "All" : (STATUS_CONFIG[tab]?.label ?? tab)}
              </button>
            ))}
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All billing categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>
              No {activeHistoryTab === "all" ? "" : activeHistoryTab.toLowerCase() + " "}
              transactions found.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} />
            ))}
          </div>
        )}
      </section>

      {/* Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-semibold text-foreground">Make Payment</h2>
              <button
                onClick={closePayModal}
                disabled={isProcessing}
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {cardStage === "form" && clientSecret ? (
              <div className="p-6 space-y-4">
                <div className="bg-muted/50 rounded-xl p-3 flex justify-between items-center text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {payingInvoice.invoiceNo}
                  </span>
                  <span className="font-bold text-foreground">
                    ₱
                    {parseFloat(payAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {cardError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive"
                  >
                    {cardError}
                  </div>
                )}

                <StripeCardSection
                  key={clientSecret}
                  clientSecret={clientSecret}
                  publishableKey={stripePublishableKey}
                  payLabel={`Pay ₱${parseFloat(payAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  onSuccess={handleCardSuccess}
                  onError={handleCardError}
                />

                <button
                  type="button"
                  onClick={() => {
                    setCardStage("idle");
                    setClientSecret("");
                    setCardError("");
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
                >
                  ← Back to payment details
                </button>
              </div>
            ) : cardStage === "success" ? (
              <div className="p-8 space-y-4 text-center animate-in fade-in">
                <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Payment successful</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    ₱
                    {parseFloat(payAmount).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    paid toward <span className="font-mono text-xs">{payingInvoice.invoiceNo}</span>
                    . A receipt email is on its way.
                  </p>
                </div>
                <p className="text-[11px] font-mono text-muted-foreground break-all">
                  Stripe ref: {paidReference}
                </p>
                <button
                  type="button"
                  onClick={closePayModal}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={processPayment} className="p-6 space-y-5">
                {/* Invoice summary */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice</span>
                    <span className="font-mono text-xs">{payingInvoice.invoiceNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description</span>
                    <span className="font-medium text-right max-w-[55%]">{payingInvoice.desc}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border">
                    <span className="text-muted-foreground">Total Due</span>
                    <span className="font-bold text-foreground">
                      ₱{payingInvoice.amount.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Editable payment amount */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    Amount to Pay
                    <span className="text-muted-foreground font-normal ml-1">
                      (you can pay less than the full balance)
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground select-none">
                      ₱
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={payingInvoice.amount}
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => {
                        setPayAmount(e.target.value);
                        setPayAmountError(validatePayAmount(e.target.value, payingInvoice!.amount));
                      }}
                      className={`w-full pl-8 pr-4 py-3 rounded-lg border bg-background text-lg font-bold focus:outline-none focus:ring-2 transition-all ${payAmountError ? "border-destructive focus:ring-destructive/40" : "border-input focus:ring-primary"}`}
                      required
                    />
                  </div>
                  {payAmountError && (
                    <p className="text-xs text-destructive mt-1">{payAmountError}</p>
                  )}
                  {/* Quick-fill buttons */}
                  <div className="flex gap-2 mt-2">
                    {[25, 50, 75, 100].map((pct) => {
                      const amt = Math.round((payingInvoice!.amount * pct) / 100);
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setPayAmount(amt.toString());
                            setPayAmountError("");
                          }}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            parseFloat(payAmount) === amt
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {pct === 100 ? "Full" : `${pct}%`}
                        </button>
                      );
                    })}
                  </div>
                  {parseFloat(payAmount) > 0 && parseFloat(payAmount) < payingInvoice.amount && (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                      <span className="font-medium">Partial payment.</span> Remaining balance after
                      this: ₱{(payingInvoice.amount - parseFloat(payAmount)).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Payment method */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {[{ id: "card", label: "Card (Visa / Mastercard)" }].map((m) => (
                      <label
                        key={m.id}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-colors ${paymentMethod === m.id ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "border-border hover:bg-muted"}`}
                      >
                        <input
                          type="radio"
                          name="payment_method"
                          value={m.id}
                          checked={paymentMethod === m.id}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="sr-only"
                        />
                        <span className="font-medium text-sm">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {paymentMethod === "card" && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                    Pay securely without leaving this page — your card details are entered in a
                    Stripe-secured field and never touch our servers.
                  </div>
                )}

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  Your payment details are encrypted and secure. A receipt will be sent upon
                  completion.
                </p>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{" "}
                      Preparing secure form…
                    </>
                  ) : (
                    "Continue to Secure Payment"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
