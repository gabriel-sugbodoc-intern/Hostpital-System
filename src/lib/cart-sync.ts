/**
 * Client-side cart persistence orchestration.
 *
 * - Guests: cart lives in localStorage (`sugbodoc_cart`) exactly as before.
 * - Signed-in users: the UI stays optimistic; changes are pushed to
 *   `cart_items` in the database through a short debounce, and on load the
 *   saved cart is fetched (guest lines are merged, never discarded).
 */

import { apiClient } from "@/lib/api-client";
import { sqlDb } from "@/lib/db/sql-db";

const CART_KEY = "sugbodoc_cart";
const SYNC_DEBOUNCE_MS = 600;

export type CartLine = { productId: string; quantity: number };

export type CartItemSnapshot = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  stock: number;
  brand: string;
  imageUrl: string;
  rating: string;
  reviewCount: number;
  prescriptionRequired: number;
  quantity: number;
};

type CartResponse = {
  items?: CartItemSnapshot[];
  notices?: string[];
};

export function readLocalCart(): CartItemSnapshot[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItemSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalCart(items: CartItemSnapshot[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Could not persist cart locally:", e);
  }
}

function currentUserId(): string | null {
  return sqlDb.getCurrentUser()?.id ?? null;
}

/** True when the browser has an authenticated session. */
export function hasSessionUser(): boolean {
  return currentUserId() !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hydration / guest-cart merge (runs once per login)
// ─────────────────────────────────────────────────────────────────────────────

export type CartResolution = {
  items: CartItemSnapshot[];
  notices: string[];
};

let resolving: { userId: string; promise: Promise<CartResolution> } | null = null;

/** A logout/login switch must force a fresh resolution. */
export function resetCartResolution() {
  resolving = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("sugbodoc:auth-cleared", resetCartResolution);
}

/**
 * Loads the persisted cart for the current user. If a guest cart is present in
 * localStorage it is merged server-side first (quantities combined), so nothing
 * the shopper built while logged out is lost. Memoized per login.
 */
export async function resolveCartForCurrentUser(): Promise<CartResolution | null> {
  const userId = currentUserId();
  if (!userId) return null;
  if (resolving?.userId === userId) return resolving.promise;

  const promise = (async (): Promise<CartResolution> => {
    const localItems = readLocalCart().filter((i) => i.quantity > 0 && i.id);
    const guestLines: CartLine[] = localItems.map((i) => ({
      productId: i.id,
      quantity: i.quantity,
    }));

    const result = guestLines.length
      ? await apiClient.mergeGuestCart(guestLines)
      : await apiClient.getCart();

    if (result.error || !result.data) {
      throw new Error(result.error ?? "Could not load your saved cart.");
    }

    const data = result.data as CartResponse;
    const items = data.items ?? [];
    writeLocalCart(items);
    return { items, notices: data.notices ?? [] };
  })();

  resolving = { userId, promise };
  return promise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debounced background sync (add / quantity change / remove → database)
// ─────────────────────────────────────────────────────────────────────────────

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingLines: CartLine[] | null = null;
let syncQueue: Promise<unknown> = Promise.resolve();

function toLines(items: CartItemSnapshot[]): CartLine[] {
  return items
    .filter((i) => i.quantity > 0)
    .map((i) => ({ productId: i.id, quantity: i.quantity }));
}

function pushSync(lines: CartLine[]) {
  syncQueue = syncQueue
    .then(() => apiClient.syncCart(lines))
    .then((result) => {
      if (result.error) {
        console.warn("[cart-sync] background sync failed:", result.error);
      }
    })
    .catch((err) => {
      console.warn("[cart-sync] background sync threw:", err?.message ?? err);
    });
  return syncQueue;
}

/** Optimistic UI has already updated — schedule the database write. */
export function scheduleCartSync(items: CartItemSnapshot[]) {
  if (!currentUserId()) return;
  pendingLines = toLines(items);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    if (!pendingLines) return;
    const lines = pendingLines;
    pendingLines = null;
    void pushSync(lines);
  }, SYNC_DEBOUNCE_MS);
}

/** Immediately pushes whatever is pending (or an explicit empty cart). */
export async function flushCartSync(lines?: CartLine[]) {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  const target = lines ?? pendingLines;
  pendingLines = null;
  if (!target || !currentUserId()) return;
  await pushSync(target);
}

/** Clears the persisted cart and any queued writes (after checkout). */
export async function clearPersistedCart() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  pendingLines = null;
  writeLocalCart([]);
  if (!currentUserId()) return;
  syncQueue = syncQueue
    .then(() => apiClient.clearCart())
    .catch((err) => {
      console.warn("[cart-sync] clear failed:", err?.message ?? err);
    });
  await syncQueue;
}
