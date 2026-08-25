/**
 * SugboDoc API client.
 *
 * Every method is backed by the live Lovable Cloud database through the
 * per-feature modules in `src/lib/db`. Row-level security enforces
 * patient / doctor / admin authorization on the server.
 */

import { authApi } from "@/lib/db/auth-api";
import { patientApi } from "@/lib/db/patient-api";
import { storeApi } from "@/lib/db/store-api";
import { adminApi } from "@/lib/db/admin-api";

export type AuthClearReason = "logout" | "expired";

export function clearAuthState(reason: AuthClearReason = "logout") {
  try {
    localStorage.removeItem("sugbodoc_auth");
    localStorage.removeItem("sugbodoc_user");
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {
    console.error("Error clearing storage during auth reset:", e);
  }
  window.dispatchEvent(new CustomEvent("sugbodoc:auth-cleared", { detail: { reason } }));
}

export type AppRole = "patient" | "doctor" | "admin";
export const APP_ROLES: AppRole[] = ["patient", "doctor", "admin"];

export function normalizeRole(role?: string | null): AppRole {
  const value = String(role ?? "").toLowerCase();
  if (value === "admin" || value === "administrator") return "admin";
  if (value === "doctor" || value === "physician") return "doctor";
  return "patient";
}

export const apiClient = {
  ...authApi,
  ...patientApi,
  ...storeApi,
  ...adminApi,
};

export async function logoutAndClear() {
  try {
    const result = await apiClient.logout();
    return result;
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : "Logout failed" } };
  } finally {
    clearAuthState("logout");
  }
}

export const logoutCurrentSession = logoutAndClear;
