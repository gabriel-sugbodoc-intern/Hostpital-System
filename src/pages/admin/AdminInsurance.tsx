import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Shield, CheckCircle2, XCircle, Search, RefreshCw, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import StatusBadge from '@/components/portal/admin/StatusBadge';

type InsuranceRequest = {
  id: string;
  userId: string;
  patientName: string;
  patientEmail: string;
  planName: string;
  provider: string;
  policyNumber: string;
  status: string;
  premiumAmount: string;
  coverageLimit: string;
  createdAt: string;
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'rejected', label: 'Declined' },
];

export default function AdminInsurance() {
  const [requests, setRequests] = useState<InsuranceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    const result = await apiClient.getAdminInsuranceRequests?.();
    if (result?.data) {
      setRequests((result.data as any).requests ?? []);
    } else if (result?.error) {
      toast.error(result.error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id);
    const result = await apiClient.updateAdminInsuranceRequest?.(id, action);
    setProcessing(null);
    if (result?.error) { toast.error(result.error); return; }
    toast.success(action === 'approve' ? 'Insurance policy approved and activated.' : 'Insurance policy declined.');
    setRequests(prev =>
      prev.map(r => r.id === id ? { ...r, status: action === 'approve' ? 'active' : 'rejected' } : r)
    );
  };

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status.toLowerCase() !== statusFilter) return false;
    if (search) {
      const hay = `${r.patientName} ${r.patientEmail ?? ''} ${r.policyNumber} ${r.planName}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Insurance Requests</h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                <Clock className="w-3 h-3" />
                {pendingCount} pending
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Review and action patient insurance policy requests.</p>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search patient, plan, policy…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === f.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">
            {search || statusFilter !== 'all'
              ? 'No requests match your filters.'
              : 'No insurance requests yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <div
              key={req.id}
              className={`bg-card border rounded-xl p-5 transition-shadow hover:shadow-sm ${
                req.status === 'pending'
                  ? 'border-amber-200 dark:border-amber-800/50'
                  : 'border-border'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Patient + Plan info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-semibold text-foreground">{req.patientName}</span>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">{req.patientEmail}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                    <LabelValue label="Plan" value={req.planName} />
                    <LabelValue label="Provider" value={req.provider} />
                    <LabelValue label="Policy #" value={req.policyNumber} mono />
                    <LabelValue label="Premium" value={`₱${Number(req.premiumAmount).toLocaleString('en-PH')}`} />
                    <LabelValue label="Coverage Limit" value={`₱${Number(req.coverageLimit).toLocaleString('en-PH')}`} />
                    <LabelValue label="Requested" value={new Date(req.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })} />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0 self-center sm:self-start sm:mt-1">
                  {req.status === 'pending' && (
                    <>
                      <button
                        disabled={processing === req.id}
                        onClick={() => handleAction(req.id, 'approve')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        disabled={processing === req.id}
                        onClick={() => handleAction(req.id, 'reject')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Decline
                      </button>
                    </>
                  )}
                  {req.status === 'active' && (
                    <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium">
                      <CheckCircle2 className="w-5 h-5" /> Active
                    </span>
                  )}
                  {req.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                      <XCircle className="w-5 h-5" /> Declined
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelValue({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground block">{label}</span>
      <span className={`font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
