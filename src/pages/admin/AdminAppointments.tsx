import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Filter, ChevronDown, CheckCircle2, XCircle, UserCheck, Eye, ShieldCheck, ShieldAlert } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import SearchFilter from '@/components/portal/admin/SearchFilter';
import StatusBadge from '@/components/portal/admin/StatusBadge';
import { usePortalBase } from '@/lib/portal-base';
import { Link } from '@/lib/router-compat';

type Appointment = {
  id: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  status: string;
  notes?: string;
};

export default function AdminAppointments() {
  const portalBase = usePortalBase();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    apiClient.getAdminAppointments?.({ 
      search: searchQuery, 
      status: statusFilter !== 'all' ? statusFilter : undefined,
      department: departmentFilter !== 'all' ? departmentFilter : undefined,
    })
      .then(({ data, error }) => {
        if (error) {
          toast.error(error);
        } else if (data) {
          setAppointments((data as any).appointments || []);
        }
      })
      .finally(() => setIsLoading(false));
  }, [searchQuery, statusFilter, departmentFilter]);

  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = !searchQuery || 
      apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.patientId.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  const departments = Array.from(new Set(appointments.map(a => a.department)));
  const updateStatus = async (appointment: Appointment, status: string) => {
    setUpdatingId(appointment.id);
    const result = await apiClient.updateAdminAppointmentStatus(appointment.id, status);
    setUpdatingId(null);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Could not update appointment.');
      return;
    }
    setAppointments(current => current.map(item => item.id === appointment.id ? { ...item, status } : item));
    if (status === 'Confirmed') {
      toast.success('Appointment confirmed! Doctor authorization to access patient records and messaging is now active.');
    } else if (status === 'Cancelled' || status === 'Rejected') {
      toast.info(`Appointment status updated to ${status}. Access permissions updated.`);
    } else {
      toast.success(`Appointment status updated to ${status}`);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-up" id="admin-appointments-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" />
          Appointments & Doctor Authorizations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''} found. Confirming a pending appointment authorizes the doctor to access patient records, encounter history, and messaging.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchFilter
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by patient, doctor, or ID..."
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-status-filter"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Confirmation</option>
            <option value="confirmed">Confirmed (Authorized)</option>
            <option value="checked in">Checked In</option>
            <option value="waiting">Waiting</option>
            <option value="in progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-department-filter"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="font-medium text-foreground">No appointments found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Date & Time</th>
                  <th className="px-5 py-3 text-left font-medium">Patient</th>
                  <th className="px-5 py-3 text-left font-medium">Doctor</th>
                  <th className="px-5 py-3 text-left font-medium">Department</th>
                  <th className="px-5 py-3 text-left font-medium">Status & Access</th>
                  <th className="px-5 py-3 text-left font-medium">Actions</th>
                  <th className="px-5 py-3 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAppointments.map(apt => {
                  const isPending = apt.status === 'Pending';
                  const isConfirmed = ['Confirmed', 'Checked In', 'Waiting', 'In Progress', 'Completed'].includes(apt.status);

                  return (
                    <tr
                      key={apt.id}
                      className="hover:bg-muted/30 transition-colors"
                      data-testid={`appointment-row-${apt.id}`}
                    >
                      <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">
                        <div>{apt.date}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{apt.time}</div>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          to={`${portalBase}/patients/${apt.patientId}` as any}
                          className="font-medium text-primary hover:underline flex items-center gap-1.5"
                        >
                          {apt.patientName}
                          <Eye className="w-3.5 h-3.5 opacity-60" />
                        </Link>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          ID: {apt.patientId.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-foreground font-medium">{apt.doctorName}</td>
                      <td className="px-5 py-3 text-muted-foreground">{apt.department}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            disabled={updatingId === apt.id}
                            value={apt.status}
                            onChange={event => updateStatus(apt, event.target.value)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                              isPending
                                ? 'border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : isConfirmed
                                ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'border-input bg-background text-foreground'
                            }`}
                          >
                            {['Pending', 'Confirmed', 'Checked In', 'Waiting', 'In Progress', 'Completed', 'Cancelled', 'No Show', 'Rescheduled'].map(status => (
                              <option key={`desktop-${apt.id}-${status}`} value={status}>{status}</option>
                            ))}
                          </select>
                          {isConfirmed ? (
                            <span className="inline-flex items-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium" title="Doctor authorized for medical records & messaging">
                              <ShieldCheck className="w-3.5 h-3.5 mr-0.5" />
                              Authorized
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center text-[11px] text-amber-600 dark:text-amber-400 font-medium" title="Records locked until confirmed">
                              <ShieldAlert className="w-3.5 h-3.5 mr-0.5" />
                              Pending
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {isPending && (
                            <button
                              disabled={updatingId === apt.id}
                              onClick={() => updateStatus(apt, 'Confirmed')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                              title="Confirm appointment and unlock doctor access to records"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirm
                            </button>
                          )}
                          {isPending && (
                            <button
                              disabled={updatingId === apt.id}
                              onClick={() => updateStatus(apt, 'Cancelled')}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 rounded-md transition-colors disabled:opacity-50"
                              title="Decline appointment"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Decline
                            </button>
                          )}
                          {!isPending && (
                            <Link
                              to={`${portalBase}/patients/${apt.patientId}` as any}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded-md hover:bg-muted text-foreground transition-colors"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-primary" />
                              View Records
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground max-w-xs truncate">
                        {apt.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-border">
            {filteredAppointments.map(apt => {
              const isPending = apt.status === 'Pending';
              const isConfirmed = ['Confirmed', 'Checked In', 'Waiting', 'In Progress', 'Completed'].includes(apt.status);

              return (
                <div key={apt.id} className="px-4 py-4" data-testid={`appointment-card-${apt.id}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <Link
                        to={`${portalBase}/patients/${apt.patientId}` as any}
                        className="font-semibold text-primary hover:underline text-base"
                      >
                        {apt.patientName}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{apt.doctorName}</p>
                    </div>
                    <select
                      disabled={updatingId === apt.id}
                      value={apt.status}
                      onChange={event => updateStatus(apt, event.target.value)}
                      className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                        isPending
                          ? 'border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : isConfirmed
                          ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-input bg-background text-foreground'
                      }`}
                    >
                      {['Pending', 'Confirmed', 'Checked In', 'Waiting', 'In Progress', 'Completed', 'Cancelled', 'No Show', 'Rescheduled'].map(status => (
                        <option key={`mobile-${apt.id}-${status}`} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1 mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>{apt.date} at {apt.time}</span>
                    </div>
                    <div>{apt.department}</div>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <button
                        disabled={updatingId === apt.id}
                        onClick={() => updateStatus(apt, 'Confirmed')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm & Authorize
                      </button>
                      <button
                        disabled={updatingId === apt.id}
                        onClick={() => updateStatus(apt, 'Cancelled')}
                        className="inline-flex items-center justify-center gap-1 py-1.5 px-3 text-xs font-medium border border-border text-muted-foreground hover:text-destructive rounded-lg transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Decline
                      </button>
                    </div>
                  )}

                  {apt.notes && (
                    <button
                      onClick={() => setExpandedId(expandedId === apt.id ? null : apt.id)}
                      className="mt-3 flex items-center gap-1 text-xs text-primary font-medium"
                    >
                      <span>Notes</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${expandedId === apt.id ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {expandedId === apt.id && apt.notes && (
                    <p className="mt-2 text-xs text-foreground bg-muted/50 p-3 rounded-lg">
                      {apt.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
