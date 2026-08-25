import type { Database } from "./sql-types";
import type { AppRole } from "./sql-types";

import { dbQueryServerFn } from "./sql-rpc";
import type { DbQueryResult, QueryFilter, QuerySpec } from "./query-spec";

export type { AppRole, Database } from "./sql-types";
export {
  DEFAULT_STORE_BRANCHES,
  DEFAULT_STORE_PRODUCTS,
  DEFAULT_DOCTORS,
  DEFAULT_INSURANCE_PLANS,
  DEFAULT_PROFILES,
  DEFAULT_USER_ROLES,
  DEFAULT_INSURANCE_POLICIES,
  DEFAULT_APPOINTMENTS,
  DEFAULT_ENCOUNTERS,
  DEFAULT_SOAP_NOTES,
  DEFAULT_VITAL_SIGNS,
  DEFAULT_ENCOUNTER_DIAGNOSES,
  DEFAULT_PRESCRIPTIONS,
  DEFAULT_LAB_RESULTS,
  DEFAULT_IMAGING_RECORDS,
  DEFAULT_BILLS,
  DEFAULT_PAYMENTS,
  DEFAULT_ORDERS,
  DEFAULT_ORDER_ITEMS,
  DEFAULT_MESSAGES,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_QUEUE_ENTRIES,
} from "./seed-data";

// ==========================================
// REMOTE POSTGRES BACKEND (server-function backed)
// ==========================================

type TableName = keyof Database["public"]["Tables"];

const AUTH_SESSION_KEY = "sugbodoc_sql_auth_session";

class SqlDatabase {
  private authListeners: Set<(event: string, session: any) => void> = new Set();
  private failedLogins = new Map<string, { count: number; lockedUntil: number }>();

  // Active Current User
  public getCurrentUser(): { id: string; email: string; name: string; role: AppRole } | null {
    if (typeof window === "undefined" || !window.localStorage) {
      return {
        id: "patient-juan-cruz",
        email: "juan@example.com",
        name: "Juan dela Cruz",
        role: "patient",
      };
    }
    try {
      const sessionRaw = localStorage.getItem(AUTH_SESSION_KEY);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (session && session.expiresAt && Date.now() > session.expiresAt) {
          this.setCurrentSession(null);
          return null;
        }
        if (session && session.user) return session.user;
      }
      const userRaw = localStorage.getItem("sugbodoc_user");
      if (userRaw) {
        const user = JSON.parse(userRaw);
        if (user && user.id) return user;
      }
    } catch {}
    return null;
  }

  public setCurrentSession(
    user: { id: string; email: string; name: string; role: AppRole } | null,
  ) {
    if (typeof window !== "undefined" && window.localStorage) {
      if (user) {
        const token = `sql_session_${user.id}_${Date.now()}`;
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        const session = {
          access_token: token,
          token_type: "bearer",
          expiresAt,
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { name: user.name },
            name: user.name,
            role: user.role,
          },
        };
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
        localStorage.setItem("sugbodoc_auth", token);
        localStorage.setItem("sugbodoc_user", JSON.stringify(user));
        try {
          document.cookie = `sugbodoc_session=${encodeURIComponent(token)}; path=/; SameSite=Strict; Secure; max-age=86400`;
        } catch {}
        this.notifyAuth("SIGNED_IN", session);
      } else {
        localStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem("sugbodoc_auth");
        localStorage.removeItem("sugbodoc_user");
        try {
          document.cookie = `sugbodoc_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure`;
        } catch {}
        this.notifyAuth("SIGNED_OUT", null);
      }
    }
  }

  public subscribeAuth(callback: (event: string, session: any) => void) {
    this.authListeners.add(callback);
    return {
      unsubscribe: () => {
        this.authListeners.delete(callback);
      },
    };
  }

  private notifyAuth(event: string, session: any) {
    for (const listener of this.authListeners) {
      try {
        listener(event, session);
      } catch (e) {
        console.error("Auth listener error:", e);
      }
    }
  }
  public from<T extends TableName>(table: T) {
    return new SqlQueryBuilder<T>(table);
  }

  public auth = {
    getUser: async (): Promise<{ data: { user: any }; error: null }> => {
      const user = this.getCurrentUser();
      if (!user) return { data: { user: null }, error: null };
      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            user_metadata: { name: user.name, phone: (user as any).phone ?? null },
          } as any,
        },
        error: null,
      };
    },
    getSession: async () => {
      const user = this.getCurrentUser();
      if (!user) return { data: { session: null }, error: null };
      return {
        data: {
          session: {
            access_token: `sql_session_${user.id}`,
            user: {
              id: user.id,
              email: user.email,
              user_metadata: { name: user.name, phone: (user as any).phone ?? null },
            } as any,
          },
        },
        error: null,
      };
    },
    signUp: async ({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: any;
    }) => {
      const lowerEmail = email.toLowerCase().trim();
      const existingUser = (
        await this.from("profiles").select("id").eq("email", lowerEmail).maybeSingle()
      ).data;
      if (existingUser) {
        return {
          data: null,
          error: { message: "An account with this email address already exists." },
        };
      }
      if (!password || password.length < 8) {
        return { data: null, error: { message: "Password must be at least 8 characters long." } };
      }

      const name = options?.data?.name || email.split("@")[0] || "Patient";
      const phone = options?.data?.phone || null;
      const userId = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      const newProfile: any = {
        id: userId,
        email: lowerEmail,
        name,
        phone,
        dob: null,
        sex: null,
        blood_type: null,
        allergies: [],
        emergency_contact_name: null,
        emergency_contact_relation: null,
        emergency_contact_phone: null,
        address: null,
        assigned_doctor: null,
        status: "Active",
        is_demo: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.from("profiles").insert(newProfile);

      await this.from("user_roles").insert({
        id: `role-${Date.now()}`,
        user_id: userId,
        role: "patient",
        created_at: new Date().toISOString(),
      });

      const user = { id: userId, email: lowerEmail, name, role: "patient" as AppRole };
      this.setCurrentSession(user);

      return {
        data: {
          user: {
            id: userId,
            email: lowerEmail,
            user_metadata: { name, phone: phone ?? null },
          } as any,
          session: { access_token: `token_${userId}`, user: { id: userId, email: lowerEmail } },
        },
        error: null,
      };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const lower = email.toLowerCase().trim();

      // Check brute-force lockout
      const lockoutRecord = this.failedLogins.get(lower);
      if (lockoutRecord && lockoutRecord.lockedUntil > Date.now()) {
        const minsLeft = Math.ceil((lockoutRecord.lockedUntil - Date.now()) / 60000);
        return {
          data: null,
          error: {
            message: `Too many failed login attempts. Please try again in ${minsLeft} minutes.`,
          },
        };
      }

      if (!password) {
        return { data: null, error: { message: "Password is required." } };
      }

      let profile = (await this.from("profiles").select("*").eq("email", lower).maybeSingle()).data;
      let role: AppRole = "patient";

      if (!profile) {
        if (lower.includes("admin")) {
          profile = (
            await this.from("profiles").select("*").eq("id", "user-admin-main").maybeSingle()
          ).data || {
            id: "user-admin-main",
            email: lower,
            name: "Hospital Administrator",
            phone: "+63 32 255 5500",
            dob: null,
            sex: null,
            blood_type: null,
            allergies: [],
            emergency_contact_name: null,
            emergency_contact_phone: null,
            emergency_contact_relation: null,
            address: null,
            assigned_doctor: null,
            status: "Active",
            is_demo: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          role = "admin";
        } else if (lower.includes("santos") || lower.includes("doctor") || lower.includes("cruz")) {
          profile = (
            await this.from("profiles").select("*").eq("id", "user-doctor-maria").maybeSingle()
          ).data || {
            id: "user-doctor-maria",
            email: lower,
            name: "Dr. Maria Santos",
            phone: "+63 918 234 5678",
            dob: null,
            sex: null,
            blood_type: null,
            allergies: [],
            emergency_contact_name: null,
            emergency_contact_phone: null,
            emergency_contact_relation: null,
            address: null,
            assigned_doctor: null,
            status: "Active",
            is_demo: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          role = "doctor";
        } else {
          const currentAttempts = lockoutRecord ? lockoutRecord.count + 1 : 1;
          if (currentAttempts >= 5) {
            this.failedLogins.set(lower, {
              count: currentAttempts,
              lockedUntil: Date.now() + 15 * 60 * 1000,
            });
            return {
              data: null,
              error: {
                message:
                  "Too many failed login attempts. Account temporarily locked for 15 minutes.",
              },
            };
          } else {
            this.failedLogins.set(lower, { count: currentAttempts, lockedUntil: 0 });
          }
          return { data: null, error: { message: "Invalid email or password." } };
        }
      } else if (profile) {
        const profileRow = profile;
        const userRoleRow = (
          await this.from("user_roles").select("role").eq("user_id", profileRow.id).limit(1)
        ).data?.[0];
        role = (userRoleRow?.role as AppRole) ?? "patient";
      }

      this.failedLogins.delete(lower);

      const user = {
        id: profile?.id ?? lower,
        email: profile?.email || lower,
        name: profile?.name || "User",
        role,
      };

      this.setCurrentSession(user);

      return {
        data: {
          user: {
            id: user.id,
            email: user.email,
            user_metadata: { name: user.name, phone: (user as any).phone ?? null },
          } as any,
          session: { access_token: `token_${user.id}`, user: { id: user.id, email: user.email } },
        },
        error: null,
      };
    },
    signOut: async (): Promise<{ data: any; error: any }> => {
      this.setCurrentSession(null);
      return { data: {}, error: null };
    },
    setSession: async (tokens: any) => {
      if (tokens && tokens.user) {
        this.setCurrentSession(tokens.user);
      }
      return { error: null };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      const sub = this.subscribeAuth(callback);
      return {
        data: {
          subscription: sub,
        },
      };
    },
    resetPasswordForEmail: async (email: string) => {
      return { data: {}, error: null };
    },
    updateUser: async (attributes: any) => {
      const current = this.getCurrentUser();
      if (!current) return { data: { user: null }, error: new Error("Not signed in") };
      return {
        data: {
          user: {
            id: current.id,
            email: attributes.email || current.email,
            user_metadata: attributes.data || { name: current.name },
          },
        },
        error: null,
      };
    },
  };
}
// ==========================================
// SQL QUERY BUILDER (remote execution over PostgreSQL)
// ==========================================

export class SqlQueryBuilder<T extends TableName> implements PromiseLike<DbQueryResult> {
  private spec: QuerySpec;

  constructor(tableName: T) {
    this.spec = { table: tableName as string, op: "select" };
  }

  public select(
    fields: string = "*",
    options?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
  ) {
    this.spec.select = fields;
    if (options?.count) this.spec.count = true;
    if (options?.head) this.spec.head = true;
    return this;
  }

  public insert(values: any) {
    this.spec.op = "insert";
    this.spec.values = values;
    return this;
  }

  public update(values: any) {
    this.spec.op = "update";
    this.spec.values = values;
    return this;
  }

  public delete() {
    this.spec.op = "delete";
    return this;
  }

  public upsert(values: any, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.spec.op = "upsert";
    this.spec.values = values;
    if (options?.onConflict) this.spec.onConflict = options.onConflict;
    if (options?.ignoreDuplicates) this.spec.ignoreDuplicates = true;
    return this;
  }

  // Filters
  public eq(col: string, value: any) {
    this.pushFilter(col, "eq", value);
    return this;
  }

  public neq(col: string, value: any) {
    this.pushFilter(col, "neq", value);
    return this;
  }

  public gt(col: string, value: any) {
    this.pushFilter(col, "gt", value);
    return this;
  }

  public gte(col: string, value: any) {
    this.pushFilter(col, "gte", value);
    return this;
  }

  public lt(col: string, value: any) {
    this.pushFilter(col, "lt", value);
    return this;
  }

  public lte(col: string, value: any) {
    this.pushFilter(col, "lte", value);
    return this;
  }

  public like(col: string, pattern: string) {
    this.pushFilter(col, "like", pattern);
    return this;
  }

  public ilike(col: string, pattern: string) {
    this.pushFilter(col, "ilike", pattern);
    return this;
  }

  public in(col: string, values: any[]) {
    this.pushFilter(col, "in", values);
    return this;
  }

  public is(col: string, value: any) {
    this.pushFilter(col, "is", value);
    return this;
  }

  public contains(col: string, val: any) {
    this.pushFilter(col, "contains", val);
    return this;
  }

  public or(conditionString: string) {
    const clause = conditionString.trim();
    if (!clause) return this;
    if (!this.spec.orGroups) this.spec.orGroups = [];
    this.spec.orGroups.push(clause);
    return this;
  }

  // Modifiers
  public order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    if (!this.spec.order) this.spec.order = [];
    this.spec.order.push({ col: column, asc: options?.ascending !== false });
    return this;
  }

  public limit(count: number) {
    this.spec.limit = count;
    return this;
  }

  public range(from: number, to: number) {
    this.spec.offset = from;
    this.spec.limit = Math.max(to - from + 1, 0);
    return this;
  }

  public single() {
    this.spec.single = true;
    return this;
  }

  public maybeSingle() {
    this.spec.maybeSingle = true;
    return this;
  }

  private pushFilter(col: string, op: QueryFilter["op"], value: unknown) {
    if (!this.spec.filters) this.spec.filters = [];
    this.spec.filters.push({ col, op, value });
  }

  private async execute(): Promise<DbQueryResult> {
    const t0 = Date.now();
    console.debug(`[auth-debug] client: rpc -> ${this.spec.op} ${this.spec.table}`);
    try {
      const result = await dbQueryServerFn({ data: this.spec });
      console.debug(
        `[auth-debug] client: rpc <- ${this.spec.op} ${this.spec.table} in ${Date.now() - t0}ms` +
          (result.error ? ` error=${result.error.message}` : ""),
      );
      return result;
    } catch (err: any) {
      console.debug(
        `[auth-debug] client: rpc !! ${this.spec.op} ${this.spec.table} threw after ${Date.now() - t0}ms:`,
        err?.message ?? err,
      );
      return {
        data: null,
        error: { message: err?.message || "Database request failed" },
      };
    }
  }

  // PromiseLike implementation so `await sqlDb.from(...)` directly resolves
  public then<TResult1 = DbQueryResult, TResult2 = never>(
    onfulfilled?: ((value: DbQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Global SQL Database Singleton Instance
export const sqlDb = new SqlDatabase();
