import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ListOrdered, Clock, RefreshCw, CircleDot, CheckCircle2, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import StatusBadge from '@/components/portal/admin/StatusBadge';
import SearchFilter from '@/components/portal/admin/SearchFilter';

type QueueEntry = {
  id: string;
  queueNumber: string;
  patientName: string;
  patientId: string;
  department: string;
  doctorName?: string;
  status: string;
  estimatedWaitMinutes?: number;
  checkedInAt: string;
  joinedAt: string;
};

export default function AdminQueue() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchQueue = () => {
    setIsLoading(true);
    apiClient.getAdminQueue?.({ search, department: department === 'all' ? undefined : department, status: status === 'all' ? undefined : status })
      .then(({ data, error }) => {
        if (error) {
          toast.error(error);
        } else if (data) {
          setQueue((data as any).queue || []);
          setLastRefresh(new Date());
        }
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [search, department, status]);

  const queueByStatus = {
    waiting: queue.filter(q => q.status.toLowerCase() === 'waiting'),
    serving: queue.filter(q => q.status.toLowerCase().includes('serving')),
    completed: queue.filter(q => q.status.toLowerCase() === 'completed'),
  };
  const updateStatus = async (entry: QueueEntry, nextStatus: string) => {
    setUpdatingId(entry.id);
    const result = await apiClient.updateAdminQueueStatus(entry.id, nextStatus);
    setUpdatingId(null);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Could not update queue status.');
      return;
    }
    setQueue(current => current.map(item => item.id === entry.id ? { ...item, status: nextStatus } : item));
    toast.success('Queue status updated');
  };

  return (
      <div className="space-y-6 animate-in slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-primary" />
            Queue Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {queue.length} patient{queue.length !== 1 ? 's' : ''} in queue
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchQueue}
            disabled={isLoading}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchFilter value={search} onChange={setSearch} placeholder="Search queue number, patient, or doctor..." className="flex-1" />
        <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="all">All departments</option>
          {[...new Set(queue.map((entry) => entry.department))].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          <option value="Waiting">Waiting</option>
          <option value="Now Serving">Now Serving</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Queue Sections */}
      <div className="space-y-6">
        {/* Now Serving */}
        {queueByStatus.serving.length > 0 && (
          <QueueSection
            title="Now Serving"
            icon={<CircleDot className="h-4 w-4 text-primary" />}
            entries={queueByStatus.serving}
            variant="primary"
            onStatusChange={updateStatus}
          />
        )}

        {/* Waiting */}
        <QueueSection
          title="Waiting"
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          entries={queueByStatus.waiting}
           variant="waiting"
           onStatusChange={updateStatus}
        />

        {/* Recently Completed */}
        {queueByStatus.completed.length > 0 && (
          <QueueSection
            title="Recently Completed"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            entries={queueByStatus.completed.slice(0, 5)}
            variant="completed"
            onStatusChange={updateStatus}
          />
        )}
      </div>

      {isLoading && queue.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </div>
      )}

      {!isLoading && queue.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ListOrdered className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="font-medium text-foreground">Queue is empty</p>
          <p className="text-sm text-muted-foreground mt-1">
            No patients are currently in the queue
          </p>
        </div>
      )}
    </div>
  );
}

interface QueueSectionProps {
  title: string;
  icon: React.ReactNode;
  entries: QueueEntry[];
  variant: 'primary' | 'waiting' | 'completed';
  onStatusChange: (entry: QueueEntry, status: string) => void;
}

function QueueSection({ title, icon, entries, variant, onStatusChange }: QueueSectionProps) {
  if (entries.length === 0) return null;

  const bgClass = {
    primary: 'bg-primary/5 border-primary/20',
    waiting: 'bg-amber-50 border-amber-200',
    completed: 'bg-gray-50 border-gray-200',
  }[variant];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">({entries.length})</span>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Queue #</th>
                <th className="px-5 py-3 text-left font-medium">Patient</th>
                <th className="px-5 py-3 text-left font-medium">Department</th>
                <th className="px-5 py-3 text-left font-medium">Doctor</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Wait Time</th>
                <th className="px-5 py-3 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(entry => (
                <tr
                  key={entry.id}
                  className="hover:bg-muted/30 transition-colors"
                  data-testid={`queue-row-${entry.id}`}
                >
                  <td className="px-5 py-3">
                    <span className="font-bold text-lg text-primary font-mono">
                      {entry.queueNumber}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">{entry.patientName}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {entry.patientId.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{entry.department}</td>
                  <td className="px-5 py-3 text-foreground">{entry.doctorName || 'Unassigned'}</td>
                  <td className="px-5 py-3">
                    <select value={entry.status} onChange={event => onStatusChange(entry, event.target.value)} className="rounded-lg border border-input bg-background px-2 py-1 text-xs font-medium">
                      {['Waiting', 'Now Serving', 'Completed', 'Cancelled'].map(status => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    {entry.estimatedWaitMinutes != null ? (
                      <span className="text-foreground font-medium">
                        ~{entry.estimatedWaitMinutes} min
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {new Date(entry.joinedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-border">
          {entries.map(entry => (
            <div key={entry.id} className="px-4 py-4" data-testid={`queue-card-${entry.id}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-2xl text-primary font-mono">
                    {entry.queueNumber}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{entry.patientName}</p>
                    <p className="text-xs text-muted-foreground">{entry.department}</p>
                  </div>
                </div>
                 <select value={entry.status} onChange={event => onStatusChange(entry, event.target.value)} className="rounded-lg border border-input bg-background px-2 py-1 text-xs font-medium">
                   {['Waiting', 'Now Serving', 'Completed', 'Cancelled'].map(status => <option key={status}>{status}</option>)}
                 </select>
              </div>
              <div className="text-xs text-muted-foreground space-y-1 ml-11">
                <div>Doctor: {entry.doctorName || 'Unassigned'}</div>
                <div className="flex items-center gap-3">
                  {entry.estimatedWaitMinutes != null && (
                    <span className="font-medium text-foreground">
                      Wait: ~{entry.estimatedWaitMinutes} min
                    </span>
                  )}
                  <span>Joined: {new Date(entry.joinedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
