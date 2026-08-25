import React, { useEffect, useState } from 'react';
import { Mail, Phone, Stethoscope, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function DoctorProfile() {
  const [user, setUser] = useState<any>(null);
  const [doctor, setDoctor] = useState<{ name: string; specialty: string } | null>(null);

  useEffect(() => {
    apiClient.getMe().then(({ data }: { data?: any }) => setUser(data?.user ?? null));
    apiClient.getDoctorDashboard().then(({ data }: { data?: any }) => setDoctor(data?.doctor ?? null));
  }, []);

  const initials = user?.name
    ? user.name.split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="rounded-xl border border-border bg-card p-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{user?.name ?? 'Doctor'}</h2>
          <p className="text-sm text-muted-foreground">{doctor?.specialty ?? 'General Medicine'}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Account Details</h3>
        <Row icon={<Mail className="w-4 h-4" />} label="Email" value={user?.email ?? '—'} />
        <Row icon={<Phone className="w-4 h-4" />} label="Phone" value={user?.phone ?? '—'} />
        <Row icon={<Stethoscope className="w-4 h-4" />} label="Specialty" value={doctor?.specialty ?? '—'} />
        <Row icon={<ShieldCheck className="w-4 h-4" />} label="Role" value="Doctor" />
      </section>

      <p className="text-xs text-muted-foreground">
        Contact an administrator to update your clinical profile or role.
      </p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
