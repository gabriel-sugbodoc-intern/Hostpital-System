/**
 * SQL-backed implementation of the Medical Store, Insurance, and Payments
 * API surface consumed by the patient portal. Mirrors the field shapes used by
 * the previous `apiClient` so UI components keep working unchanged.
 */

import { sqlDb } from "@/lib/db/sql-db";
import {
  getStripeConfigServerFn,
  createStripeCheckoutSessionServerFn,
  createBillPaymentIntentServerFn,
  verifyStripeSessionServerFn,
  processDirectStripePaymentServerFn,
} from "@/lib/stripe-api";
import { sendEmailSafe } from "@/lib/brevo-api";

function ok<T>(data: T): { data: T; error?: undefined } {
  return { data };
}
function fail(error: string): { data?: undefined; error: string } {
  return { error };
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

async function getUserId(): Promise<string | null> {
  try {
    const { data } = await sqlDb.auth.getUser();
    if (data.user?.id) return data.user.id;
  } catch {}
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("sugbodoc_user") : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.id) return parsed.id;
    }
  } catch {}
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

type StoreOrderItemRow = {
  productName: string;
  brand: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
};

type StoreOrder = {
  id: string;
  userId?: string;
  orderNo: string;
  fulfillmentType: string;
  pickupBranch: string | null;
  deliveryAddress: string | null;
  deliveryFee: string;
  subtotal: string;
  total: string;
  status: string;
  trackingNo: string | null;
  estimatedDelivery: string | null;
  receivedAt: string | null;
  createdAt: string;
  items: StoreOrderItemRow[];
};

function mapProduct(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    price: Number(row.price ?? 0).toFixed(2),
    stock: row.stock,
    brand: row.brand ?? "",
    imageUrl: row.image_url ?? "",
    rating: Number(row.rating ?? 0).toFixed(1),
    reviewCount: row.review_count ?? 0,
    prescriptionRequired: row.prescription_required ? 1 : 0,
  };
}

function mapBranch(row: any) {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? "",
    hours: row.hours ?? "",
  };
}

function mapOrder(row: any): StoreOrder {
  const items: StoreOrderItemRow[] = (row.order_items ?? []).map((item: any) => ({
    productName: item.product_name,
    brand: item.brand ?? "",
    unitPrice: Number(item.unit_price ?? 0).toFixed(2),
    quantity: item.quantity,
    lineTotal: Number(item.line_total ?? 0).toFixed(2),
  }));
  return {
    id: row.id,
    userId: row.user_id,
    orderNo: row.order_no,
    fulfillmentType: row.fulfillment_type,
    pickupBranch: row.pickup_branch,
    deliveryAddress: row.delivery_address,
    deliveryFee: Number(row.delivery_fee ?? 0).toFixed(2),
    subtotal: Number(row.subtotal ?? 0).toFixed(2),
    total: Number(row.total ?? 0).toFixed(2),
    status: row.status,
    trackingNo: row.tracking_no,
    estimatedDelivery: row.estimated_delivery,
    receivedAt: row.received_at,
    createdAt: row.created_at,
    items,
  };
}

const DEFAULT_STORE_BRANCHES = [
  {
    id: "branch-chong-hua",
    name: "Chong Hua Hospital Pharmacy",
    address: "Fuente Osmeña Circle, Cebu City",
    hours: "Open 24/7 Daily",
  },
  {
    id: "branch-cebu-doc",
    name: "Cebu Doctors' University Hospital Pharmacy",
    address: "Osmeña Blvd, Capitol Site, Cebu City",
    hours: "Open 24/7 Daily",
  },
  {
    id: "branch-perpetual",
    name: "Perpetual Succour Hospital Pharmacy",
    address: "Gorordo Avenue, Lahug, Cebu City",
    hours: "6:00 AM – 10:00 PM Daily",
  },
  {
    id: "branch-sugbodoc-central",
    name: "SugboDoc Regional Central Pharmacy",
    address: "South Road Properties (SRP), Cebu City",
    hours: "7:00 AM – 11:00 PM Daily",
  },
];

const DEFAULT_STORE_PRODUCTS = [
  {
    id: "prod-biogesic-500",
    name: "Biogesic Paracetamol 500mg (20 Tablets)",
    description:
      "Gentle and effective relief for headaches, body pain, fever, and minor muscle aches. Safe for empty stomachs.",
    category: "Over-the-Counter",
    price: 150.0,
    stock: 85,
    brand: "Unilab",
    image_url:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    review_count: 142,
    prescription_required: false,
  },
  {
    id: "prod-neozep-forte",
    name: "Neozep Forte Caplets (10 Caplets)",
    description:
      "Fast-acting formula with phenylephrine, chlorphenamine, and paracetamol for colds, runny nose, and sneezing.",
    category: "Over-the-Counter",
    price: 125.0,
    stock: 64,
    brand: "Unilab",
    image_url:
      "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80",
    rating: 4.8,
    review_count: 98,
    prescription_required: false,
  },
  {
    id: "prod-cetirizine-10",
    name: "Cetirizine 10mg Anti-Allergy (10 Tablets)",
    description:
      "Long-lasting 24-hour non-drowsy relief from allergic rhinitis, itchy eyes, skin rashes, and urticaria.",
    category: "Over-the-Counter",
    price: 95.0,
    stock: 50,
    brand: "RiteMed",
    image_url:
      "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80",
    rating: 4.7,
    review_count: 64,
    prescription_required: false,
  },
  {
    id: "prod-amoxicillin-500",
    name: "Amoxicillin 500mg (21 Capsules - Demo RX)",
    description:
      "Broad-spectrum oral antibiotic for bacterial infections. Requires registered physician prescription verification.",
    category: "Prescription (Demo)",
    price: 280.0,
    stock: 40,
    brand: "RiteMed",
    image_url:
      "https://images.unsplash.com/photo-1576073719676-aa95576db207?w=600&auto=format&fit=crop&q=80",
    rating: 4.8,
    review_count: 52,
    prescription_required: true,
  },
  {
    id: "prod-amlodipine-5",
    name: "Amlodipine 5mg Blood Pressure (30 Tablets - Demo RX)",
    description:
      "Daily cardiovascular calcium channel blocker for maintenance of blood pressure and angina management.",
    category: "Prescription (Demo)",
    price: 195.0,
    stock: 45,
    brand: "Pharex",
    image_url:
      "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    review_count: 78,
    prescription_required: true,
  },
  {
    id: "prod-fernc-zinc",
    name: "Fern-C Vitamin C 500mg + Zinc (100 Capsules)",
    description:
      "Sodium ascorbate non-acidic immune defense booster that strengthens resistance against colds, fatigue, and daily stress.",
    category: "Vitamins & Supplements",
    price: 480.0,
    stock: 90,
    brand: "Fern-C",
    image_url:
      "https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    review_count: 215,
    prescription_required: false,
  },
  {
    id: "prod-vitamind3-1000",
    name: "Vitamin D3 1000 IU High Potency (60 Softgels)",
    description:
      "Essential vitamin for strong bone density, calcium absorption, muscle function, and robust cellular immunity.",
    category: "Vitamins & Supplements",
    price: 540.0,
    stock: 35,
    brand: "Nature's Way",
    image_url:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600&auto=format&fit=crop&q=80",
    rating: 4.8,
    review_count: 94,
    prescription_required: false,
  },
  {
    id: "prod-omron-bp",
    name: "Omron Automatic Upper Arm Blood Pressure Monitor",
    description:
      "Hospital-grade accuracy automatic BP meter with IntelliSense technology, memory storage, and cuff fit indicator.",
    category: "Medical Devices",
    price: 2450.0,
    stock: 22,
    brand: "Omron Healthcare",
    image_url:
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    review_count: 167,
    prescription_required: false,
  },
  {
    id: "prod-pulse-oximeter",
    name: "Fingertip Pulse Oximeter with OLED Display",
    description:
      "Instantaneous SpO2 blood oxygen saturation and pulse rate monitor with multi-directional display and lanyard.",
    category: "Medical Devices",
    price: 750.0,
    stock: 30,
    brand: "MedTech Pro",
    image_url:
      "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&auto=format&fit=crop&q=80",
    rating: 4.7,
    review_count: 83,
    prescription_required: false,
  },
  {
    id: "prod-first-aid-kit",
    name: "Comprehensive Emergency First Aid Kit (75-Piece)",
    description:
      "Compact water-resistant travel bag equipped with bandages, sterile gauze, burn gel, antiseptics, and shears.",
    category: "First Aid",
    price: 680.0,
    stock: 38,
    brand: "St. John Medical",
    image_url:
      "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    review_count: 110,
    prescription_required: false,
  },
  {
    id: "prod-betadine-120",
    name: "Betadine Antiseptic Povidone-Iodine 10% (120ml)",
    description:
      "Antiseptic solution for prompt infection prevention in cuts, scrapes, burns, and wound preparation.",
    category: "First Aid",
    price: 195.0,
    stock: 55,
    brand: "Mundipharma",
    image_url:
      "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    review_count: 130,
    prescription_required: false,
  },
  {
    id: "prod-n95-masks",
    name: "Medical Grade N95 Respirator Masks (Box of 20)",
    description:
      "NIOSH-compliant filtration respirators with nose clip cushioning for high-efficiency airborne particle barrier.",
    category: "Medical Supplies",
    price: 420.0,
    stock: 95,
    brand: "3M Healthcare",
    image_url:
      "https://images.unsplash.com/photo-1586942593568-29361efcd571?w=600&auto=format&fit=crop&q=80",
    rating: 4.8,
    review_count: 188,
    prescription_required: false,
  },
  {
    id: "prod-alcohol-70",
    name: "Rubbing Alcohol 70% Ethyl with Moisturizer (500ml)",
    description:
      "Antiseptic and disinfectant solution killing 99.9% of bacteria and germs with aloe vera skin conditioning.",
    category: "Personal Care",
    price: 85.0,
    stock: 120,
    brand: "Green Cross",
    image_url:
      "https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    review_count: 310,
    prescription_required: false,
  },
  {
    id: "prod-glucometer-strips",
    name: "Accu-Chek Blood Glucose Test Strips (50 Strips)",
    description:
      "Fast-fill test strips for accurate self-monitoring blood glucose readings with 5-second test time.",
    category: "Medical Supplies",
    price: 1350.0,
    stock: 28,
    brand: "Roche Diagnostics",
    image_url:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
    rating: 4.8,
    review_count: 75,
    prescription_required: false,
  },
];

async function getStoreProducts() {
  try {
    const [productsRes, branchesRes] = await Promise.all([
      sqlDb.from("products").select("*").order("name", { ascending: true }),
      sqlDb.from("store_branches").select("*").order("name", { ascending: true }),
    ]);

    let rawProducts = productsRes.data ?? [];
    let rawBranches = branchesRes.data ?? [];

    // Auto-seed branches if empty or table newly initialized
    if (!rawBranches || rawBranches.length === 0) {
      try {
        await sqlDb.from("store_branches").upsert(DEFAULT_STORE_BRANCHES);
      } catch (seedErr) {
        console.warn("Branch seeding notice:", seedErr);
      }
      rawBranches = DEFAULT_STORE_BRANCHES;
    }

    // Auto-seed products if empty
    if (!rawProducts || rawProducts.length === 0) {
      try {
        await sqlDb.from("products").upsert(DEFAULT_STORE_PRODUCTS);
      } catch (seedErr) {
        console.warn("Product seeding notice:", seedErr);
      }
      rawProducts = DEFAULT_STORE_PRODUCTS;
    }

    const products = rawProducts.map(mapProduct);
    const categories = Array.from(new Set(products.map((p) => p.category))).sort();
    const branches = rawBranches.map(mapBranch);
    return ok({ products, categories, branches });
  } catch (e) {
    // Graceful fallback to default verified catalog if network or RLS happens
    const products = DEFAULT_STORE_PRODUCTS.map(mapProduct);
    const categories = Array.from(new Set(products.map((p) => p.category))).sort();
    const branches = DEFAULT_STORE_BRANCHES.map(mapBranch);
    return ok({ products, categories, branches });
  }
}

async function getStoreOrders() {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in to view orders.");
    const { data, error } = await sqlDb
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok({ orders: (data ?? []).map(mapOrder) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load orders.");
  }
}

async function confirmStoreOrderReceived(id: string) {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in.");
    const { data, error } = await sqlDb
      .from("orders")
      .update({ status: "Completed", received_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*, order_items(*)")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Order not found");
    return ok({ order: mapOrder(data) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not confirm receipt.");
  }
}

async function createStoreOrder(order: {
  items: Array<{ productId: string; quantity: number }>;
  fulfillmentType: "pickup" | "delivery";
  deliveryAddress?: string;
  pickupBranch?: string;
}) {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in to place an order.");
    if (!order.items.length) return fail("Your cart is empty.");

    const productIds = order.items.map((i) => i.productId);
    const { data: products, error: productsError } = await sqlDb
      .from("products")
      .select("*")
      .in("id", productIds);
    if (productsError) return fail(productsError.message);

    const productMap = new Map<string, (typeof products)[number]>(
      (products ?? []).map((p) => [p.id, p]),
    );

    for (const item of order.items) {
      const product = productMap.get(item.productId);
      if (!product) return fail("One of the selected products is no longer available.");
      if (product.stock < item.quantity) {
        return fail(`"${product.name}" only has ${product.stock} available in stock.`);
      }
    }

    const lineItems = order.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = Number(product.price ?? 0);
      return {
        productId: item.productId,
        productName: product.name ?? "Item",
        brand: product.brand ?? "",
        unitPrice,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
        newStock: Math.max(0, (product.stock ?? 0) - item.quantity),
      };
    });

    const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const deliveryFee = order.fulfillmentType === "delivery" ? (subtotal >= 1500 ? 0 : 120) : 0;
    const orderNo = `ORD-${Math.floor(100000 + Math.random() * 899999)}`;

    const { data: newOrder, error: insertError } = await sqlDb
      .from("orders")
      .insert({
        user_id: userId,
        order_no: orderNo,
        fulfillment_type: order.fulfillmentType,
        pickup_branch: order.pickupBranch ?? null,
        delivery_address: order.deliveryAddress ?? null,
        delivery_fee: deliveryFee,
        subtotal,
        total: subtotal + deliveryFee,
        status: "Pending",
        estimated_delivery: order.fulfillmentType === "delivery" ? "3-5 business days" : null,
      })
      .select()
      .single();
    if (insertError || !newOrder)
      return fail(insertError?.message ?? "Could not place your order.");

    const { error: itemsError } = await sqlDb.from("order_items").insert(
      lineItems.map((item) => ({
        order_id: newOrder.id,
        product_id: item.productId,
        product_name: item.productName,
        brand: item.brand,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        line_total: item.lineTotal,
      })),
    );
    if (itemsError) return fail(itemsError.message);

    // Order items inserted.
    // Inventory stock will be deducted ONLY after Stripe payment confirmation in verifyStripeSessionServerFn.

    // Create a corresponding bill in bills table so it appears in Pay Bills
    const invoiceNo = `INV-${orderNo.replace("ORD-", "")}`;
    const { data: newBill } = await sqlDb
      .from("bills")
      .insert({
        patient_id: userId,
        invoice_no: invoiceNo,
        category: "Medical Store",
        description: `Medical Store Order #${orderNo}`,
        amount: subtotal + deliveryFee,
        status: "Pending",
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      })
      .select()
      .maybeSingle();

    return ok({
      order: mapOrder({
        ...newOrder,
        order_items: lineItems.map((item) => ({
          product_name: item.productName,
          brand: item.brand,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          line_total: item.lineTotal,
        })),
      }),
      bill: newBill,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not place your order.");
  }
}

async function getStoreNotifications() {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in.");
    const { data, error } = await sqlDb
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return fail(error.message);
    const notifications = (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message ?? "",
      kind: row.kind,
      createdAt: row.created_at,
    }));
    return ok({ notifications });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load notifications.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cart persistence (per-user, survives re-login)
// ─────────────────────────────────────────────────────────────────────────────

type CartLine = { productId: string; quantity: number };
type CartItemRow = { id: string; product_id: string; quantity: number };

function sanitizeCartLines(lines: unknown): CartLine[] {
  if (!Array.isArray(lines)) return [];
  const map = new Map<string, number>();
  for (const line of lines) {
    const raw = line as Record<string, unknown>;
    const productId = typeof raw?.productId === "string" ? raw.productId : "";
    const qty = Math.floor(Number(raw?.quantity ?? 0));
    if (!productId || !Number.isFinite(qty) || qty < 1) continue;
    map.set(productId, Math.max(1, Math.min(qty, 99)));
  }
  return [...map].map(([productId, quantity]) => ({ productId, quantity }));
}

function buildCartItems(products: any[], qtyByPid: Map<string, number>) {
  const productMap = new Map<string, any>(products.map((p: any) => [p.id, p as any]));
  const items: any[] = [];
  const notices: string[] = [];
  for (const [pid, rawQty] of qtyByPid) {
    const product = productMap.get(pid);
    if (!product) continue;
    if ((product.stock ?? 0) <= 0) {
      notices.push(`${product.name} is out of stock and was removed from your cart.`);
      continue;
    }
    const quantity = Math.max(1, Math.min(rawQty, product.stock));
    if (quantity !== rawQty) {
      notices.push(`Only ${product.stock} left of ${product.name}. Quantity adjusted.`);
    }
    items.push({ ...mapProduct(product), quantity });
  }
  items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { items, notices };
}

async function fetchCartRows(userId: string): Promise<CartItemRow[]> {
  const { data, error } = await sqlDb
    .from("cart_items")
    .select("id, product_id, quantity")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CartItemRow[];
}

async function fetchCartProducts(ids: string[]) {
  if (!ids.length) return [] as any[];
  const { data, error } = await sqlDb.from("products").select("*").in("id", ids);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Returns the signed-in user's persisted cart. Rows whose product no longer
 * exists or is out of stock are removed from the database; quantities above
 * available stock are clamped — the response explains what changed.
 */
async function getCart() {
  try {
    const userId = await getUserId();
    if (!userId) return ok({ items: [], notices: [] });

    const rows = await fetchCartRows(userId);
    const qtyByPid = new Map(rows.map((r) => [r.product_id, r.quantity]));
    const products = await fetchCartProducts([...qtyByPid.keys()]);
    const { items, notices } = buildCartItems(products, qtyByPid);

    // Self-heal persisted rows so stale lines never resurface.
    const keepIds = new Set(items.map((i: any) => i.id as string));
    const staleRowIds = rows.filter((r) => !keepIds.has(r.product_id)).map((r) => r.id);
    if (staleRowIds.length) {
      await sqlDb.from("cart_items").delete().eq("user_id", userId).in("id", staleRowIds);
    }
    for (const item of items) {
      const row = rows.find((r) => r.product_id === item.id);
      if (row && row.quantity !== item.quantity) {
        await sqlDb
          .from("cart_items")
          .update({ quantity: item.quantity })
          .eq("id", row.id)
          .eq("user_id", userId);
      }
    }
    return ok({ items, notices });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load your saved cart.");
  }
}

/**
 * Merges a guest cart (local storage lines) into the user's persisted cart:
 * quantities are combined for matching products, new ones are added, and
 * everything is clamped to current stock. Returns the merged cart.
 */
async function mergeGuestCart(lines: CartLine[]) {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in to save your cart.");

    const guestMap = new Map(sanitizeCartLines(lines).map((l) => [l.productId, l.quantity]));
    const rows = await fetchCartRows(userId);
    const rowMap = new Map(rows.map((r) => [r.product_id, r]));

    const allIds = [...new Set([...guestMap.keys(), ...rowMap.keys()])];
    const products = await fetchCartProducts(allIds);
    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p as any]));

    const finalQty = new Map<string, number>();
    for (const pid of allIds) {
      const product = productMap.get(pid);
      const existing = rowMap.get(pid);
      if (!product || (product.stock ?? 0) <= 0) {
        if (existing) {
          await sqlDb.from("cart_items").delete().eq("id", existing.id).eq("user_id", userId);
        }
        continue;
      }
      const combined = (existing?.quantity ?? 0) + (guestMap.get(pid) ?? 0);
      if (combined < 1) continue;
      const quantity = Math.min(combined, product.stock);
      finalQty.set(pid, quantity);
      if (existing) {
        if (existing.quantity !== quantity) {
          await sqlDb
            .from("cart_items")
            .update({ quantity })
            .eq("id", existing.id)
            .eq("user_id", userId);
        }
      } else {
        await sqlDb.from("cart_items").insert({ user_id: userId, product_id: pid, quantity });
      }
    }

    const { items, notices } = buildCartItems(products, finalQty);
    return ok({ items, notices });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not merge your cart.");
  }
}

/**
 * Reconciles the persisted cart with the client's desired state — inserts,
 * updates, and deletes are derived server-side so add / set-quantity / remove
 * can all share one idempotent background call.
 */
async function syncCart(lines: CartLine[]) {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in to save your cart.");

    const desired = new Map(sanitizeCartLines(lines).map((l) => [l.productId, l.quantity]));
    const rows = await fetchCartRows(userId);
    const rowMap = new Map(rows.map((r) => [r.product_id, r]));

    const products = await fetchCartProducts([...new Set([...desired.keys(), ...rowMap.keys()])]);
    const productMap = new Map<string, any>(products.map((p: any) => [p.id, p as any]));

    for (const row of rows) {
      const product = productMap.get(row.product_id);
      const wanted = desired.get(row.product_id);
      if (!product || (product.stock ?? 0) <= 0 || wanted === undefined) {
        await sqlDb.from("cart_items").delete().eq("id", row.id).eq("user_id", userId);
        rowMap.delete(row.product_id);
      }
    }

    const finalQty = new Map<string, number>();
    for (const [pid, qty] of desired) {
      const product = productMap.get(pid);
      if (!product || (product.stock ?? 0) <= 0) continue;
      const quantity = Math.min(qty, product.stock);
      finalQty.set(pid, quantity);

      const existing = rowMap.get(pid);
      if (existing) {
        if (existing.quantity !== quantity) {
          await sqlDb
            .from("cart_items")
            .update({ quantity })
            .eq("id", existing.id)
            .eq("user_id", userId);
        }
      } else {
        await sqlDb.from("cart_items").insert({ user_id: userId, product_id: pid, quantity });
      }
    }

    const { items } = buildCartItems(products, finalQty);
    return ok({ items });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not save your cart.");
  }
}

/** Empties the signed-in user's persisted cart (used after checkout). */
async function clearCart() {
  try {
    const userId = await getUserId();
    if (!userId) return ok({ cleared: true });
    await sqlDb.from("cart_items").delete().eq("user_id", userId);
    return ok({ cleared: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not clear your saved cart.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Insurance
// ─────────────────────────────────────────────────────────────────────────────

function mapPlan(row: any) {
  const monthly = Number(row.monthly_premium ?? 0);
  const annual = Number(row.annual_premium ?? (monthly > 0 ? monthly * 10.2 : 0));
  const covLimit = Number(row.coverage_limit ?? 250000);
  const covPercent = row.coverage_percentage ?? 100 - Number(row.co_pay_percent ?? 0);

  return {
    id: row.id,
    code: row.code || (row.id ? String(row.id).replace("plan-", "").toUpperCase() : "INS-PLAN"),
    name: row.name || "Comprehensive Health Coverage",
    provider: row.provider || "SugboDoc Health Partners",
    providerDescription:
      row.provider_about ||
      row.provider_description ||
      row.description ||
      "Accredited healthcare provider in Cebu.",
    providerHotline: row.provider_hotline || "+63 (32) 255-8000",
    providerWebsite: row.provider_website || "https://sugbodoc.ph/insurance",
    providerEmail: row.provider_email || "care@sugbodoc.ph",
    providerRating: Number(row.provider_rating ?? 4.8),
    providerMembers: Number(row.provider_members ?? 1250000),
    monthlyPremium: monthly.toFixed(2),
    annualPremium: annual.toFixed(2),
    coverageLimit: covLimit.toFixed(2),
    coveragePercentage: covPercent,
    validityMonths: Number(row.validity_months ?? 12),
    tag: row.tag || (covPercent === 100 ? "100% Cashless" : "Verified Offer"),
    category: row.category || row.type || "Comprehensive HMO",
    benefits:
      Array.isArray(row.benefits) && row.benefits.length > 0
        ? row.benefits
        : [
            "Inpatient hospitalization and room & board accommodation",
            "Unlimited outpatient clinic consultations with accredited specialists",
            "Annual Physical Examination (APE) and diagnostic health labs",
            "Emergency room care and ambulance transportation",
            "Prescription medicine allowance at SugboDoc Medical Store",
          ],
    eligibility:
      Array.isArray(row.eligibility) && row.eligibility.length > 0
        ? row.eligibility
        : [
            "Ages 18 to 65 years old (renewable up to 75)",
            "Philippine citizens and legal resident visa holders",
            "Valid government-issued ID required upon enrollment",
          ],
    waitingPeriod:
      row.waiting_period ||
      "Immediate emergency coverage; zero waiting for outpatient clinic visits",
    exclusions:
      Array.isArray(row.exclusions) && row.exclusions.length > 0
        ? row.exclusions
        : [
            "Elective cosmetic surgery without medical necessity",
            "Experimental non-FDA certified holistic remedies",
          ],
    includedServices:
      Array.isArray(row.included_services) && row.included_services.length > 0
        ? row.included_services
        : [
            "Specialist Consultations",
            "Complete Blood Count (CBC) & Chem Panels",
            "Chest Radiography & 2D Echo",
            "Emergency Hospital Admission",
            "Preventive Health Checkups",
          ],
    maximumClaims: Number(row.maximum_claims ?? 20),
    renewalPolicy:
      row.renewal_policy || "Guaranteed annual renewal with preferential discount upon tenure.",
    termsAndConditions:
      row.terms_and_conditions ||
      row.description ||
      "Healthcare coverage provided in compliance with Philippine Insurance Commission guidelines. Instant activation upon confirmed Stripe payment.",
    faqs:
      Array.isArray(row.faqs) && row.faqs.length > 0
        ? row.faqs
        : [
            {
              question: "How soon is my policy activated after Stripe payment?",
              answer: "Your policy is activated instantly upon confirmed checkout on Stripe.",
            },
            {
              question: "Can I use this across Cebu hospitals?",
              answer:
                "Yes, all partner hospitals in Cebu and Central Visayas honor cashless card verification.",
            },
          ],
    logoUrl:
      row.logo_url ||
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=160&auto=format&fit=crop&q=80",
    cardImageUrl:
      row.card_image_url ||
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop&q=80",
    description: row.description ?? "",
    active: row.is_active !== false && row.active !== false,
  };
}

function mapPolicy(row: any) {
  const plan = row.insurance_plans;
  const rawStatus = String(row.status ?? "pending").toLowerCase();

  let mappedStatus: "active" | "expired" | "pending" | "cancelled" | "rejected" = "pending";
  if (rawStatus === "active" || rawStatus === "approved") {
    mappedStatus = "active";
  } else if (rawStatus === "expired") {
    mappedStatus = "expired";
  } else if (rawStatus === "cancelled" || rawStatus === "canceled") {
    mappedStatus = "cancelled";
  } else if (rawStatus === "rejected" || rawStatus === "declined" || rawStatus === "failed") {
    mappedStatus = "rejected";
  } else {
    mappedStatus = "pending";
  }

  let paymentStatus: "paid" | "pending" | "overdue" | "failed" | "cancelled" | "refunded" =
    "pending";
  const rawPaymentStatus = String(row.payment_status ?? "").toLowerCase();

  if (rawPaymentStatus === "paid" || mappedStatus === "active") {
    paymentStatus = "paid";
  } else if (rawPaymentStatus === "failed" || rawStatus === "failed") {
    paymentStatus = "failed";
  } else if (rawPaymentStatus === "cancelled" || rawStatus === "cancelled") {
    paymentStatus = "cancelled";
  } else if (rawPaymentStatus === "overdue") {
    paymentStatus = "overdue";
  } else if (rawPaymentStatus === "refunded") {
    paymentStatus = "refunded";
  } else {
    paymentStatus = "pending";
  }

  const coverageLimit = Number(row.coverage_limit ?? plan?.coverage_limit ?? 250000);
  const remainingCoverage = Number(row.remaining_coverage ?? coverageLimit);
  const premiumAmount = Number(row.premium_amount ?? plan?.monthly_premium ?? 1850);

  return {
    id: row.id,
    planId: row.plan_id,
    planName: plan?.name || row.plan_name || "Health Insurance Plan",
    provider: plan?.provider || row.provider || "Insurance Provider",
    policyNumber: row.policy_number,
    insuranceId: row.policy_number,
    status: mappedStatus,
    expirationDate: row.end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    renewalDate: row.end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    coverageLimit: coverageLimit.toFixed(2),
    remainingCoverage: remainingCoverage.toFixed(2),
    paymentStatus,
    premiumAmount: premiumAmount.toFixed(2),
    billingCycle: row.billing_cycle || "annual",
    billId: row.bill_id,
    purchasedAt: row.created_at || new Date().toISOString(),
  };
}

async function getInsurancePlans() {
  try {
    const { data, error } = await sqlDb
      .from("insurance_plans")
      .select("*")
      .order("monthly_premium", { ascending: true });
    if (error) return fail(error.message);
    const plans = (data ?? []).map(mapPlan).filter((p) => p.active);
    return ok({ plans });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load insurance plans.");
  }
}

async function getInsurancePolicies() {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in.");
    const { data, error } = await sqlDb
      .from("insurance_policies")
      .select("*, insurance_plans(*)")
      .or(`user_id.eq.${userId},patient_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);
    return ok({ policies: (data ?? []).map(mapPolicy) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load your insurance policies.");
  }
}

async function purchaseInsurance(
  planId: string,
  _termsAccepted: boolean,
  billingCycle: "monthly" | "annual" = "annual",
) {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in.");
    const { data: plan, error: planError } = await sqlDb
      .from("insurance_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (planError) return fail(planError.message);
    if (!plan) return fail("Plan not found");

    // 1. Check if user already has an active policy for this plan
    const { data: existingPolicies } = await sqlDb
      .from("insurance_policies")
      .select("*")
      .or(`user_id.eq.${userId},patient_id.eq.${userId}`)
      .eq("plan_id", plan.id);

    const activePolicy = (existingPolicies ?? []).find(
      (p) => String(p.status).toLowerCase() === "active",
    );
    if (activePolicy) {
      return fail(
        `You already have an active policy (${activePolicy.policy_number}) for ${plan.name}.`,
      );
    }

    const monthlyAmount = Number(plan.monthly_premium ?? 1850);
    const annualAmount = Number(plan.annual_premium ?? monthlyAmount * 10.2);
    const amount = billingCycle === "monthly" ? monthlyAmount : annualAmount;

    // 2. Reuse or create pending policy
    let policyRow = (existingPolicies ?? []).find(
      (p) =>
        String(p.status).toLowerCase() === "pending payment" ||
        String(p.status).toLowerCase() === "pending_payment" ||
        String(p.status).toLowerCase() === "pending",
    );

    const planCode = plan.code || String(plan.id).replace("plan-", "").toUpperCase();
    const policyNumber = `SD-${planCode}-${Math.floor(10000 + Math.random() * 89999)}`;

    if (!policyRow) {
      const { data: newPolicy, error: policyError } = await sqlDb
        .from("insurance_policies")
        .insert({
          user_id: userId,
          patient_id: userId,
          plan_id: plan.id,
          plan_name: plan.name,
          provider: plan.provider,
          policy_number: policyNumber,
          coverage_limit: plan.coverage_limit,
          remaining_coverage: plan.coverage_limit,
          co_pay_percent: plan.co_pay_percent ?? 0,
          premium_amount: amount,
          billing_cycle: billingCycle,
          status: "Pending Payment",
          payment_status: "Pending",
        })
        .select()
        .single();
      if (policyError || !newPolicy)
        return fail(policyError?.message ?? "Could not create policy.");
      policyRow = newPolicy;
    } else {
      await sqlDb
        .from("insurance_policies")
        .update({
          premium_amount: amount,
          billing_cycle: billingCycle,
          status: "Pending Payment",
          payment_status: "Pending",
        })
        .eq("id", policyRow.id);
    }

    // 3. Create or reuse bill
    let billRow: any = null;
    try {
      const invoiceNo = `INV-${Math.floor(10000 + Math.random() * 89999)}`;
      const { data: newBill } = await sqlDb
        .from("bills")
        .insert({
          patient_id: userId,
          invoice_no: invoiceNo,
          category: "Insurance",
          description: `${plan.name} - ${billingCycle === "annual" ? "Annual" : "Monthly"} Premium (${policyRow.policy_number})`,
          amount,
          status: "Pending",
        })
        .select()
        .maybeSingle();

      billRow = newBill;

      if (billRow) {
        await sqlDb
          .from("insurance_policies")
          .update({ bill_id: billRow.id })
          .eq("id", policyRow.id);
      }
    } catch {
      // Continue if bills insert fails
    }

    const { data: userData } = await sqlDb.auth.getUser();
    const finalInvoiceNo = billRow?.invoice_no ?? `INV-${policyRow.policy_number}`;
    const finalDescription = `${plan.name} - ${billingCycle === "annual" ? "Annual" : "Monthly"} Coverage Premium (${policyRow.policy_number})`;

    return ok({
      policy: mapPolicy({ ...policyRow, insurance_plans: plan }),
      bill: billRow
        ? {
            id: billRow.id,
            invoiceNo: billRow.invoice_no,
            description: billRow.description ?? "",
            amount: Number(billRow.amount).toFixed(2),
            status: billRow.status,
            createdAt: billRow.created_at,
          }
        : null,
      checkout: {
        invoiceId: billRow?.id ?? "",
        invoiceNo: finalInvoiceNo,
        policyId: policyRow.id,
        patientId: userId,
        amount,
        description: finalDescription,
        patientEmail: userData.user?.email ?? "",
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not start the insurance purchase.");
  }
}

async function renewInsurance(policyId: string) {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in.");
    const { data: policy, error: policyError } = await sqlDb
      .from("insurance_policies")
      .select("*")
      .eq("id", policyId)
      .eq("user_id", userId)
      .maybeSingle();
    if (policyError) return fail(policyError.message);
    if (!policy) return fail("Policy not found");

    const startDate = new Date();
    const endDate = new Date(startDate);
    const { data: plan } = await sqlDb
      .from("insurance_plans")
      .select("validity_months")
      .eq("id", policy.plan_id ?? "")
      .maybeSingle();
    endDate.setMonth(endDate.getMonth() + (plan?.validity_months ?? 12));

    const { error: updateError } = await sqlDb
      .from("insurance_policies")
      .update({
        status: "Active",
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })
      .eq("id", policyId);
    if (updateError) return fail(updateError.message);

    return ok({ message: "Policy renewed successfully" });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not renew policy.");
  }
}

async function getInsurancePolicyPdf(policyId: string) {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in.");
    const { data: policy, error } = await sqlDb
      .from("insurance_policies")
      .select("*, insurance_plans(name, provider)")
      .eq("id", policyId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return fail(error.message);
    return ok({
      placeholder: true,
      filename: `policy-${policyId}.pdf`,
      policy: policy ? mapPolicy(policy) : { id: policyId },
      message: "PDF generation is a placeholder in this demo.",
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not generate the policy PDF.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────────────────────

const checkoutSessions = new Map<string, Record<string, any>>();
const paymentIntents = new Map<string, Record<string, any>>();

async function getPaymentConfig() {
  try {
    const config = await getStripeConfigServerFn();
    return ok(config);
  } catch (e) {
    // Do not hardcode key material here — report unconfigured and let the UI
    // guide the user to contact billing.
    return ok({ provider: "stripe", configured: false, publishableKey: "" });
  }
}

async function createPaymentIntent(
  amount: number,
  description: string,
  details?: { invoiceId?: string; invoiceNo?: string; patientEmail?: string },
) {
  const intentId = uid("pi");
  return ok({ clientSecret: `${intentId}_secret_demo`, intentId });
}

async function createCheckoutSession(
  amount: number,
  description: string,
  details: {
    invoiceId?: string;
    invoiceNo?: string;
    patientId?: string;
    patientEmail?: string;
    policyId?: string;
    successUrl: string;
    cancelUrl: string;
    orderId?: string;
    orderNo?: string;
    items?: Array<{
      productId: string;
      name: string;
      brand?: string;
      unitPrice: number;
      quantity: number;
      lineTotal: number;
    }>;
    fulfillmentType?: string;
    pickupBranch?: string;
    deliveryAddress?: string;
    deliveryFee?: number;
    subtotal?: number;
  },
) {
  try {
    const userId = await getUserId();
    const result = await createStripeCheckoutSessionServerFn({
      data: {
        amount,
        description,
        patientId: details.patientId || userId || undefined,
        billId: details.invoiceId,
        orderId: details.orderId,
        invoiceNo: details.invoiceNo,
        orderNo: details.orderNo,
        policyId: details.policyId,
        items: details.items,
        fulfillmentType: details.fulfillmentType,
        pickupBranch: details.pickupBranch,
        deliveryAddress: details.deliveryAddress,
        deliveryFee: details.deliveryFee,
        subtotal: details.subtotal,
        successUrl: details.successUrl,
        cancelUrl: details.cancelUrl,
      },
    });
    return ok({
      sessionId: result.sessionId,
      url: result.url,
      paymentIntentId: result.paymentIntentId,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unable to start Stripe Checkout.");
  }
}

/**
 * Creates a Stripe PaymentIntent for a bill — feeds the embedded Stripe
 * Elements card form on the Billing page. Returns { clientSecret } on success.
 */
async function createBillPaymentIntent(params: {
  amount: number;
  description?: string;
  billId?: string;
  invoiceNo?: string;
}) {
  try {
    const result = await createBillPaymentIntentServerFn({ data: params });
    if (!result.success) {
      return fail(result.error || "Unable to initialize the card payment.");
    }
    return ok({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      amountTotal: result.amountTotal,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unable to initialize the card payment.");
  }
}

async function getCheckoutSession(sessionId: string) {
  try {
    // Read-only Stripe verification (no DB writes happen server-side).
    const result = await verifyStripeSessionServerFn({
      data: { sessionId },
    });
    if (!result.success) {
      return fail(result.error || "Could not verify Stripe checkout session.");
    }
    return ok({
      sessionId,
      status: result.sessionStatus ?? "open",
      paymentStatus: result.paymentStatus,
      paymentIntentId: result.paymentIntentId ?? null,
      amountTotal: result.amountTotal ?? 0,
      currency: result.currency ?? "php",
      metadata: result.metadata,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not verify Stripe checkout session.");
  }
}

async function processDirectStripePayment(params: {
  amount: number;
  orderId?: string;
  orderNo?: string;
  billId?: string;
  invoiceNo?: string;
  patientId?: string;
  description?: string;
}) {
  try {
    const userId = await getUserId();
    const result = await processDirectStripePaymentServerFn({
      data: {
        amount: params.amount,
        orderId: params.orderId,
        orderNo: params.orderNo,
        billId: params.billId,
        invoiceNo: params.invoiceNo,
        patientId: params.patientId || userId || undefined,
        description: params.description,
      },
    });
    if (result.success) {
      return ok(result);
    }
    return fail(result.error || "Payment processing failed.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not process Stripe payment.");
  }
}

async function getPaymentHistory() {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in.");
    const [paymentsRes, billsRes, ordersRes] = await Promise.all([
      sqlDb
        .from("payments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      sqlDb.from("bills").select("*").eq("patient_id", userId),
      sqlDb.from("orders").select("*, order_items(*)").eq("user_id", userId),
    ]);
    if (paymentsRes.error) return fail(paymentsRes.error.message);

    const bills = billsRes.data ?? [];
    const orders = ordersRes.data ?? [];

    const transactions = (paymentsRes.data ?? []).map((row) => {
      // Find matching bill
      const bill = bills.find(
        (b) =>
          b.id === row.bill_id ||
          (row.description && b.invoice_no && row.description.includes(b.invoice_no)),
      );

      // Find matching order
      const order = orders.find((o) => {
        if (row.description && row.description.includes(o.order_no)) return true;
        if (
          bill?.invoice_no &&
          o.order_no &&
          bill.invoice_no.replace(/\D/g, "") === o.order_no.replace(/\D/g, "")
        )
          return true;
        return false;
      });

      const invoiceNo =
        bill?.invoice_no ||
        (order?.order_no ? `INV-${order.order_no.replace("ORD-", "")}` : undefined);
      const category =
        bill?.category ||
        (order || (row.description && row.description.includes("Order"))
          ? "Medical Store"
          : "Healthcare");

      return {
        id: row.id,
        description:
          row.description ??
          bill?.description ??
          (order ? `Medical Store Order #${order.order_no}` : "Healthcare Payment"),
        amount: Number(row.amount ?? 0).toFixed(2),
        status: row.status,
        method: row.method ?? "Stripe",
        createdAt: row.created_at,
        transactionId: row.transaction_id ?? "",
        billId: row.bill_id ?? bill?.id ?? undefined,
        invoiceNo,
        orderNo: order?.order_no,
        category,
      };
    });
    return ok({ transactions });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load payment history.");
  }
}

async function confirmPayment(intentId: string) {
  try {
    const userId = await getUserId();
    if (!userId) return fail("You must be signed in.");
    const intent = paymentIntents.get(intentId);
    if (intent) intent.status = "succeeded";

    const invoiceId: string | undefined = intent?.invoiceId;
    if (invoiceId) {
      const { data: bill, error: billError } = await sqlDb
        .from("bills")
        .update({ status: "Paid", paid_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .select()
        .maybeSingle();
      if (billError) return fail(billError.message);
      if (bill) {
        await sqlDb.from("payments").insert({
          user_id: userId,
          bill_id: bill.id,
          amount: bill.amount,
          description: bill.description,
          status: "Paid",
          method: "Demo Checkout",
          transaction_id: intentId,
        });
      }
    }

    return ok({ status: "succeeded", intentId });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not confirm payment.");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications (Email via Brevo; SMS still a placeholder)
// ─────────────────────────────────────────────────────────────────────────────

async function sendSMS(_to: string, _message: string) {
  return ok({ sent: true });
}

async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const result = await sendEmailSafe({
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });
  return ok(result);
}

export const storeApi = {
  getStoreProducts,
  getStoreOrders,
  confirmStoreOrderReceived,
  createStoreOrder,
  getStoreNotifications,
  getCart,
  mergeGuestCart,
  syncCart,
  clearCart,
  getInsurancePlans,
  getInsurancePolicies,
  purchaseInsurance,
  renewInsurance,
  getInsurancePolicyPdf,
  getPaymentConfig,
  createPaymentIntent,
  createBillPaymentIntent,
  createCheckoutSession,
  getCheckoutSession,
  processDirectStripePayment,
  getPaymentHistory,
  confirmPayment,
  sendSMS,
  sendEmail,
};
