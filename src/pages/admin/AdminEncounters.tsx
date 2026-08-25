import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from '@/lib/router-compat';
import { toast } from 'sonner';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileJson,
  Pencil,
  Save,
  Calendar,
  User,
  Stethoscope,
  FileText,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import StatusBadge from '@/components/portal/admin/StatusBadge';
import { usePortalBase } from '@/lib/portal-base';

type Encounter = {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  doctor: string;
  doctorId?: string;
  appointmentId?: string;
  department?: string;
  specialty?: string;
  chiefComplaint?: string;
  complaint?: string;
  diagnosis?: string;
  summary?: string;
  historyOfPresentIllness?: string;
  treatmentProvided?: string;
  followUpRecommendations?: string;
  encounterNotes?: string;
  status?: string;
  createdAt: string;
};

export default function AdminEncounters() {
  const portalBase = usePortalBase();
  const [location, setLocation] = useLocation();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'patient' | 'doctor'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const urlParams = useMemo(() => new URLSearchParams(location.split('?')[1] || ''), [location]);
  const patientIdFromUrl = urlParams.get('patientId');

  const currentUser = (() => {
    try {
      const raw = localStorage.getItem('sugbodoc_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const isDoctor = currentUser?.role === 'doctor' && portalBase === '/doctor';

  useEffect(() => {
    loadEncounters();
  }, [searchQuery, filterDoctor, filterDepartment, filterDateFrom, filterDateTo, sortBy, sortDir, page, patientIdFromUrl]);

  const loadEncounters = async () => {
    setIsLoading(true);
    const params: any = {
      search: searchQuery || undefined,
      doctor: filterDoctor || undefined,
      department: filterDepartment || undefined,
      dateFrom: filterDateFrom || undefined,
      dateTo: filterDateTo || undefined,
      sortBy,
      sortDir,
      page,
      limit,
      patientId: patientIdFromUrl || undefined,
    };

    const result = await apiClient.getAdminEncounters?.(params);
    if (result.error) {
      toast.error(result.error);
      setEncounters([]);
    } else if (result.data) {
      const rawEncounters = result.data.encounters ?? [];
      setEncounters(rawEncounters.map((enc: any) => ({
        id: enc.id,
        patientId: enc.patientId,
        patientName: enc.patientName ?? enc.patient?.name ?? 'Unknown Patient',
        date: enc.date ?? enc.encounterDate ?? enc.createdAt,
        doctor: enc.doctor ?? enc.physician ?? 'Provider unavailable',
        doctorId: enc.doctorId ?? enc.doctor_id,
        appointmentId: enc.appointmentId ?? enc.appointment_id,
        department: enc.department,
        specialty: enc.specialty,
        chiefComplaint: enc.chiefComplaint,
        complaint: enc.complaint,
        diagnosis: enc.diagnosis,
        summary: enc.summary,
        historyOfPresentIllness: enc.historyOfPresentIllness,
        treatmentProvided: enc.treatmentProvided,
        followUpRecommendations: enc.followUpRecommendations,
        encounterNotes: enc.encounterNotes,
        status: enc.status,
        createdAt: enc.createdAt,
      })));
      setTotal(result.data.total ?? rawEncounters.length);
    }
    setIsLoading(false);
  };

  const openDetail = async (encounter: Encounter) => {
    setSelectedEncounter(encounter);
    setLoadingDetail(true);
    const result = await apiClient.getAdminEncounter?.(encounter.id);
    if (result.error) {
      toast.error(result.error);
      setDetailData(null);
    } else {
      setDetailData(result.data?.encounter ?? null);
      const encounterData = result.data?.encounter ?? encounter;
      setEditDraft({
        chiefComplaint: encounterData.chiefComplaint ?? encounterData.complaint ?? '',
        historyOfPresentIllness: encounterData.historyOfPresentIllness ?? '',
        diagnosis: encounterData.diagnosis ?? encounterData.summary ?? '',
        treatmentProvided: encounterData.treatmentProvided ?? '',
        followUpRecommendations: encounterData.followUpRecommendations ?? '',
        encounterNotes: encounterData.encounterNotes ?? '',
        status: encounterData.status ?? 'Completed',
      });
    }
    setLoadingDetail(false);
  };

  const closeDetail = () => {
    setSelectedEncounter(null);
    setDetailData(null);
    setEditing(false);
    setEditDraft({});
  };

  const saveEdit = async () => {
    if (!selectedEncounter) return;
    setSavingEdit(true);
    const result = await apiClient.updateAdminEncounter(selectedEncounter.id, editDraft);
    setSavingEdit(false);
    if (result.error || !result.data) {
      toast.error(result.error ?? 'Could not save encounter.');
      return;
    }
    const updated = result.data.encounter;
    setDetailData(updated);
    setSelectedEncounter(current => current ? { ...current, ...updated } : current);
    setEncounters(current => current.map(item => item.id === selectedEncounter.id ? { ...item, ...updated } : item));
    setEditing(false);
    toast.success('Encounter updated.');
  };

  const printSummary = () => {
    if (!selectedEncounter) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }
    const enc = detailData ?? selectedEncounter;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Encounter Summary - ${enc.patientName}</title>
        <style>
          body { font-family: sans-serif; margin: 2rem; line-height: 1.6; }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
          h2 { font-size: 1.1rem; margin-top: 1.5rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
          .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
          .field { margin-bottom: 1rem; }
          .label { font-weight: bold; color: #333; }
          .value { margin-top: 0.25rem; }
        </style>
      </head>
      <body>
        <h1>Encounter Summary</h1>
        <div class="meta">
          <div>Patient: ${enc.patientName} (ID: ${enc.patientId})</div>
          <div>Date: ${enc.date}</div>
          <div>Provider: ${enc.doctor}</div>
          ${enc.department ? `<div>Department: ${enc.department}</div>` : ''}
        </div>
        ${enc.chiefComplaint || enc.complaint ? `<h2>Chief Complaint</h2><div>${enc.chiefComplaint ?? enc.complaint}</div>` : ''}
        ${enc.historyOfPresentIllness ? `<h2>History of Present Illness</h2><div>${enc.historyOfPresentIllness}</div>` : ''}
        ${enc.diagnosis ? `<h2>Diagnosis</h2><div>${enc.diagnosis}</div>` : ''}
        ${enc.treatmentProvided ? `<h2>Treatment Provided</h2><div>${enc.treatmentProvided}</div>` : ''}
        ${enc.followUpRecommendations ? `<h2>Follow-Up Recommendations</h2><div>${enc.followUpRecommendations}</div>` : ''}
        ${enc.encounterNotes ? `<h2>Encounter Notes</h2><div>${enc.encounterNotes}</div>` : ''}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const downloadJson = () => {
    if (!selectedEncounter) return;
    const data = detailData ?? selectedEncounter;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `encounter-${selectedEncounter.id}-${new Date().toISOString().split('T')[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterDoctor('');
    setFilterDepartment('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const toggleSort = (field: 'date' | 'patient' | 'doctor') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const doctors = useMemo(() => {
    const set = new Set(encounters.map(e => e.doctor).filter(Boolean));
    return Array.from(set).sort();
  }, [encounters]);

  const departments = useMemo(() => {
    const set = new Set(encounters.map(e => e.department).filter(Boolean));
    return Array.from(set).sort();
  }, [encounters]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Patient Encounters</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} encounter{total === 1 ? '' : 's'} across all patients
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by patient name, complaint, diagnosis..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm"
            />
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg bg-background text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Doctor</label>
            <select
              value={filterDoctor}
              onChange={(e) => { setFilterDoctor(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
            >
              <option value="">All Doctors</option>
              {doctors.map(doc => <option key={doc} value={doc}>{doc}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Department</label>
            <select
              value={filterDepartment}
              onChange={(e) => { setFilterDepartment(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
            >
              <option value="">All Departments</option>
              {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-sm text-muted-foreground">Loading encounters...</p>
          </div>
        ) : encounters.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-25" />
            <p className="text-muted-foreground">No encounters found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3">
                      <button onClick={() => toggleSort('date')} className="flex items-center gap-1 hover:text-foreground">
                        Date
                        {sortBy === 'date' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button onClick={() => toggleSort('patient')} className="flex items-center gap-1 hover:text-foreground">
                        Patient
                        {sortBy === 'patient' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button onClick={() => toggleSort('doctor')} className="flex items-center gap-1 hover:text-foreground">
                        Provider
                        {sortBy === 'doctor' ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Chief Complaint</th>
                    <th className="px-4 py-3">Diagnosis</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {encounters.map(encounter => (
                    <tr key={encounter.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{encounter.date}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setLocation(`${portalBase}/patients/${encounter.patientId}`)}
                          className="text-primary hover:underline font-medium"
                        >
                          {encounter.patientName}
                        </button>
                      </td>
                      <td className="px-4 py-3">{encounter.doctor}</td>
                      <td className="px-4 py-3">{encounter.department ?? encounter.specialty ?? '—'}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{encounter.chiefComplaint ?? encounter.complaint ?? '—'}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{encounter.diagnosis ?? encounter.summary ?? '—'}</td>
                      <td className="px-4 py-3">
                        {encounter.status ? <StatusBadge status={encounter.status} /> : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openDetail(encounter)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({total} total)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-input rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 border border-input rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEncounter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Encounter detail">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border bg-card shadow-xl">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Encounter Details</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedEncounter.patientName} · {selectedEncounter.date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={printSummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                {isDoctor && (
                  <button
                    onClick={() => setEditing(value => !value)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {editing ? 'Cancel edit' : 'Edit'}
                  </button>
                )}
                <button
                  onClick={downloadJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-xs font-medium hover:bg-muted transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  JSON
                </button>
                <button onClick={closeDetail} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {loadingDetail ? (
                <div className="py-12 text-center">
                  <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-3 text-sm text-muted-foreground">Loading details...</p>
                </div>
              ) : (
                <>
                  {!isDoctor && (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 text-xs font-medium shadow-sm">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span><strong>Read-Only Mode:</strong> Encounter modification is restricted exclusively to authorized doctors. Admins have read-only access.</span>
                    </div>
                  )}

                  <DetailSection title="Encounter & System Linkage" icon={<User className="w-4 h-4" />}>
                    <DetailRow label="Encounter ID" value={selectedEncounter.id} />
                    <DetailRow label="Patient ID" value={selectedEncounter.patientId} />
                    <DetailRow label="Patient Name" value={selectedEncounter.patientName} />
                    <DetailRow label="Appointment ID" value={selectedEncounter.appointmentId ? `#${selectedEncounter.appointmentId.slice(0, 8)}` : (detailData?.appointment_id ? `#${String(detailData.appointment_id).slice(0, 8)}` : 'Auto-linked')} />
                    <DetailRow label="Date & Time" value={selectedEncounter.date} />
                    <DetailRow label="Encounter Status" value={detailData?.status ?? selectedEncounter.status ?? 'Completed'} />
                  </DetailSection>

                  <DetailSection title="Provider Information" icon={<Stethoscope className="w-4 h-4" />}>
                    <DetailRow label="Provider Name" value={selectedEncounter.doctor} />
                    {selectedEncounter.doctorId && <DetailRow label="Doctor ID" value={selectedEncounter.doctorId} />}
                    <DetailRow label="Department" value={selectedEncounter.department ?? selectedEncounter.specialty ?? 'General Medicine'} />
                  </DetailSection>

                  <DetailSection title="Clinical Information" icon={<FileText className="w-4 h-4" />}>
                    {editing && isDoctor && (
                      <div className="mb-4 grid gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                        {[
                          ['chiefComplaint', 'Chief Complaint'],
                          ['historyOfPresentIllness', 'History of Present Illness'],
                          ['diagnosis', 'Diagnosis'],
                          ['treatmentProvided', 'Treatment Provided'],
                          ['followUpRecommendations', 'Follow-Up Recommendations'],
                          ['encounterNotes', 'Encounter Notes'],
                        ].map(([field, label]) => (
                          <label key={field} className="text-xs font-semibold text-muted-foreground">
                            {label}
                            <textarea
                              value={editDraft[field] ?? ''}
                              onChange={event => setEditDraft(current => ({ ...current, [field]: event.target.value }))}
                              rows={field === 'chiefComplaint' || field === 'diagnosis' ? 2 : 3}
                              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary"
                            />
                          </label>
                        ))}
                        <label className="text-xs font-semibold text-muted-foreground">
                          Encounter Status
                          <select value={editDraft.status ?? 'Completed'} onChange={event => setEditDraft(current => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-primary">
                            {['Pending', 'In Progress', 'Completed', 'Cancelled'].map(status => <option key={status}>{status}</option>)}
                          </select>
                        </label>
                        <button onClick={saveEdit} disabled={savingEdit} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                          <Save className="h-4 w-4" />
                          {savingEdit ? 'Saving...' : 'Save encounter'}
                        </button>
                      </div>
                    )}
                    {(detailData?.chiefComplaint ?? selectedEncounter.chiefComplaint ?? detailData?.complaint ?? selectedEncounter.complaint) && (
                      <DetailRow 
                        label="Chief Complaint" 
                        value={detailData?.chiefComplaint ?? selectedEncounter.chiefComplaint ?? detailData?.complaint ?? selectedEncounter.complaint} 
                      />
                    )}
                    {(detailData?.historyOfPresentIllness ?? selectedEncounter.historyOfPresentIllness) && (
                      <DetailRow 
                        label="History of Present Illness" 
                        value={detailData?.historyOfPresentIllness ?? selectedEncounter.historyOfPresentIllness} 
                      />
                    )}
                    {(detailData?.diagnosis ?? selectedEncounter.diagnosis ?? detailData?.summary ?? selectedEncounter.summary) && (
                      <DetailRow 
                        label="Diagnosis" 
                        value={detailData?.diagnosis ?? selectedEncounter.diagnosis ?? detailData?.summary ?? selectedEncounter.summary} 
                      />
                    )}
                    {(detailData?.treatmentProvided ?? selectedEncounter.treatmentProvided) && (
                      <DetailRow 
                        label="Treatment Provided" 
                        value={detailData?.treatmentProvided ?? selectedEncounter.treatmentProvided} 
                      />
                    )}
                    {(detailData?.followUpRecommendations ?? selectedEncounter.followUpRecommendations) && (
                      <DetailRow 
                        label="Follow-Up Recommendations" 
                        value={detailData?.followUpRecommendations ?? selectedEncounter.followUpRecommendations} 
                      />
                    )}
                    {(detailData?.encounterNotes ?? selectedEncounter.encounterNotes) && (
                      <DetailRow 
                        label="Encounter Notes" 
                        value={detailData?.encounterNotes ?? selectedEncounter.encounterNotes} 
                      />
                    )}
                  </DetailSection>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <div className="text-primary">{icon}</div>
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      </div>
      <div className="space-y-2.5">
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm text-foreground col-span-2">{value}</span>
    </div>
  );
}
