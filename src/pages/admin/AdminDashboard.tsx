import React, { useEffect, useState } from 'react';
import { useLocation } from '@/lib/router-compat';
import { 
  Users, 
  Calendar, 
  ListOrdered, 
  Package, 
  TrendingUp, 
  Clock,
  AlertCircle,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import StatusBadge from '@/components/portal/admin/StatusBadge';

type DashboardData = {
  summary: {
    totalRegisteredPatients: number;
    activeAppointmentsToday: number;
    activeQueueCount: number;
    inventoryItems: number;
    lowStockAlerts: number;
  };
  recentAppointments: Array<Record<string, any>>;
  recentPatientRegistrations: Array<Record<string, any>>;
  recentOrders: Array<Record<string, any>>;
};

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    apiClient.getAdminDashboard?.()
      .then(({ data: dashboard, error: err }) => {
        if (err) {
          setError(err);
          toast.error(err);
        } else if (dashboard) {
          setData(dashboard as DashboardData);
        }
      })
      .catch(() => {
        setError('Failed to load dashboard data');
      })
      .finally(() => setIsLoading(false));
    const interval = window.setInterval(() => {
      apiClient.getAdminDashboard?.().then(({ data: dashboard }) => {
        if (dashboard) setData(dashboard as DashboardData);
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6">
          You do not have permission to access the admin portal.
        </p>
        <button
          onClick={() => setLocation('/dashboard')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
          data-testid="button-back-home"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        No dashboard data available.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Users className="w-5 h-5" />}
          label="Total Patients"
          value={data.summary.totalRegisteredPatients.toLocaleString()}
          trend="+12% this month"
          onClick={() => setLocation('/admin/patients')}
        />
        <MetricCard
          icon={<Package className="w-5 h-5" />}
          label="Inventory Items"
          value={data.summary.inventoryItems.toLocaleString()}
           trend="Medical Store"
           onClick={() => setLocation('/admin/inventory')}
        />
        <MetricCard
          icon={<Calendar className="w-5 h-5" />}
          label="Active Appointments"
          value={data.summary.activeAppointmentsToday.toLocaleString()}
          trend="Today"
          onClick={() => setLocation('/admin/appointments')}
        />
        <MetricCard
          icon={<ListOrdered className="w-5 h-5" />}
          label="Queue Length"
          value={data.summary.activeQueueCount.toLocaleString()}
          trend="Real-time"
          onClick={() => setLocation('/admin/queue')}
        />
        <MetricCard
          icon={<Package className="w-5 h-5" />}
          label="Low Stock Items"
          value={data.summary.lowStockAlerts.toLocaleString()}
          trend="Needs attention"
          variant="warning"
          onClick={() => setLocation('/admin/inventory')}
        />
      </div>

      {/* Alerts */}
      {data.summary.lowStockAlerts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-900 mb-2">System Alerts</h3>
              <div className="space-y-1.5">
                <p className="text-sm text-amber-800"><span className="font-medium">Inventory:</span> {data.summary.lowStockAlerts} product{data.summary.lowStockAlerts === 1 ? '' : 's'} need attention.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Patients */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Patients</h2>
            <button
              onClick={() => setLocation('/admin/patients')}
              className="text-xs font-medium text-primary hover:underline"
              data-testid="link-view-all-patients"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-border">
            {data.recentPatientRegistrations && data.recentPatientRegistrations.length > 0 ? (
              data.recentPatientRegistrations.map(patient => (
                <button
                  key={patient.id}
                  onClick={() => setLocation(`/admin/patients/${patient.id}`)}
                  className="w-full px-5 py-3 hover:bg-muted/50 transition-colors text-left"
                  data-testid={`patient-row-${patient.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{patient.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{patient.email}</p>
                    </div>
                    <StatusBadge status={patient.status} />
                  </div>
                </button>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No recent patients
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Upcoming Appointments</h2>
            <button
              onClick={() => setLocation('/admin/appointments')}
              className="text-xs font-medium text-primary hover:underline"
              data-testid="link-view-all-appointments"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-border">
            {data.recentAppointments && data.recentAppointments.length > 0 ? (
              data.recentAppointments.map(apt => (
                <div
                  key={apt.id}
                  className="px-5 py-3"
                  data-testid={`appointment-row-${apt.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{apt.patientName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {apt.doctorName} · {apt.appointmentDate} at {apt.appointmentTime}
                      </p>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No upcoming appointments
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Medical Store Orders</h2>
          <button onClick={() => setLocation('/admin/inventory')} className="text-xs font-medium text-primary hover:underline">View inventory</button>
        </div>
        <div className="divide-y divide-border">
          {data.recentOrders?.length ? data.recentOrders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-medium">{order.orderNo}</p>
                <p className="text-xs text-muted-foreground">{order.patientName} · {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">₱{Number(order.total).toLocaleString()}</p>
                <StatusBadge status={order.status} />
              </div>
            </div>
          )) : <p className="px-5 py-8 text-sm text-muted-foreground">No recent store orders.</p>}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  variant?: 'default' | 'warning';
  onClick?: () => void;
}

function MetricCard({ icon, label, value, trend, variant = 'default', onClick }: MetricCardProps) {
  const isWarning = variant === 'warning';
  
  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all text-left group"
      data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          isWarning ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
        }`}>
          {icon}
        </div>
        <TrendingUp className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground mb-1">{value}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-xs font-medium ${isWarning ? 'text-amber-700' : 'text-primary'}`}>
          {trend}
        </p>
      </div>
    </button>
  );
}
