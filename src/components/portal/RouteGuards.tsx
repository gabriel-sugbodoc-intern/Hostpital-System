import React, { useEffect, useState } from "react";
import { useLocation } from "@/lib/router-compat";
import { apiClient, clearAuthState, normalizeRole, type AppRole } from "@/lib/api-client";
import Shell from "@/components/portal/layout/Shell";
import AdminShell from "@/components/portal/admin/AdminShell";
import DoctorShell from "@/components/portal/doctor/DoctorShell";
import { PortalBaseProvider } from "@/lib/portal-base";

type GuardState = "loading" | "allowed" | "denied";

function homeForRole(role: AppRole) {
  if (role === "admin") return "/admin";
  if (role === "doctor") return "/doctor";
  return "/dashboard";
}

function useSession(allowedRoles?: AppRole[]) {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<GuardState>("loading");
  const [role, setRole] = useState<AppRole>("patient");

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      const { data } = await apiClient.getMe();
      if (!active) return;
      if (!data?.user) {
        clearAuthState("expired");
        setLocation("/", { replace: true });
        return;
      }
      const userRole = normalizeRole(data.user.role);
      setRole(userRole);
      setState(!allowedRoles || allowedRoles.includes(userRole) ? "allowed" : "denied");
    };

    void checkAuth();

    const handleAuthCleared = () => {
      if (active) {
        setState("denied");
        setLocation("/", { replace: true });
      }
    };

    const handlePageShow = () => {
      void checkAuth();
    };

    window.addEventListener("sugbodoc:auth-cleared", handleAuthCleared);
    window.addEventListener("popstate", checkAuth);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      active = false;
      window.removeEventListener("sugbodoc:auth-cleared", handleAuthCleared);
      window.removeEventListener("popstate", checkAuth);
      window.removeEventListener("pageshow", handlePageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLocation]);

  return { state, role };
}

function AccessDenied({ role }: { role: AppRole }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You do not have permission to access this area.
        </p>
        <button
          onClick={() => setLocation(homeForRole(role))}
          className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Return to your portal
        </button>
      </div>
    </div>
  );
}

export function PortalPage({ children }: { children: React.ReactNode }) {
  const { state } = useSession();
  if (state !== "allowed") return null;
  return <Shell>{children}</Shell>;
}

export function AdminPage({
  children,
  allowedRoles = ["admin"],
}: {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}) {
  const { state, role } = useSession(allowedRoles);

  if (state === "loading") return null;
  if (state === "denied") return <AccessDenied role={role} />;

  return (
    <PortalBaseProvider base="/admin">
      <AdminShell>{children}</AdminShell>
    </PortalBaseProvider>
  );
}

export function DoctorPage({ children }: { children: React.ReactNode }) {
  const { state, role } = useSession(["doctor"]);

  if (state === "loading") return null;
  if (state === "denied") return <AccessDenied role={role} />;

  return (
    <PortalBaseProvider base="/doctor">
      <DoctorShell>{children}</DoctorShell>
    </PortalBaseProvider>
  );
}
