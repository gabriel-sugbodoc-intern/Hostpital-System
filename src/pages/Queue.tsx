import React, { useEffect, useState } from 'react';
import { ListOrdered, CalendarDays, MapPin, Clock3, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function Queue() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const result = await apiClient.getQueue();
      if (!mounted) return;
      if (result.error) setError(result.error);
      else {
        setError('');
        setData(result.data?.queue ?? null);
        setLastUpdated(new Date());
      }
      setLoading(false);
    };
    void refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) return <div className="h-48 rounded-xl bg-muted animate-pulse" />;
  if (error) return <div className="py-16 text-center"><ListOrdered className="w-12 h-12 mx-auto mb-4 text-destructive opacity-50" /><h1 className="text-2xl font-bold">Queue Status</h1><p className="text-muted-foreground mt-2">{error}</p></div>;
  if (!data) return <div className="py-16 text-center"><ListOrdered className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" /><h1 className="text-2xl font-bold">Queue Status</h1><p className="text-muted-foreground mt-2">You do not have an active queue entry.</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Queue Status</h1><p className="text-sm text-muted-foreground">Live queue information for your account</p></div>
        <div className="text-right text-xs text-muted-foreground"><RefreshCw className="w-4 h-4 inline mr-1" />Updates every 10 seconds{lastUpdated && <span className="block mt-1">Updated {lastUpdated.toLocaleTimeString()}</span>}</div>
      </div>
      <section className="bg-card border rounded-2xl p-8 text-center">
        <ListOrdered className="w-10 h-10 mx-auto text-primary mb-3" />
        <div className="text-6xl font-extrabold text-primary">#{data.queueNumber}</div>
        <p className="text-sm font-semibold text-foreground mt-3">{data.status}</p>
        {data.currentServingNumber != null && <p className="text-sm text-muted-foreground mt-1">Currently serving #{data.currentServingNumber}</p>}
      </section>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">People ahead</p><p className="text-3xl font-bold mt-2">{data.ahead ?? '—'}</p></div>
        <div className="bg-card border rounded-xl p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />Estimated wait</p><p className="text-3xl font-bold mt-2">{data.estimatedWaitMinutes == null ? '—' : `${data.estimatedWaitMinutes} min`}</p></div>
      </div>
      {data.appointment && <section className="bg-card border rounded-xl p-4 space-y-3"><div className="flex gap-2"><CalendarDays className="w-4 h-4 text-primary" />{data.appointment.date} · {data.appointment.time}</div><div className="flex gap-2"><MapPin className="w-4 h-4 text-primary" />{data.appointment.clinic}</div><p className="text-sm text-muted-foreground">{data.appointment.doctorName}</p></section>}
    </div>
  );
}