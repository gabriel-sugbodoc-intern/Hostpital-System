import React from 'react';
import { Link } from '@tanstack/react-router';
import { useLocation } from '@/lib/router-compat';
import { Home, Calendar, FileText, MessageSquare, User, HeartPulse, ShoppingBag, Shield } from 'lucide-react';
import LogoutDialog from '@/components/portal/auth/LogoutDialog';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/appointments', label: 'Appointments', icon: Calendar },
  { href: '/records', label: 'Records', icon: FileText },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/store', label: 'Medical Store', icon: ShoppingBag },
  { href: '/insurance', label: 'Insurance Plans', icon: Shield },
] as const;

export function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card h-screen sticky top-0 shrink-0">
      <div className="p-6 flex items-center gap-3 shrink-0">
        <HeartPulse className="w-8 h-8 text-primary" />
        <span className="text-xl font-bold text-primary tracking-tight">SugboDoc</span>
      </div>
      
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto min-h-0">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
                isActive 
                  ? 'bg-accent text-primary' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border shrink-0">
        <LogoutDialog accountLabel="patient" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors min-h-[40px]" />
      </div>
    </aside>
  );
}

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card pb-safe flex items-center justify-around z-50">
      {NAV_ITEMS.map((item) => {
        const isActive = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex flex-col items-center justify-center w-full py-3 min-h-[56px] space-y-1 transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TopBar() {
  const [location] = useLocation();
  const currentItem = NAV_ITEMS.find(item => item.href === location) || 
                     NAV_ITEMS.find(item => location.startsWith(`${item.href}/`));
  
  const title = currentItem ? currentItem.label : 'SugboDoc';

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 border-b border-border bg-card flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-2">
        <HeartPulse className="w-6 h-6 text-primary" />
        <span className="font-bold text-foreground">{title}</span>
      </div>
      <div className="flex items-center gap-3">
        <LogoutDialog accountLabel="patient" className="md:hidden flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive px-2 py-1.5 rounded-md transition-colors" />
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
          JD
        </div>
      </div>
    </header>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col relative w-full h-full">
        <TopBar />
        <main className="flex-1 overflow-y-auto w-full pt-14 md:pt-0 pb-[72px] md:pb-0 px-4 md:px-8 py-6 md:py-8">
          <div className="max-w-5xl mx-auto w-full h-full">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
