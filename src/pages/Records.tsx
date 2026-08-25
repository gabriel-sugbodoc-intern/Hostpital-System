import React, { useState, useEffect } from 'react';
import { FileText, Activity, Pill, FlaskConical, Stethoscope, ClipboardList, FileCheck, Upload, ScanLine, ZoomIn, X, ImageOff, CalendarDays, FolderOpen, Award, Paperclip } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiClient } from '@/lib/api-client';
import { demoAppointmentHistory, demoMedicalCertificates, demoRecordDocuments, demoMedicalRecords, demoImagingRecords } from '@/lib/portal-demo-data';
type SoapNote = { id: string; date: string; doctor: string; text: string; fromDocument?: boolean; documentName?: string };

const TABS = [
  { id: 'encounters', label: 'Encounters', icon: Stethoscope },
  { id: 'vitals', label: 'Vitals', icon: Activity },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'labs', label: 'Lab Results', icon: FlaskConical },
  { id: 'imaging', label: 'Imaging', icon: ScanLine },
  { id: 'soap', label: 'SOAP Notes', icon: FileText },
  { id: 'diagnoses', label: 'Diagnoses', icon: ClipboardList },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'certificates', label: 'Certificates', icon: Award },
];

export default function Records() {
  const [activeTab, setActiveTab] = useState('encounters');
  const [isLoading, setIsLoading] = useState(true);
  const [allSoapNotes, setAllSoapNotes] = useState<SoapNote[]>([]);
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);
  const [reportDetail, setReportDetail] = useState<any | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    apiClient.getAccountData().then(({ data }) => {
      const rows = data?.records ?? [];
      setRecords(rows);
      setAppointments(data?.appointments ?? []);
    }).finally(() => setIsLoading(false));
  }, []); // fetch once on mount

  const encounterRows = records.filter(r => r.kind === 'encounter');
  const encounters = encounterRows.map(r => ({ ...r.data, id: r.id }));
  const scopedRows = selectedEncounterId
    ? records.filter(r => r.encounterRef === selectedEncounterId || (r.kind === 'encounter' && r.id === selectedEncounterId))
    : records;
  const scopedOf = (kind: string) => scopedRows.filter(r => r.kind === kind).map(r => ({ ...r.data, id: r.id }));
  const vitals = scopedOf('vital');
  const prescriptions = scopedOf('prescription');
  const labResults = scopedOf('lab');
  const imagingReports = scopedRows.filter(r => r.kind === 'imaging' || r.kind === 'recording').map(r => ({ ...r.data, id: r.id }));
  const diagnoses = scopedOf('diagnosis');
  const soapNotes = scopedOf('soap') as SoapNote[];
  const hasLiveRecords = records.length > 0;
  const displayEncounters = hasLiveRecords ? encounters : demoMedicalRecords.encounters;
  const displayVitals = hasLiveRecords ? vitals : demoMedicalRecords.vitals;
  const displayPrescriptions = hasLiveRecords ? prescriptions : demoMedicalRecords.prescriptions;
  const displayLabResults = hasLiveRecords ? labResults : demoMedicalRecords.labs;
  const displayDiagnoses = hasLiveRecords ? diagnoses : demoMedicalRecords.diagnoses;
  const displayImagingReports = hasLiveRecords ? imagingReports : demoImagingRecords.map(report => ({
    id: report.id,
    type: report.examinationName,
    date: report.examinationDate,
    orderedBy: report.orderingPhysician,
    facility: report.performingDepartment,
    status: report.status,
    findings: report.findingsSummary,
    impression: report.impression,
    recommendation: report.recommendation,
    reportGeneratedDate: report.reportGeneratedDate,
    images: report.images,
    demo: true,
  }));
  const displaySoapNotes = hasLiveRecords ? soapNotes : [];

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Medical Records</h1>
        <p className="text-sm text-muted-foreground">View your comprehensive health history.</p>
      </div>
      {displayEncounters.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-primary/15 bg-card p-4 sm:flex-row sm:items-center">
          <label htmlFor="patient-encounter" className="text-sm font-semibold text-foreground">View encounter</label>
          <select
            id="patient-encounter"
            value={selectedEncounterId ?? ""}
            onChange={(event) => setSelectedEncounterId(event.target.value || null)}
            className="min-h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All encounters</option>
            {encounters.map((enc: any) => (
              <option key={enc.id} value={enc.id}>
                {enc.date ?? enc.encounterDate ?? "Encounter"} · {enc.doctor ?? enc.provider ?? "Provider"} · {enc.specialty ?? enc.department ?? "Clinical care"}
              </option>
            ))}
          </select>
          {selectedEncounterId && <span className="text-xs text-muted-foreground">Showing linked records only</span>}
        </div>
      )}

      {/* ── TAB BAR — sticky, always visible ── */}
      <div className="sticky top-0 z-20 bg-background pt-1 pb-0">
        {/* Scrollable row */}
        <div className="flex overflow-x-auto scrollbar-none -mx-1 px-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap
                  transition-colors min-h-[44px] shrink-0 focus:outline-none
                  ${isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'}
                `}
              >
                <tab.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                <span>{tab.label}</span>
                {/* Active underline indicator */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
        {/* Full-width bottom border sitting below the indicator */}
        <div className="border-b border-border" />
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 pt-5 pb-10">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-48 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl" />
            <div className="h-24 bg-muted rounded-xl" />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* ── ENCOUNTERS ── */}
            {activeTab === 'encounters' && (
              <div className="space-y-4">
                {displayEncounters.map(enc => (
                  <div key={enc.id} className="bg-card p-5 rounded-xl border border-border shadow-sm">
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{enc.date}</h3>
                        <p className="text-primary font-medium text-sm">{enc.doctor}</p>
                        <p className="text-xs text-muted-foreground">{enc.specialty} · {enc.clinic}</p>
                      </div>
                         <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${enc.demo ? 'bg-accent text-primary border-primary/20' : 'bg-muted border-border'}`}>
                         {enc.demo ? 'Demo example' : 'Consultation'}
                      </span>
                    </div>
                    <div className="space-y-2 mt-4 text-sm">
                      <div className="flex flex-col sm:grid sm:grid-cols-4 gap-1">
                        <span className="text-muted-foreground sm:col-span-1 font-medium">Chief Complaint</span>
                        <span className="font-medium text-foreground sm:col-span-3">{enc.complaint}</span>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-4 gap-1">
                        <span className="text-muted-foreground sm:col-span-1 font-medium">Summary</span>
                        <span className="text-foreground sm:col-span-3">{enc.summary}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── VITALS ── */}
            {activeTab === 'vitals' && (
              <div className="space-y-6">
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                  <h3 className="font-semibold mb-1">Blood Pressure Trend</h3>
                  <p className="text-xs text-muted-foreground mb-6">Last 6 months (mmHg)</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={[...displayVitals].reverse()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                        <Line type="monotone" dataKey="systolic" stroke="#4A4FC4" strokeWidth={3} dot={{ r: 4, fill: '#4A4FC4' }} activeDot={{ r: 6 }} name="Systolic" />
                        <Line type="monotone" dataKey="diastolic" stroke="#3A3FA0" strokeWidth={3} dot={{ r: 4, fill: '#3A3FA0' }} name="Diastolic" strokeDasharray="5 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">BP (mmHg)</th>
                          <th className="px-4 py-3 font-medium">Heart Rate</th>
                          <th className="px-4 py-3 font-medium">Temp (°C)</th>
                          <th className="px-4 py-3 font-medium">Weight (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                         {displayVitals.map((v, i) => (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{v.date}</td>
                            <td className="px-4 py-3">{v.systolic}/{v.diastolic}</td>
                            <td className="px-4 py-3">{v.hr} bpm</td>
                            <td className="px-4 py-3">{v.temp}</td>
                            <td className="px-4 py-3">{v.weight}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── PRESCRIPTIONS ── */}
            {activeTab === 'prescriptions' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayPrescriptions.map(p => (
                  <div key={p.id} className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent text-primary flex items-center justify-center shrink-0">
                          <Pill className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-lg">{p.med}</h3>
                      </div>
                       <span className={`px-2 py-1 rounded-full text-xs font-medium border shrink-0 ${
                        p.status === 'Active' ? 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20' :
                        p.status === 'Completed' ? 'bg-muted text-muted-foreground border-border' :
                        'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
                      }`}>
                         {p.demo ? `Demo · ${p.status}` : p.status}
                      </span>
                    </div>
                    <div className="mt-auto pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Instructions</p>
                      <p className="text-sm text-foreground">{p.instruction}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── LAB RESULTS ── */}
            {activeTab === 'labs' && (
              <div className="space-y-3">
                {displayLabResults.map(l => (
                  <div key={l.id} className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-foreground">{l.test}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{l.date} · Ref: {l.range}</p>
                    </div>
                    <div className="flex items-center gap-4 sm:justify-end">
                      <div className="text-xl font-bold text-foreground">{l.value}</div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        l.status === 'Normal'
                          ? 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20'
                          : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
                      }`}>
                               {l.demo ? `Demo · ${l.status}` : l.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── IMAGING ── */}
            {activeTab === 'imaging' && (
              <div className="space-y-6">
                {displayImagingReports.map(report => (
                  <div key={report.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {/* Report header */}
                    <div className="p-5 border-b border-border">
                      <div className="flex flex-wrap justify-between items-start gap-3">
                        <div>
                          <button type="button" className="text-left" onClick={() => setReportDetail(report)}>
                            <h3 className="font-semibold text-lg text-foreground hover:text-primary">{report.type}</h3>
                          </button>
                          <p className="text-primary text-sm font-medium mt-0.5">{report.orderedBy}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{report.date} · {report.facility}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
                          report.status === 'Normal' || report.status === 'Completed'
                            ? 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20'
                            : report.status === 'Borderline' || report.status === 'Pending'
                            ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
                            : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
                        }`}>
                          {report.demo ? `Demo · ${report.status}` : report.status}
                        </span>
                      </div>
                    </div>

                    {/* Images loaded from account-owned record metadata and server storage. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
                      {(Array.isArray(report.images) ? report.images : []).map((image: any, index: number) => (
                        <div key={`${image.label}-${index}`} className="relative group overflow-hidden bg-muted/30 min-h-56">
                          {image.src ? (
                            <button type="button" className="w-full h-56 cursor-pointer" onClick={() => setLightbox({ src: image.src, title: `${report.type} — ${image.label}` })}>
                               <img src={image.src} alt={`${report.type} ${image.label}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"><span className="opacity-0 group-hover:opacity-100 bg-white/90 rounded-full p-2.5"><ZoomIn className="w-5 h-5 text-gray-800" /></span></span>
                              <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded font-medium">{image.label}</span>
                            </button>
                           ) : <div className="h-56 flex flex-col items-center justify-center text-muted-foreground"><ImageOff className="w-8 h-8 mb-2 opacity-50" /><span className="text-sm">Image unavailable</span><span className="text-xs mt-1">{image.label}</span></div>}
                        </div>
                      ))}
                      {(!Array.isArray(report.images) || report.images.length === 0) && <div className="sm:col-span-2 p-8 text-center text-muted-foreground"><ImageOff className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No recording images are available for this entry.</p></div>}
                    </div>

                    {/* Findings + Impression */}
                    <div className="p-5 space-y-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Findings</p>
                        <p className="text-foreground leading-relaxed">{report.findings}</p>
                      </div>
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Impression</p>
                        <p className="font-medium text-foreground">{report.impression}</p>
                      </div>
                      <div className="pt-3 border-t border-border flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setReportDetail(report)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">View Full Report</button>
                        <button type="button" disabled={!report.images?.[0]?.src} onClick={() => report.images?.[0]?.src && setLightbox({ src: report.images[0].src, title: `${report.type} — Demo image preview` })} className="rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">View Image</button>
                        <span className="text-xs text-muted-foreground">{report.demo ? 'Sample record · replaceable image provider' : `Report generated ${report.reportGeneratedDate ?? 'date unavailable'}`}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── SOAP NOTES ── */}
            {activeTab === 'soap' && (
              <div className="space-y-4">
                {/* Info banner about document uploads */}
                <div className="flex items-start gap-3 p-4 bg-accent rounded-xl border border-primary/20 text-sm">
                  <Upload className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-foreground">
                    Send a document (lab result, prescription, imaging report) to your doctor via{' '}
                    <span className="font-semibold text-primary">Messages</span> and a SOAP note will be automatically generated and appear here.
                  </p>
                </div>

                {displaySoapNotes.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-25" />
                    <p className="font-medium">No SOAP notes yet</p>
                    <p className="text-sm mt-1">Upload a document in Messages to generate one.</p>
                  </div>
                ) : (
                  displaySoapNotes.map(s => {
                    const parts = s.text.split(' / ');
                    return (
                      <div key={s.id} className="bg-card p-5 rounded-xl border border-border shadow-sm">
                        <div className="flex flex-wrap justify-between items-start gap-2 mb-4 pb-3 border-b border-border">
                          <div>
                            <span className="font-semibold text-foreground">{s.date}</span>
                            <p className="text-primary text-sm font-medium mt-0.5">{s.doctor}</p>
                          </div>
                          {s.fromDocument && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                              <FileCheck className="w-3.5 h-3.5" />
                              Generated from document
                            </div>
                          )}
                        </div>
                        {s.fromDocument && s.documentName && (
                          <p className="text-xs text-muted-foreground mb-3 italic">Source: {s.documentName}</p>
                        )}
                        <div className="space-y-3 text-sm">
                          {parts.map((part, i) => {
                            const colonIdx = part.indexOf(': ');
                            if (colonIdx === -1) return null;
                            const letter = part.slice(0, colonIdx);
                            const content = part.slice(colonIdx + 2);
                            const labelMap: Record<string, string> = {
                              S: 'Subjective',
                              O: 'Objective',
                              A: 'Assessment',
                              P: 'Plan'
                            };
                            return (
                              <div key={i} className="flex gap-3">
                                <div className="flex flex-col items-center shrink-0 w-20">
                                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">{letter}</span>
                                  <span className="text-[10px] text-muted-foreground mt-0.5">{labelMap[letter] ?? ''}</span>
                                </div>
                                <p className="text-foreground leading-relaxed pt-1">{content}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── DIAGNOSES ── */}
            {activeTab === 'diagnoses' && (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 font-medium">ICD Code</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {displayDiagnoses.map((d, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.code}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{d.desc}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.date}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                              d.status === 'Resolved'
                                ? 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20'
                                : 'bg-primary/10 text-primary border-primary/20'
                            }`}>
                               {d.demo ? `Demo · ${d.status}` : d.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'appointments' && (
              <div className="space-y-3">
                {appointments.length > 0 ? appointments.map((appointment: any) => (
                  <div key={appointment.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold">{appointment.appointmentDate} · {appointment.appointmentTime}</p>
                      <p className="text-sm text-primary mt-1">{appointment.doctorName} · {appointment.specialty}</p>
                      <p className="text-xs text-muted-foreground mt-1">{appointment.clinic}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-muted text-muted-foreground border-border">{appointment.status}</span>
                  </div>
                )) : demoAppointmentHistory.map(appointment => (
                  <div key={appointment.id} className="bg-card border border-dashed border-primary/30 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-semibold">{appointment.date} · {appointment.time}</p>
                      <p className="text-sm text-primary mt-1">{appointment.doctor} · {appointment.specialty}</p>
                      <p className="text-xs text-muted-foreground mt-1">{appointment.clinic}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-accent text-primary border-primary/20">Demo example · {appointment.status}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'documents' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {demoRecordDocuments.map(document => (
                  <div key={document.id} className="bg-card border border-dashed border-primary/30 rounded-xl p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent text-primary flex items-center justify-center"><Paperclip className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{document.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{document.type} · {document.date}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">{document.description}</p>
                    <span className="inline-block mt-4 text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">Placeholder attachment</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'certificates' && (
              <div className="space-y-4">
                {demoMedicalCertificates.map(certificate => (
                  <div key={certificate.id} className="bg-card border border-dashed border-primary/30 rounded-xl p-5 shadow-sm flex items-start gap-4">
                    <div className="w-11 h-11 rounded-full bg-accent text-primary flex items-center justify-center shrink-0"><Award className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><h3 className="font-semibold">{certificate.title}</h3><p className="text-sm text-primary mt-1">{certificate.purpose}</p></div>
                        <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">{certificate.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">Issued by {certificate.issuedBy} · {certificate.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <p className="text-white/70 text-sm text-center mb-3">{lightbox.title}</p>
            <img
              src={lightbox.src}
              alt={lightbox.title}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
      {reportDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setReportDetail(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-primary font-semibold">Diagnostic Imaging Report</p>
                <h2 className="text-xl font-bold mt-1">{reportDetail.type}</h2>
              </div>
              <button type="button" onClick={() => setReportDetail(null)} className="p-2 rounded-full hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm">
              <p><span className="text-muted-foreground">Examination date:</span> {reportDetail.date}</p>
              <p><span className="text-muted-foreground">Ordering physician:</span> {reportDetail.orderedBy}</p>
              <p><span className="text-muted-foreground">Performing department:</span> {reportDetail.facility}</p>
              <p><span className="text-muted-foreground">Status:</span> {reportDetail.status}</p>
              <p className="sm:col-span-2"><span className="text-muted-foreground">Report generated:</span> {reportDetail.reportGeneratedDate ?? 'Not available'}</p>
            </div>
            <div className="space-y-4 mt-6 text-sm">
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Findings Summary</p><p>{reportDetail.findings}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Impression</p><p className="font-medium">{reportDetail.impression}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Recommendation</p><p>{reportDetail.recommendation ?? 'Follow the ordering physician’s care plan.'}</p></div>
            </div>
            {reportDetail.demo && <div className="mt-6 rounded-lg bg-accent border border-primary/20 p-3 text-xs text-primary">This is a demonstration report. Placeholder images and findings are not for clinical diagnosis.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
