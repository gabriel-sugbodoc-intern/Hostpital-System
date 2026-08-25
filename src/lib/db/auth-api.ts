import { sqlDb } from "@/lib/db/sql-db";
import type { Database } from "@/lib/db/sql-types";

type AppRole = Database["public"]["Enums"]["app_role"];

type ApiResult<T> = { data: T; error?: never } | { data?: never; error: string };

type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: AppRole;
};

type MeUser = AuthUser & {
  status: string;
  emailVerified: boolean;
};

type ManagedUser = {
  id: string;
  email: string | null;
  name: string;
  username: string | null;
  phone: string | null;
  role: AppRole;
  status: string;
};

function ok<T>(data: T): ApiResult<T> {
  return { data };
}

function fail<T>(error: string): ApiResult<T> {
  return { error };
}

async function fetchRole(userId: string): Promise<AppRole> {
  const { data } = await sqlDb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as AppRole | undefined) ?? "patient";
}

async function fetchProfile(userId: string) {
  const { data } = await sqlDb.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
}

export const authApi = {
  async register(email: string, name: string, password: string, phone?: string) {
    console.debug("[auth-debug] api: authApi.register enter");
    try {
      const { data, error } = await sqlDb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          data: { name, phone: phone ?? null },
        },
      });

      if (error) return fail<{ token: string; user: AuthUser; needsConfirmation?: boolean }>(error.message);
      if (!data.user) return fail<{ token: string; user: AuthUser; needsConfirmation?: boolean }>("Sign up failed");

      const role = await fetchRole(data.user.id);
      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email ?? email,
        name,
        phone: phone ?? null,
        role,
      };

      if (!data.session) {
        return ok({ token: "", user, needsConfirmation: true });
      }

      return ok<{ token: string; user: AuthUser; needsConfirmation?: boolean }>({
        token: data.session.access_token,
        user,
      });

    } catch (e) {
      return fail<{ token: string; user: AuthUser; needsConfirmation?: boolean }>(
        e instanceof Error ? e.message : "Failed to register",
      );
    }
  },

  async login(identifier: string, password: string) {
    console.debug("[auth-debug] api: authApi.login enter");
    try {
      const { data, error } = await sqlDb.auth.signInWithPassword({
        email: identifier,
        password,
      });

      if (error) return fail<{ token: string; user: AuthUser }>(error.message);
      if (!data.user || !data.session)
        return fail<{ token: string; user: AuthUser }>("Login failed");

      const [profile, role] = await Promise.all([
        fetchProfile(data.user.id),
        fetchRole(data.user.id),
      ]);

      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email ?? identifier,
        name: profile?.name ?? (data.user.user_metadata?.name as string | undefined) ?? identifier,
        phone: profile?.phone ?? (data.user.user_metadata?.phone as string | undefined) ?? null,
        role,
      };

      return ok({ token: data.session.access_token, user });
    } catch (e) {
      return fail<{ token: string; user: AuthUser }>(e instanceof Error ? e.message : "Failed to login");
    }
  },

  async signInWithGoogle() {
    try {
      const mod = await import("@/integrations/lovable/index");
      const { lovable } = mod as { lovable: { auth: { signInWithOAuth: (provider: string, opts: { redirect_uri: string }) => Promise<unknown> } } };
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
      });
      return ok({ redirected: true });
    } catch (e) {
      return fail<{ redirected: boolean }>(e instanceof Error ? e.message : "Google sign-in is unavailable");
    }
  },

  async logout() {
    try {
      const { error } = await sqlDb.auth.signOut();
      if (error) return fail<{ success: boolean }>(error.message);
      return ok({ success: true });
    } catch (e) {
      return fail<{ success: boolean }>(e instanceof Error ? e.message : "Failed to logout");
    }
  },

  async getMe() {
    try {
      const { data, error } = await sqlDb.auth.getUser();
      if (error || !data.user) return ok<{ user: MeUser | null }>({ user: null });

      const [profile, role] = await Promise.all([
        fetchProfile(data.user.id),
        fetchRole(data.user.id),
      ]);

      const user: MeUser = {
        id: data.user.id,
        email: data.user.email ?? profile?.email ?? "",
        name: profile?.name ?? (data.user.user_metadata?.name as string | undefined) ?? "",
        phone: profile?.phone ?? null,
        role,
        status: profile?.status ?? "active",
        emailVerified: Boolean(data.user.email_confirmed_at),
      };

      return ok({ user });
    } catch (e) {
      return fail<{ user: MeUser | null }>(e instanceof Error ? e.message : "Failed to load user");
    }
  },

  async getManagedUsers(search?: string) {
    try {
      let query = sqlDb.from("profiles").select("id, email, name, phone");
      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        query = query.or(`name.ilike.${term},email.ilike.${term}`);
      }

      const { data: profiles, error } = await query;
      if (error) return fail<{ users: ManagedUser[] }>(error.message);

      const ids = (profiles ?? []).map((p) => p.id);
      const { data: roles } = ids.length
        ? await sqlDb.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as { user_id: string; role: AppRole }[] };

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

      const users: ManagedUser[] = (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        username: p.email ? p.email.split("@")[0] : null,
        phone: p.phone,
        role: roleMap.get(p.id) ?? "patient",
        status: "active",
      }));

      return ok({ users });
    } catch (e) {
      return fail<{ users: ManagedUser[] }>(e instanceof Error ? e.message : "Failed to load users");
    }
  },

  async updateUserRole(userId: string, role: AppRole) {
    try {
      const { data: current } = await sqlDb.auth.getUser();
      if (current.user?.id === userId) {
        const currentRole = await fetchRole(userId);
        if (currentRole === "admin" && role !== "admin") {
          return fail<{ user: ManagedUser }>("You cannot change your own admin role");
        }
      }

      const { error: deleteError } = await sqlDb.from("user_roles").delete().eq("user_id", userId);
      if (deleteError) return fail<{ user: ManagedUser }>(deleteError.message);

      const { error: insertError } = await sqlDb.from("user_roles").insert({ user_id: userId, role });
      if (insertError) return fail<{ user: ManagedUser }>(insertError.message);

      const profile = await fetchProfile(userId);
      const user: ManagedUser = {
        id: userId,
        email: profile?.email ?? null,
        name: profile?.name ?? "",
        username: profile?.email ? profile.email.split("@")[0] : null,
        phone: profile?.phone ?? null,
        role,
        status: "active",
      };

      return ok({ user });
    } catch (e) {
      return fail<{ user: ManagedUser }>(e instanceof Error ? e.message : "Failed to update role");
    }
  },

  async getDoctorDashboard() {
    try {
      const { data: authData, error: authError } = await sqlDb.auth.getUser();
      if (authError || !authData.user) return fail<Record<string, unknown>>("Not authenticated");

      const profile = await fetchProfile(authData.user.id);

      let doctorRow = await sqlDb
        .from("doctors")
        .select("*")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (!doctorRow.data && profile?.name) {
        doctorRow = await sqlDb.from("doctors").select("*").ilike("name", profile.name).maybeSingle();
      }

      const doctor = doctorRow.data;
      if (!doctor) return fail<Record<string, unknown>>("Doctor profile not found");

      const [{ data: appointments }, { data: encounters }] = await Promise.all([
        sqlDb.from("appointments").select("*").eq("doctor_id", doctor.id),
        sqlDb.from("encounters").select("*").eq("doctor_id", doctor.id),
      ]);

      const allAppointments = appointments ?? [];
      const allEncounters = encounters ?? [];

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();

      const patientIds = Array.from(new Set(allAppointments.map((a) => a.patient_id)));
      const { data: patientsProfiles } = patientIds.length
        ? await sqlDb.from("profiles").select("*").in("id", patientIds)
        : { data: [] as Database["public"]["Tables"]["profiles"]["Row"][] };

      const patientMap = new Map<string, any>((patientsProfiles ?? []).map((p: any) => [p.id, p]));

      const upcoming = allAppointments
        .filter((a) => `${a.appointment_date}T${a.appointment_time}` >= now.toISOString().slice(0, 16) || a.appointment_date >= today)
        .sort((a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`));

      const recentAppointments = upcoming.slice(0, 5).map((a) => ({
        id: a.id,
        patientName: patientMap.get(a.patient_id)?.name ?? "Unknown",
        date: a.appointment_date,
        time: a.appointment_time,
        status: a.status,
      }));

      const recentEncounters = [...allEncounters]
        .sort((a, b) => (b.encounter_date > a.encounter_date ? 1 : -1))
        .slice(0, 5)
        .map((e) => ({
          id: e.id,
          patientName: patientMap.get(e.patient_id)?.name ?? "Unknown",
          date: e.encounter_date,
          summary: e.summary,
          status: e.status,
        }));

      const assignedPatients = (patientsProfiles ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        status: p.status,
      }));

      const todaysAppointments = allAppointments.filter((a) => a.appointment_date === today);
      const upcomingAppointments = allAppointments.filter((a) => a.appointment_date >= today);

      const summary = {
        assignedPatients: patientIds.length,
        upcomingAppointments: upcomingAppointments.length,
        encounters: allEncounters.length,
        waitingInQueue: todaysAppointments.filter((a) => a.status === "waiting" || a.status === "checked-in").length,
      };

      return ok({
        doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty, avatarUrl: doctor.avatar_url, clinic: doctor.clinic, bio: doctor.bio },
        todaysAppointments,
        upcomingAppointments,
        patientCount: patientIds.length,
        stats: summary,
        summary,
        recentAppointments,
        recentEncounters,
        assignedPatients,
      });
    } catch (e) {
      return fail<Record<string, unknown>>(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  },
};
