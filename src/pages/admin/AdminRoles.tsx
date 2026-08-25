import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Search } from 'lucide-react';
import { apiClient, APP_ROLES, type AppRole } from '@/lib/api-client';

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: AppRole;
  status?: string;
};

const ROLE_LABEL: Record<AppRole, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  admin: 'Admin',
};

export default function AdminRoles() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setIsLoading(true);
    const { data, error } = await apiClient.getManagedUsers(term);
    if (error) toast.error(error);
    setUsers(((data as any)?.users ?? []) as ManagedUser[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 200);
    return () => window.clearTimeout(timer);
  }, [search, load]);

  const changeRole = async (user: ManagedUser, role: AppRole) => {
    if (role === user.role) return;
    setSavingId(user.id);
    const { data, error } = await apiClient.updateUserRole(user.id, role);
    setSavingId(null);
    if (error) {
      toast.error(error);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: (data as any).user.role } : u)));
    toast.success(`${user.name} is now a ${ROLE_LABEL[role]}.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Role Management</h2>
          <p className="text-sm text-muted-foreground">
            Assign Patient, Doctor, or Admin access. Changes apply the next time the user loads a page.
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name or email"
          className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Current Role</th>
                <th className="px-4 py-3">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              )}
              {!isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
              {!isLoading &&
                users.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-primary">
                        {ROLE_LABEL[user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        disabled={savingId === user.id}
                        onChange={(e) => void changeRole(user, e.target.value as AppRole)}
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                        data-testid={`role-select-${user.id}`}
                      >
                        {APP_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABEL[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
