import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "@/lib/router-compat";
import {
  ArrowRight, BadgeCheck, Banknote, CheckCircle2, ChevronDown, Clock3,
  CreditCard, ExternalLink, Lock, Minus, Package, Plus, RefreshCw,
  Search, Shield, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Star,
  Store as StoreIcon, Truck, X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { applyPaymentFulfillment } from "@/lib/billing-fulfillment";

type Product = {
  id: string; name: string; description: string; category: string; price: string;
  stock: number; brand: string; imageUrl: string; rating: string; reviewCount: number;
  prescriptionRequired: number;
};
type CartItem = Product & { quantity: number };
type Order = {
  id: string; orderNo: string; fulfillmentType: string; pickupBranch?: string | null; deliveryAddress?: string | null;
  deliveryFee: string; subtotal: string; total: string; status: string;
  trackingNo?: string | null; estimatedDelivery?: string | null; receivedAt?: string | null; createdAt: string;
  items: Array<{ productName: string; brand: string; unitPrice: string; quantity: number; lineTotal: string }>;
};
type StoreNotification = { id: string; title: string; message: string; kind: string; createdAt: string };

const money = (value: number | string) => `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusStyles: Record<string, string> = {
  Pending: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  Preparing: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  "Ready for Pickup": "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "Out for Delivery": "bg-violet-500/10 text-violet-700 border-violet-500/20",
  Delivered: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  Completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status] ?? "bg-muted text-muted-foreground border-border"}`}><CheckCircle2 className="h-3.5 w-3.5" />{status}</span>;
}

const DEFAULT_IMG = "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80";

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  const out = product.stock === 0;
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-accent/50">
        <img
          src={product.imageUrl || DEFAULT_IMG}
          alt={product.name}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_IMG;
          }}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.prescriptionRequired === 1 && <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-primary shadow-sm">DEMO RX</span>}
          {product.stock < 10 && !out && <span className="rounded-full bg-amber-50/95 px-2 py-1 text-[10px] font-bold text-amber-700 shadow-sm">LOW STOCK</span>}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{product.brand}</p>
          <h3 className="mt-1 min-h-11 font-semibold leading-5 text-foreground">{product.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{product.description}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-600"><Star className="h-3.5 w-3.5 fill-current" /> {product.rating} <span className="text-muted-foreground">({product.reviewCount})</span></div>
        <div className="flex items-center justify-between gap-2">
          <div><p className="text-lg font-bold text-foreground">{money(product.price)}</p><p className="text-[11px] text-muted-foreground">{out ? "Out of stock" : `${product.stock} available`}</p></div>
          <button disabled={out} onClick={() => onAdd(product)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />Add</button>
        </div>
      </div>
    </article>
  );
}

export default function Store() {
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; address: string; hours: string }>>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<StoreNotification[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("sugbodoc_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All products");
  const [activeTab, setActiveTab] = useState<"shop" | "orders">("shop");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Order | null>(null);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [pickupBranch, setPickupBranch] = useState("");
  const [address, setAddress] = useState("");
  const [customerName, setCustomerName] = useState("SugboDoc Patient");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+63 917 123 4567");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState<string | null>(null);

  // Stripe Payment Modal UI State
  const [paymentMode, setPaymentMode] = useState<"card" | "hosted">("card");
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("123");
  const [cardName, setCardName] = useState("SugboDoc Test Patient");
  const [hostedSessionId, setHostedSessionId] = useState<string | null>(null);
  const [checkingHosted, setCheckingHosted] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("sugbodoc_cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("checkout_session_id");
    const statusParam = params.get("status");

    if (sessionId) {
      apiClient.getCheckoutSession(sessionId).then(async (res) => {
        if (res.data?.paymentStatus === "paid" && res.data?.paymentIntentId) {
          // Apply fulfillment locally so orders/bills/stock update in the app DB.
          let fulfilled = false;
          try {
            await applyPaymentFulfillment({
              paymentIntentId: String(res.data.paymentIntentId),
              amountTotal: Number(res.data.amountTotal ?? 0),
              patientId: res.data.metadata?.patient_id || undefined,
              billId: res.data.metadata?.bill_id || undefined,
              invoiceNo: res.data.metadata?.invoice_no || undefined,
              orderId: res.data.metadata?.order_id || undefined,
              orderNo: res.data.metadata?.order_no || undefined,
              policyId: res.data.metadata?.policy_id || undefined,
              description: res.data.metadata?.description || undefined,
            });
            fulfilled = true;
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to record the payment locally.");
          }

          setCart([]);
          try { localStorage.removeItem("sugbodoc_cart"); } catch {}

          if (fulfilled && res.data.paymentStatus === "paid") {
            toast.success("Stripe Payment Confirmed!", {
              description: `Transaction Ref: ${res.data.paymentIntentId}`,
            });
          }

          // Refresh products, orders, and notifications after payment
          Promise.all([
            apiClient.getStoreProducts(),
            apiClient.getStoreOrders(),
            apiClient.getStoreNotifications(),
          ]).then(([productRes, orderRes, notificationRes]) => {
            if (productRes.data) {
              setProducts(productRes.data.products as Product[]);
            }
            if (orderRes.data?.orders) {
              const fetchedOrders = orderRes.data.orders as Order[];
              setOrders(fetchedOrders);
              const matchedOrder =
                fetchedOrders.find(
                  (o) =>
                    o.id === res.data?.metadata?.order_id ||
                    o.orderNo === res.data?.metadata?.order_no
                ) || fetchedOrders[0];
              if (matchedOrder) {
                setConfirmation(matchedOrder);
                setActiveTab("orders");
              }
            }
            if (notificationRes.data) {
              setNotifications(notificationRes.data.notifications as StoreNotification[]);
            }
          });
        } else if (statusParam === "cancelled") {
          toast.info("Stripe checkout was cancelled.", {
            description: "No payment was charged. Your order remains pending — you can retry payment anytime.",
          });
          void apiClient.getStoreOrders().then((orderRes) => {
            if (orderRes.data?.orders) setOrders(orderRes.data.orders as Order[]);
          });
        } else if (res.error) {
          toast.error(res.error);
        } else {
          toast.warning(
            `Stripe payment not completed (status: ${String(res.data?.paymentStatus ?? "unknown")}). Your order remains pending.`,
          );
        }
      }).finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
    }
  }, []);

  const refreshAllData = async () => {
    try {
      const [productRes, orderRes, notificationRes, profileRes] = await Promise.allSettled([
        apiClient.getStoreProducts(),
        apiClient.getStoreOrders(),
        apiClient.getStoreNotifications(),
        apiClient.getPatientProfile(),
      ]);

      if (productRes.status === "fulfilled" && productRes.value?.data) {
        const pData = productRes.value.data;
        setProducts((pData.products || []) as Product[]);
        setCategories((pData.categories || []) as string[]);
        setBranches(pData.branches ?? []);
        if (!pickupBranch && pData.branches?.[0]) setPickupBranch(pData.branches[0].id);
      }

      if (orderRes.status === "fulfilled" && orderRes.value?.data?.orders) {
        setOrders(orderRes.value.data.orders as Order[]);
      }

      if (notificationRes.status === "fulfilled" && notificationRes.value?.data?.notifications) {
        setNotifications(notificationRes.value.data.notifications as StoreNotification[]);
      }

      if (profileRes.status === "fulfilled" && profileRes.value?.data) {
        const prof = (profileRes.value.data.user || profileRes.value.data) as any;
        if (prof) {
          if (prof.name) {
            setCustomerName(prof.name);
            setCardName(prof.name);
          }
          if (prof.email) setCustomerEmail(prof.email);
          if (prof.phone) setCustomerPhone(prof.phone);
          if (prof.address && !address) setAddress(prof.address);
        }
      }
    } catch (err) {
      console.warn("Medical store refresh notice:", err);
    }
  };

  useEffect(() => {
    refreshAllData().finally(() => setLoading(false));
    const interval = window.setInterval(refreshAllData, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredProducts = useMemo(() => products.filter(product =>
    (category === "All products" || product.category === category) &&
    `${product.name} ${product.brand} ${product.description}`.toLowerCase().includes(search.toLowerCase()),
  ), [products, search, category]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const deliveryFee = fulfillment === "delivery" ? (subtotal >= 1500 ? 0 : 120) : 0;
  const total = subtotal + deliveryFee;

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} is out of stock.`);
      return;
    }
    setCart(prev => {
      const current = prev.find(item => item.id === product.id);
      if (current) {
        if (current.quantity >= product.stock) {
          toast.error(`Only ${product.stock} items available in stock.`);
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    toast.success(`${product.name} added to cart`, { duration: 1800 });
  };
  const setQuantity = (id: string, quantity: number) => setCart(prev => prev.map(item => item.id === id ? { ...item, quantity } : item).filter(item => item.quantity > 0));

  const placeOrder = async () => {
    if (!cart.length) return;
    if (fulfillment === "delivery" && address.trim().length < 10) { toast.error("Enter a complete delivery address."); return; }
    if (fulfillment === "pickup" && !pickupBranch) { toast.error("Choose a pickup branch."); return; }
    setPlacing(true);

    try {
      // 1. Create order in pending state
      const result = await apiClient.createStoreOrder({
        items: cart.map(item => ({ productId: item.id, quantity: item.quantity })),
        fulfillmentType: fulfillment,
        deliveryAddress: fulfillment === "delivery" ? address : undefined,
        pickupBranch: fulfillment === "pickup" ? pickupBranch : undefined,
      });

      if (result.error || !result.data) {
        setPlacing(false);
        toast.error(result.error ?? "Could not place your order.");
        return;
      }

      const order = result.data.order as Order;
      const bill = result.data.bill;

      if (paymentMode === "card") {
        // Direct Stripe Card Processing (Instant & Highly Reliable)
        const paymentResult = await apiClient.processDirectStripePayment({
          amount: total,
          orderId: order.id,
          orderNo: order.orderNo,
          billId: bill?.id,
          invoiceNo: bill?.invoice_no,
          description: `Medical Store Order #${order.orderNo}`,
        });

        if (paymentResult.error || !paymentResult.data?.success) {
          toast.error(paymentResult.error ?? "Stripe payment could not be processed.");
          setPlacing(false);
          return;
        }

        // Record the confirmed payment in the app DB (bill → Paid, order →
        // Preparing, inventory deducted, payment row with the Stripe ref).
        try {
          await applyPaymentFulfillment({
            paymentIntentId: String(paymentResult.data.paymentIntentId),
            amountTotal: Number(paymentResult.data.amountTotal ?? total),
            orderId: order.id,
            orderNo: order.orderNo,
            billId: bill?.id,
            invoiceNo: bill?.invoice_no,
            patientId: undefined,
            description: `Medical Store Order #${order.orderNo}`,
            paymentMethod: "Stripe Card",
          });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Payment succeeded but recording failed. Contact billing with ref: " + paymentResult.data.paymentIntentId);
          setPlacing(false);
          return;
        }

        const confirmedOrder: Order = {
          ...order,
          status: "Preparing",
        };

        // Clear cart & state
        setCart([]);
        try { localStorage.removeItem("sugbodoc_cart"); } catch {}
        setCheckoutOpen(false);
        setCartOpen(false);
        setConfirmation(confirmedOrder);
        setActiveTab("orders");

        toast.success("Stripe Payment Succeeded!", {
          description: `Order #${order.orderNo} confirmed. Reference: ${paymentResult.data.paymentIntentId}`,
        });

        // Trigger background refresh
        await refreshAllData();
      } else {
        // Hosted Stripe Checkout session
        const sessionResult = await apiClient.createCheckoutSession(
          total,
          `Medical Store Order #${order.orderNo}`,
          {
            invoiceId: bill?.id,
            invoiceNo: bill?.invoice_no,
            orderId: order.id,
            orderNo: order.orderNo,
            items: cart.map((item) => ({
              productId: item.id,
              name: item.name,
              brand: item.brand,
              unitPrice: Number(item.price),
              quantity: item.quantity,
              lineTotal: Number(item.price) * item.quantity,
            })),
            fulfillmentType: fulfillment,
            pickupBranch: fulfillment === "pickup" ? pickupBranch : undefined,
            deliveryAddress: fulfillment === "delivery" ? address : undefined,
            deliveryFee,
            subtotal,
            successUrl: `${window.location.origin}${window.location.pathname}?checkout_session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}${window.location.pathname}?status=cancelled`,
          }
        );

        if (sessionResult.data?.url) {
          setHostedSessionId(sessionResult.data.sessionId);
          // Try opening in new window / tab
          const newWindow = window.open(sessionResult.data.url, "_blank");
          if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
            // Fallback redirect if popup blocked
            window.location.href = sessionResult.data.url;
            return;
          }
          toast.info("Stripe Checkout opened in a new tab. Complete your payment and check status.", { duration: 6000 });
        } else {
          toast.error(sessionResult.error ?? "Could not initiate Stripe Checkout.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error initiating checkout.");
    } finally {
      setPlacing(false);
    }
  };

  const verifyHostedSession = async () => {
    if (!hostedSessionId) return;
    setCheckingHosted(true);
    try {
      const res = await apiClient.getCheckoutSession(hostedSessionId);
      if (res.data?.status === "complete" || res.data?.paymentStatus === "paid") {
        setCart([]);
        try { localStorage.removeItem("sugbodoc_cart"); } catch {}
        setCheckoutOpen(false);
        setCartOpen(false);
        setHostedSessionId(null);
        toast.success("Stripe Payment Confirmed!", {
          description: `Transaction Ref: ${res.data.paymentIntentId || hostedSessionId}`,
        });
        await refreshAllData();
        setActiveTab("orders");
      } else {
        toast.info("Payment not detected yet. If you completed payment in Stripe, please wait 3 seconds and retry.", {
          duration: 3500,
        });
      }
    } catch (e) {
      toast.error("Could not verify Stripe session.");
    } finally {
      setCheckingHosted(false);
    }
  };

  const confirmReceipt = async (order: Order) => {
    setConfirmingReceipt(order.id);
    const result = await apiClient.confirmStoreOrderReceived(order.id);
    setConfirmingReceipt(null);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Could not confirm receipt.");
      return;
    }
    setOrders(prev => prev.map(item => item.id === order.id ? { ...item, ...(result.data!.order as Order) } : item));
    toast.success("Order receipt confirmed");
  };

  if (loading) return <div className="space-y-6 animate-pulse"><div className="h-32 rounded-2xl bg-muted" /><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-64 rounded-2xl bg-muted" />)}</div></div>;

  return (
    <div className="space-y-7 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.12] via-card to-accent/60 p-6 md:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-3 py-1.5 text-xs font-semibold text-primary"><ShoppingBag className="h-3.5 w-3.5" />SugboDoc Medical Store</div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Everyday care, delivered with confidence.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Order trusted health essentials for pickup at the hospital pharmacy or delivery to your door. Seamlessly pay with Stripe in test mode.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-primary" />Verified products</span><span className="inline-flex items-center gap-1.5"><Banknote className="h-4 w-4 text-primary" />Stripe Test Mode</span><span className="inline-flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" />Live order tracking</span></div>
        </div>
        <ShoppingBag className="absolute -bottom-8 -right-4 h-44 w-44 rotate-12 text-primary/10" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
         <div className="flex flex-wrap gap-2"><div className="flex rounded-xl bg-muted p-1"><button onClick={() => setActiveTab("shop")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "shop" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Browse products</button><button onClick={() => setActiveTab("orders")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "orders" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Order history <span className="ml-1 text-xs">({orders.length})</span></button></div><button onClick={() => setLocation("/insurance")} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/15"><Shield className="h-4 w-4" />Insurance Plans</button></div>
        {activeTab === "shop" && <button onClick={() => setCartOpen(true)} className="relative inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm hover:bg-accent"><ShoppingCart className="h-4 w-4" />Cart{cartCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{cartCount}</span>}</button>}
      </div>

      {notifications.length > 0 && <section className="rounded-2xl border border-primary/15 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Recent updates</p><h2 className="mt-1 font-semibold">Your store notifications</h2></div><span className="rounded-full bg-accent px-2 py-1 text-xs font-semibold text-primary">{notifications.length}</span></div>
        <div className="grid gap-2 md:grid-cols-2">
          {notifications.slice(0, 4).map(notification => <div key={notification.id} className="flex gap-3 rounded-xl bg-muted/50 p-3"><div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary"><Clock3 className="h-4 w-4" /></div><div className="min-w-0"><p className="text-sm font-semibold">{notification.title}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{notification.message}</p></div></div>)}
        </div>
      </section>}

      {activeTab === "shop" ? <section className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search medicines, supplies, vitamins..." className="min-h-11 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm outline-none ring-primary transition focus:ring-2" /></label>
          <div className="relative"><select value={category} onChange={event => setCategory(event.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-input bg-card py-2 pl-4 pr-10 text-sm font-medium outline-none focus:ring-2 focus:ring-primary md:min-w-64"><option>All products</option>{categories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /></div>
        </div>
        {filteredProducts.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredProducts.map(product => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><Search className="mx-auto h-9 w-9 text-muted-foreground/50" /><h2 className="mt-3 font-semibold">No products found</h2><p className="mt-1 text-sm text-muted-foreground">Try another search or category.</p></div>}
      </section> : <section className="space-y-4">
          {orders.length ? orders.map(order => <article key={order.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><StatusPill status={order.status} /><span className="font-mono text-xs text-muted-foreground">{order.orderNo}</span></div><p className="mt-2 text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-PH", { dateStyle: "long" })} · {order.fulfillmentType === "pickup" ? `Pickup · ${branches.find(branch => branch.id === order.pickupBranch)?.name ?? order.pickupBranch ?? "Hospital pharmacy"}` : "Home delivery"}</p><div className="mt-3 space-y-1 text-sm">{order.items.map(item => <p key={`${order.id}-${item.productName}`}><span className="font-medium">{item.quantity} × {item.productName}</span> <span className="text-muted-foreground">· {money(item.lineTotal)}</span></p>)}</div></div><div className="text-left sm:text-right"><p className="text-xl font-bold">{money(order.total)}</p><p className="mt-1 text-xs text-muted-foreground">{order.fulfillmentType === "pickup" ? order.estimatedDelivery : `Estimated ${order.estimatedDelivery}`}</p>{order.trackingNo && <p className="mt-3 rounded-lg bg-accent px-2.5 py-2 text-xs font-medium text-primary">Tracking: {order.trackingNo}</p>}{order.status === "Delivered" && <button disabled={confirmingReceipt === order.id} onClick={() => confirmReceipt(order)} className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60">{confirmingReceipt === order.id ? "Saving..." : "Confirm order received"}</button>}{order.status === "Received" && order.receivedAt && <p className="mt-3 text-xs font-medium text-emerald-700">Received {new Date(order.receivedAt).toLocaleString("en-PH")}</p>}</div></div></article>) : <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><Package className="mx-auto h-10 w-10 text-primary/50" /><h2 className="mt-3 font-semibold">No medical store orders yet</h2><p className="mt-1 text-sm text-muted-foreground">Your completed orders and tracking details will appear here.</p><button onClick={() => setActiveTab("shop")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Browse the store <ArrowRight className="h-4 w-4" /></button></div>}
      </section>}

      {cartOpen && <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setCartOpen(false)}><aside onClick={event => event.stopPropagation()} className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border p-5"><div><h2 className="text-lg font-bold">Your cart</h2><p className="text-xs text-muted-foreground">{cartCount} item{cartCount === 1 ? "" : "s"}</p></div><button onClick={() => setCartOpen(false)} className="rounded-lg p-2 hover:bg-muted" aria-label="Close cart"><X className="h-5 w-5" /></button></div>{cart.length ? <><div className="flex-1 space-y-3 overflow-y-auto p-5">{cart.map(item => <div key={item.id} className="flex gap-3 rounded-xl border border-border p-3"><img src={item.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{money(item.price)} each</p><div className="mt-2 flex items-center gap-2"><button onClick={() => setQuantity(item.id, item.quantity - 1)} className="rounded-md border p-1" aria-label="Decrease quantity"><Minus className="h-3 w-3" /></button><span className="w-5 text-center text-xs font-bold">{item.quantity}</span><button onClick={() => setQuantity(item.id, Math.min(item.quantity + 1, item.stock))} className="rounded-md border p-1" aria-label="Increase quantity"><Plus className="h-3 w-3" /></button></div></div><button onClick={() => setQuantity(item.id, 0)} className="self-start p-1 text-muted-foreground hover:text-destructive" aria-label={`Remove ${item.name}`}><X className="h-4 w-4" /></button></div>)}</div><div className="space-y-3 border-t border-border p-5"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Estimated delivery</span><span>{fulfillment === "delivery" ? (deliveryFee ? money(deliveryFee) : "Free") : "Pickup"}</span></div><div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span className="text-primary">{money(total)}</span></div><button onClick={() => setCheckoutOpen(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Continue to checkout <ArrowRight className="h-4 w-4" /></button></div></> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><ShoppingCart className="h-12 w-12 text-muted-foreground/30" /><p className="mt-3 font-semibold">Your cart is empty</p><p className="mt-1 text-sm text-muted-foreground">Add health essentials to get started.</p></div>}</aside></div>}

      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setCheckoutOpen(false)}>
          <div onClick={event => event.stopPropagation()} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Final step</p>
                <h2 className="mt-1 text-xl font-bold">Medical Store Checkout</h2>
              </div>
              <button onClick={() => setCheckoutOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            {/* Fulfillment Selector */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button onClick={() => setFulfillment("pickup")} className={`rounded-xl border p-4 text-left ${fulfillment === "pickup" ? "border-primary bg-accent ring-1 ring-primary" : "border-border"}`}>
                <StoreIcon className="h-5 w-5 text-primary" />
                <p className="mt-2 text-sm font-semibold">Pharmacy pickup</p>
                <p className="mt-1 text-xs text-muted-foreground">Ready within 2 hours. No delivery fee.</p>
              </button>
              <button onClick={() => setFulfillment("delivery")} className={`rounded-xl border p-4 text-left ${fulfillment === "delivery" ? "border-primary bg-accent ring-1 ring-primary" : "border-border"}`}>
                <Truck className="h-5 w-5 text-primary" />
                <p className="mt-2 text-sm font-semibold">Home delivery</p>
                <p className="mt-1 text-xs text-muted-foreground">Estimated delivery in 2–3 business days.</p>
              </button>
            </div>

            {fulfillment === "pickup" && (
              <label className="mt-4 block text-sm font-medium">
                Pickup branch
                <select value={pickupBranch} onChange={event => setPickupBranch(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary">
                  {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name} · {branch.address}</option>)}
                </select>
                {branches.find(branch => branch.id === pickupBranch) && <span className="mt-1 block text-xs font-normal text-muted-foreground">{branches.find(branch => branch.id === pickupBranch)?.hours}</span>}
              </label>
            )}

            {fulfillment === "delivery" && (
              <label className="mt-4 block text-sm font-medium">
                Delivery address
                <textarea value={address} onChange={event => setAddress(event.target.value)} rows={2} placeholder="House/building, street, barangay, city" className="mt-1.5 w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
              </label>
            )}

            {/* Customer Information Card */}
            <div className="mt-4 rounded-xl border border-border bg-card p-3.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-[11px] uppercase tracking-wider">Customer Information</span>
                <span className="text-[10px] text-muted-foreground">Linked to patient profile</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1 border-t border-border/60">
                <div>
                  <span className="block text-[10px] text-muted-foreground/80">Recipient Name</span>
                  <span className="font-medium text-foreground truncate block">{customerName || "Patient Account"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground/80">Email</span>
                  <span className="font-medium text-foreground truncate block">{customerEmail || "patient@sugbodoc.ph"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground/80">Contact Phone</span>
                  <span className="font-medium text-foreground">{customerPhone || "+63 917 123 4567"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground/80">Fulfillment Mode</span>
                  <span className="font-medium text-foreground">{fulfillment === "pickup" ? "Pharmacy Pickup" : "Home Delivery"}</span>
                </div>
              </div>
            </div>

            {/* Order Items Summary */}
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3.5 text-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground text-xs uppercase tracking-wider">Order Items ({cartCount})</span>
                <span className="text-xs text-muted-foreground">Subtotal: {money(subtotal)}</span>
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 text-xs text-muted-foreground">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span className="truncate">{item.quantity}x {item.name}</span>
                    <span className="font-medium text-foreground">{money(Number(item.price) * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-border/60">
                <span className="text-muted-foreground">Delivery</span>
                <span>{deliveryFee ? money(deliveryFee) : "Free"}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total Due</span>
                <span className="text-primary">{money(total)}</span>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Stripe Payment Method</label>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> Stripe Test Mode Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode("card")}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                    paymentMode === "card"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <CreditCard className={`h-4 w-4 ${paymentMode === "card" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-xs font-bold leading-none">Stripe Card</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Instant in-app payment</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode("hosted")}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                    paymentMode === "hosted"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <ExternalLink className={`h-4 w-4 ${paymentMode === "hosted" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-xs font-bold leading-none">Hosted Checkout</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Stripe checkout page</p>
                  </div>
                </button>
              </div>

              {paymentMode === "card" ? (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Card details
                    </span>
                    <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      Visa Test 4242
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Card number</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={e => setCardNumber(e.target.value)}
                        placeholder="4242 4242 4242 4242"
                        className="w-full min-h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                      />
                      <CreditCard className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Expires (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={e => setCardExpiry(e.target.value)}
                        placeholder="12/28"
                        className="w-full min-h-10 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">CVC / CVV</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={e => setCardCvc(e.target.value)}
                        placeholder="123"
                        className="w-full min-h-10 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Name on card</label>
                    <input
                      type="text"
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                      placeholder="Patient Name"
                      className="w-full min-h-10 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center space-y-2">
                  <ExternalLink className="mx-auto h-6 w-6 text-primary" />
                  <p className="text-xs font-semibold text-foreground">Stripe-Hosted Checkout</p>
                  <p className="text-[11px] text-muted-foreground">
                    When you click pay below, Stripe Checkout will launch securely. Return here after completing payment.
                  </p>
                  {hostedSessionId && (
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={checkingHosted}
                        onClick={verifyHostedSession}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${checkingHosted ? "animate-spin" : ""}`} />
                        Verify Payment Status
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-5 space-y-2">
              <button
                disabled={placing}
                onClick={placeOrder}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60 shadow-md hover:bg-primary/90 transition"
              >
                {placing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Processing with Stripe...
                  </>
                ) : (
                  <>
                    Pay {money(total)} with Stripe <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-muted-foreground">
                Payment is processed securely using Stripe API. Inventory will be updated upon confirmation.
              </p>
            </div>
          </div>
        </div>
      )}

      {confirmation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold">Stripe Payment Confirmed!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your order has been paid and is now being prepared. A receipt was added to your Pay Bills records.
            </p>
            <div className="mt-5 rounded-xl bg-accent p-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order number</span>
                <span className="font-mono font-semibold">{confirmation.orderNo}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pickup / delivery</span>
                <span className="font-medium">{confirmation.fulfillmentType === "pickup" ? `Pickup · ${branches.find(branch => branch.id === confirmation.pickupBranch)?.name ?? confirmation.pickupBranch ?? "Hospital pharmacy"}` : "Home delivery"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order Status</span>
                <StatusPill status={confirmation.status} />
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-border">
                <span className="text-muted-foreground">Payment Status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Paid via Stripe
                </span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmation(null)} className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted">
                Continue shopping
              </button>
              <button onClick={() => { setConfirmation(null); setLocation("/billing"); }} className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                View Pay Bills
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}