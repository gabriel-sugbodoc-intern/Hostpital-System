import React, { useEffect, useState } from 'react';
import { useLocation } from '@/lib/router-compat';
import { Calendar, MessageSquare, CreditCard, FileText, ChevronRight, Activity, Stethoscope, Download, ListOrdered, Clock3, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { exportPatientReport } from '@/lib/pdf-export';
import { getQueueSnapshot, type QueueSnapshot } from '@/lib/queue-service';

type AccountData = {
  profile: any;
  appointments: any[];
  records: any[];
  messages: any[];
  bills: any[];
  queue: any;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<AccountData | null>(null);
  const [queueSnapshot, setQueueSnapshot] = useState<QueueSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    apiClient.getAccountData().then(({ data: account, error }) => {
      if (error) toast.error(error);
      if (account) {
        setData(account as AccountData);
        setQueueSnapshot(getQueueSnapshot({ ...account.queue, appointment: account.queue?.appointment ?? undefined }));
      }
    }).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    const refreshQueue = async () => {
      const result = await apiClient.getQueue();
      if (mounted && !result.error) {
        setData(previous => previous ? { ...previous, queue: result.data?.queue ?? null } : previous);
        setQueueSnapshot(getQueueSnapshot(result.data?.queue));
      }
    };
    void refreshQueue();
    const timer = window.setInterval(refreshQueue, 10_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const profile = data?.profile;
  const upcoming = (data?.appointments ?? []).filter(a => a.status !== 'Cancelled').slice(0, 3);
  const encounters = (data?.records ?? []).filter(r => r.kind === 'encounter').map(r => r.data).slice(0, 3);
  const pendingBills = (data?.bills ?? []).filter(b => b.status === 'Pending');
  const activeRx = (data?.records ?? []).filter(r => r.kind === 'prescription' && r.data?.status === 'Active');

  const handleExport = async () => {
    if (!profile) return;
    setIsExporting(true);
    try {
      await exportPatientReport({
        patient: {
          name: profile.name,
          age: 0,
          gender: '',
          dob: profile.dob ?? '',
          bloodType: profile.bloodType ?? '',
          allergies: profile.allergies ?? [],
          emergencyContact: {
            name: profile.emergencyContactName ?? '',
            relation: profile.emergencyContactRelation ?? '',
            phone: profile.emergencyContactPhone ?? '',
          },
        },
        appointments: upcoming.map(a => ({
          date: a.appointmentDate, time: a.appointmentTime,
          doctor: { name: a.doctorName, specialty: a.specialty },
          clinic: a.clinic, status: a.status,
        })),
        encounters, labResults: [], prescriptions: activeRx.map(r => r.data),
        bills: {
          outstanding: pendingBills.map(b => ({ desc: b.description, date: b.createdAt, amount: Number(b.amount) })),
          history: (data?.bills ?? []).filter(b => b.status !== 'Pending').map(b => ({ desc: b.description, date: b.createdAt, amount: Number(b.amount) })),
        },
      });
      toast.success('Health report downloaded successfully.');
    } catch {
      toast.error('Unable to export your health report.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <div className="space-y-6 animate-pulse"><div className="h-16 w-64 bg-muted rounded" /><div className="h-28 bg-muted rounded-xl" /><div className="h-48 bg-muted rounded-xl" /></div>;
  if (!profile) return <div className="py-16 text-center text-muted-foreground">No account data is available.</div>;

  const initials = profile.name.split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">{initials}</div>
          <div><h1 className="text-2xl md:text-3xl font-bold">Good morning, {profile.name.split(' ')[0]}</h1><p className="text-muted-foreground text-sm">Here's your health overview for today.</p></div>
        </div>
        <button onClick={handleExport} disabled={isExporting} className="hidden sm:flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium disabled:opacity-60"><Download className="w-4 h-4" />{isExporting ? 'Generating…' : 'Export Report'}</button>
      </section>
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Metric icon={<Calendar />} label="Next Appointment" value={upcoming[0] ? `${upcoming[0].appointmentDate} · ${upcoming[0].appointmentTime}` : 'None scheduled'} />
        <Metric icon={<MessageSquare />} label="Messages" value={String(data?.messages.length ?? 0)} />
        <Metric icon={<CreditCard />} label="Pending Bills" value={`₱${pendingBills.reduce((sum, b) => sum + Number(b.amount), 0).toLocaleString()}`} />
        <Metric icon={<Activity />} label="Active Rx" value={String(activeRx.length)} />
        <Metric icon={<ListOrdered />} label="Queue" value={queueSnapshot ? `${queueSnapshot.queueNumber} · ${queueSnapshot.peopleAhead ?? '—'} ahead` : 'Loading…'} />
      </section>
      <QueueWidget snapshot={queueSnapshot} />
      <section>
        <h2 className="text-base font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
          ['Book Visit', Calendar, '/appointments'], ['Message', MessageSquare, '/messages'], ['Records', FileText, '/records'], ['Pay Bill', CreditCard, '/billing'],
        ].map(([label, Icon, path]) => <button key={String(label)} onClick={() => setLocation(String(path))} className="flex flex-col items-center justify-center gap-2 p-4 bg-accent/50 rounded-xl border min-h-[88px]"><Icon className="w-5 h-5 text-primary" /><span className="text-sm font-medium">{String(label)}</span></button>)}</div>
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AccountList title="Recent Encounters" icon={<Stethoscope />} empty="No medical encounters recorded." items={encounters} render={(e: any) => <><b>{e.complaint ?? 'Encounter'}</b><span className="block text-xs text-primary">{e.doctor} · {e.specialty}</span><span className="block text-xs text-muted-foreground">{e.date}</span></>} />
        <AccountList title="Upcoming Appointments" icon={<Calendar />} empty="No appointments scheduled." items={upcoming} render={(a: any) => <><b>{a.appointmentDate} · {a.appointmentTime}</b><span className="block text-xs text-muted-foreground">{a.doctorName} · {a.specialty}</span></>} />
      </div>
      <div className="sm:hidden"><button onClick={handleExport} disabled={isExporting} className="w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-xl text-sm disabled:opacity-60"><Download className="w-4 h-4" />Export Full Health Report</button></div>
    </div>
  );
}

function QueueWidget({ snapshot }: { snapshot: QueueSnapshot | null }) {
  const progress = snapshot
    ? snapshot.status === 'Completed'
      ? 100
      : snapshot.status === 'Now Serving'
        ? 80
        : Math.max(12, Math.min(92, 92 - (snapshot.peopleAhead ?? 6) * 5))
    : 0;
  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-card p-5 md:p-6 shadow-sm overflow-hidden" aria-live="polite">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-primary">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Your Queue</h2>
              <p className="text-xs text-muted-foreground">Patient flow status</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {snapshot?.source === 'demo' ? 'Demo queue information while live queue tracking is being prepared.' : 'Your latest queue information.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
          Updates automatically
        </div>
      </div>
      {snapshot ? (
        <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="rounded-xl bg-card/90 border p-4">
            <p className="text-xs text-muted-foreground">Queue number</p>
            <p className="text-2xl md:text-3xl font-bold text-primary mt-1">{snapshot.queueNumber}</p>
          </div>
          <div className="rounded-xl bg-card/90 border p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />Estimated wait</p>
            <p className="text-xl md:text-2xl font-bold mt-1">{snapshot.estimatedWaitMinutes == null ? '—' : `${snapshot.estimatedWaitMinutes} min`}</p>
          </div>
          <div className="rounded-xl bg-card/90 border p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className={`text-base md:text-lg font-bold mt-1 ${snapshot.status === 'Completed' ? 'text-emerald-600' : snapshot.status === 'Now Serving' ? 'text-primary' : 'text-amber-600'}`}>{snapshot.status}</p>
          </div>
          <div className="rounded-xl bg-card/90 border p-4">
            <p className="text-xs text-muted-foreground">Last updated</p>
            <p className="text-sm md:text-base font-semibold mt-1">{new Date(snapshot.lastUpdated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Progress to service</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {snapshot.appointment && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border bg-card/70 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Linked appointment</p>
              <p className="font-semibold">{snapshot.appointment.date} · {snapshot.appointment.time}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">{snapshot.appointment.doctorName ?? 'Clinic visit'}</p>
              <p className="text-xs text-muted-foreground">{snapshot.appointment.clinic ?? 'Hospital outpatient clinic'}</p>
            </div>
          </div>
        )}
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed bg-card/60 p-6 text-center">
          <p className="font-semibold">No active queue</p>
          <p className="text-sm text-muted-foreground mt-1">Queue details will appear here after you check in for an appointment.</p>
        </div>
      )}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="bg-card p-4 rounded-xl border shadow-sm"><div className="flex items-center gap-2 text-muted-foreground mb-3"><span className="text-primary">{icon}</span><span className="text-xs font-medium">{label}</span></div><span className="text-base md:text-lg font-semibold">{value}</span></div>;
}

function AccountList({ title, icon, empty, items, render }: { title: string; icon: React.ReactNode; empty: string; items: any[]; render: (item: any) => React.ReactNode }) {
  return <section><h2 className="text-base font-semibold flex items-center gap-2 mb-3">{icon}{title}</h2><div className="bg-card border rounded-xl overflow-hidden divide-y">{items.length ? items.map((item, i) => <div key={item.id ?? i} className="p-4">{render(item)}</div>) : <p className="p-6 text-sm text-muted-foreground">{empty}</p>}</div></section>;
}