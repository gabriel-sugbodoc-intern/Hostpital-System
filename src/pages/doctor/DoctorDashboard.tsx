import React, { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Users, Calendar, HeartPulse, ListOrdered } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import StatusBadge from '@/components/portal/admin/StatusBadge';

type DoctorDashboardData = {
  doctor: { name: string; specialty: string };
  summary: {
    assignedPatients: number;
    upcomingAppointments: number;
    encounters: number;
    waitingInQueue: number;
  };
  recentAppointments: Array<Record<string, any>>;
  recentEncounters: Array<Record<string, any>>;
  assignedPatients: Array<Record<string, any>>;
};

export default function DoctorDashboard() {
  const [data, setData] = useState<DoctorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getDoctorDashboard()
      .then(({ data: dashboard }) => {
        if (dashboard) setData(dashboard as DoctorDashboardData);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading dashboard…</div>;
  }

  if (!data) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Dashboard unavailable.</div>;
  }

  const stats = [
    { label: 'Assigned Patients', value: data.summary.assignedPatients, icon: Users, to: '/doctor/patients' },
    { label: 'Upcoming Appointments', value: data.summary.upcomingAppointments, icon: Calendar, to: '/doctor/appointments' },
    { label: 'Encounters', value: data.summary.encounters, icon: HeartPulse, to: '/doctor/encounters' },
    { label: 'Waiting in Queue', value: data.summary.waitingInQueue, icon: ListOrdered, to: '/doctor/patients' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Welcome, {data.doctor.name}</h2>
        <p className="text-sm text-muted-foreground">{data.doctor.specialty}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Recent Appointments</h3>
            <Link to="/doctor/appointments" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {data.recentAppointments.length === 0 && (
              <p className="text-xs text-muted-foreground">No appointments assigned.</p>
            )}
            {data.recentAppointments.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between border-t border-border pt-2 first:border-t-0 first:pt-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{apt.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {apt.date} · {apt.time}
                  </p>
                </div>
                <StatusBadge status={apt.status} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">My Patients</h3>
            <Link to="/doctor/patients" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {data.assignedPatients.length === 0 && (
              <p className="text-xs text-muted-foreground">No assigned patients.</p>
            )}
            {data.assignedPatients.map((patient) => (
              <Link
                key={patient.id}
                to="/doctor/patients/$id"
                params={{ id: patient.id }}
                className="flex items-center justify-between border-t border-border pt-2 first:border-t-0 first:pt-0 hover:text-primary"
              >
                <div>
                  <p className="text-sm font-medium">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">{patient.email}</p>
                </div>
                <StatusBadge status={patient.status} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
