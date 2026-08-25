import React, { useEffect, useState } from 'react';
import { useLocation } from '@/lib/router-compat';
import { User, Bell, Shield, Moon, Globe, Check, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

export default function Profile() {
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    dob: '',
    bloodType: '',
    allergies: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    email: '',
    phone: '',
  });
  
  const [notifs, setNotifs] = useState({
    appointments: true,
    results: true,
    messages: true,
    billing: true
  });

  useEffect(() => {
    apiClient.getProfile().then(({ data }) => {
      if (!data?.user) return;
      const user = data.user;
      setProfile({
        name: user.name || '',
        dob: user.dob || '',
        bloodType: user.bloodType || '',
        allergies: (user.allergies || []).join(', '),
        emergencyContactName: user.emergencyContactName || '',
        emergencyContactRelation: user.emergencyContactRelation || '',
        emergencyContactPhone: user.emergencyContactPhone || '',
        email: user.email,
        phone: user.phone || '',
      });
    });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await apiClient.updateProfile({
      name: profile.name,
      phone: profile.phone,
      dob: profile.dob,
      bloodType: profile.bloodType,
      allergies: profile.allergies.split(',').map(value => value.trim()).filter(Boolean),
      emergencyContactName: profile.emergencyContactName,
      emergencyContactRelation: profile.emergencyContactRelation,
      emergencyContactPhone: profile.emergencyContactPhone,
    });
    if (error) {
      toast.error(error);
      return;
    }
    localStorage.setItem('sugbodoc_user', JSON.stringify({ name: profile.name, email: profile.email }));
    setIsEditing(false);
    toast.success('Profile updated successfully');
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    toast.info('Theme preference updated');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile & Settings</h1>
        <p className="text-muted-foreground">Manage your personal information and preferences.</p>
      </div>

      {/* Profile Card */}
      <section className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary to-secondary opacity-90"></div>
        <div className="px-6 pb-6 relative">
          <div className="absolute -top-12 left-6 w-24 h-24 rounded-full border-4 border-card bg-accent flex items-center justify-center text-3xl font-bold text-primary shadow-sm">
            {profile.name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?'}
          </div>
          
          <div className="pt-14 flex justify-between items-start">
            <div>
               <h2 className="text-2xl font-bold text-foreground">{profile.name}</h2>
              <p className="text-muted-foreground">Patient ID: SD-2026-8942</p>
            </div>
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="mt-8 space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Full Name</label>
                  <input type="text" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full px-3 py-2 rounded-md border bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Mobile Number</label>
                  <input type="tel" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+639171234567" className="w-full px-3 py-2 rounded-md border bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Date of Birth</label>
                  <input type="text" value={profile.dob} onChange={e => setProfile({ ...profile, dob: e.target.value })} className="w-full px-3 py-2 rounded-md border bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Blood Type</label>
                  <input type="text" value={profile.bloodType} onChange={e => setProfile({ ...profile, bloodType: e.target.value })} className="w-full px-3 py-2 rounded-md border bg-background" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Allergies</label>
                  <input type="text" value={profile.allergies} onChange={e => setProfile({ ...profile, allergies: e.target.value })} className="w-full px-3 py-2 rounded-md border bg-background" />
                </div>
              </div>
              <div className="border-t pt-4 space-y-4 mt-6">
                <h3 className="font-semibold">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Name</label>
                    <input type="text" value={profile.emergencyContactName} onChange={e => setProfile({ ...profile, emergencyContactName: e.target.value })} className="w-full px-3 py-2 rounded-md border bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Phone</label>
                    <input type="tel" value={profile.emergencyContactPhone} onChange={e => setProfile({ ...profile, emergencyContactPhone: e.target.value })} className="w-full px-3 py-2 rounded-md border bg-background" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 border rounded-md font-medium hover:bg-muted">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90">Save Changes</button>
              </div>
            </form>
          ) : (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 animate-in fade-in">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date of Birth</p>
                 <p className="font-medium">{profile.dob}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Blood Type</p>
                 <p className="font-medium text-destructive">{profile.bloodType}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Known Allergies</p>
                <div className="flex gap-2 mt-1">
                   {profile.allergies.split(',').filter(Boolean).map(a => (
                    <span key={a} className="px-2 py-0.5 bg-warning/10 text-warning text-xs font-medium rounded-full border border-warning/20">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Emergency Contact</p>
                 <p className="font-medium">{profile.emergencyContactName} <span className="text-muted-foreground text-sm font-normal">({profile.emergencyContactRelation})</span></p>
                 <p className="text-sm text-muted-foreground mt-0.5">{profile.emergencyContactPhone}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Notifications */}
        <section className="bg-card border border-border rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Bell className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            {[
              { id: 'appointments', label: 'Appointment Reminders', desc: 'Get notified before visits' },
              { id: 'results', label: 'Lab Result Alerts', desc: 'When new results are uploaded' },
              { id: 'messages', label: 'Doctor Messages', desc: 'When a doctor replies' },
              { id: 'billing', label: 'Billing Notifications', desc: 'New bills and receipts' },
            ].map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <button 
                  onClick={() => setNotifs({ ...notifs, [item.id]: !notifs[item.id as keyof typeof notifs] })}
                  className={`w-11 h-6 rounded-full transition-colors relative ${notifs[item.id as keyof typeof notifs] ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${notifs[item.id as keyof typeof notifs] ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Preferences */}
        <section className="bg-card border border-border rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">App Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Language</p>
                  <p className="text-xs text-muted-foreground">English (US)</p>
                </div>
              </div>
              <select className="bg-muted text-sm border-none rounded-md px-2 py-1 focus:ring-1 focus:ring-primary outline-none">
                <option>English</option>
                <option>Filipino</option>
                <option>Cebuano</option>
              </select>
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">Toggle theme</p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className="w-11 h-6 rounded-full transition-colors relative bg-muted dark:bg-primary"
              >
                <div className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform dark:translate-x-5 translate-x-0"></div>
              </button>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
