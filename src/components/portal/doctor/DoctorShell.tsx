import React, { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useLocation } from '@/lib/router-compat';
import {
  LayoutDashboard,
  Users,
  Calendar,
  HeartPulse,
  MessageSquare,
  User,
  Stethoscope,
} from 'lucide-react';
import LogoutDialog from '@/components/portal/auth/LogoutDialog';

const DOCTOR_NAV_ITEMS = [
  { href: '/doctor', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/doctor/patients', label: 'My Patients', icon: Users },
  { href: '/doctor/encounters', label: 'Encounters', icon: HeartPulse },
  { href: '/doctor/appointments', label: 'Appointments', icon: Calendar },
  { href: '/doctor/messaging', label: 'Messaging', icon: MessageSquare },
  { href: '/doctor/profile', label: 'My Profile', icon: User },
] as const;

function isNavActive(location: string, href: string) {
  if (href === '/doctor') return location === '/doctor' || location === '/doctor/';
  return location === href || location.startsWith(`${href}/`);
}

function DoctorSidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card h-screen sticky top-0 shrink-0">
      <div className="p-6 flex items-center gap-3 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <span className="text-base font-bold text-foreground">Doctor Portal</span>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">SugboDoc</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0">
        {DOCTOR_NAV_ITEMS.map((item) => {
          const isActive = isNavActive(location, item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[40px] ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              data-testid={`nav-${item.href.split('/').pop() || 'dashboard'}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border shrink-0">
        <LogoutDialog accountLabel="doctor" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[40px]" />
      </div>
    </aside>
  );
}

function DoctorTopBar() {
  const [location] = useLocation();
  const currentItem = [...DOCTOR_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isNavActive(location, item.href));

  const title = currentItem ? currentItem.label : 'Doctor';
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('sugbodoc_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  const initials = user?.name
    ? user.name.split(/\s+/).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

  return (
    <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Stethoscope className="w-5 h-5 text-primary md:hidden" />
        <div>
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Clinical Workspace</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <LogoutDialog accountLabel="doctor" className="md:hidden flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive px-2 py-1.5 rounded-md transition-colors" />
        <div className="hidden sm:block text-right mr-2">
          <p className="text-xs font-medium text-foreground">{user?.name || 'Doctor'}</p>
          <p className="text-[10px] text-muted-foreground">Doctor Role</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
          {initials}
        </div>
      </div>
    </header>
  );
}

function DoctorBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card pb-safe flex items-center overflow-x-auto z-50">
      {DOCTOR_NAV_ITEMS.map((item) => {
        const isActive = isNavActive(location, item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center justify-center shrink-0 min-w-[76px] py-2.5 min-h-[56px] space-y-0.5 transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
            data-testid={`nav-mobile-${item.href.split('/').pop() || 'dashboard'}`}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function DoctorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <DoctorSidebar />
      <div className="flex-1 flex flex-col relative w-full h-full">
        <DoctorTopBar />
        <main className="flex-1 overflow-y-auto w-full pb-[72px] md:pb-0 scrollbar-thin">
          <div className="max-w-7xl mx-auto w-full h-full p-4 md:p-6">{children}</div>
        </main>
        <DoctorBottomNav />
      </div>
    </div>
  );
}
