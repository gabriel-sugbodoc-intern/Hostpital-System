import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Shield, Plus, Pencil, Trash2, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import SearchFilter from '@/components/portal/admin/SearchFilter';

type InsurancePlan = {
  id: string;
  code: string;
  name: string;
  provider: string;
  description: string;
  monthlyPremium: string;
  annualPremium: string;
  coverageLimit: string;
  coveragePercentage: number;
  validityMonths: number;
  benefits: string[];
  active: number;
  createdAt: string;
};

function PlanModal({ plan, onClose, onSave }: {
  plan: Partial<InsurancePlan> | null;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
}) {
  const isEdit = !!plan?.id;
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    code: plan?.code ?? '',
    provider: plan?.provider ?? '',
    description: plan?.description ?? '',
    monthlyPremium: plan?.monthlyPremium ?? '0',
    annualPremium: plan?.annualPremium ?? '0',
    coverageLimit: plan?.coverageLimit ?? '0',
    coveragePercentage: plan?.coveragePercentage ?? 80,
    validityMonths: plan?.validityMonths ?? 12,
    benefits: (plan?.benefits ?? []).join('\n'),
    active: (plan?.active ?? 1) === 1,
  });
  const [saving, setSaving] = useState(false);

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? target.checked : value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.provider.trim()) {
      toast.error('Name, code, and provider are required.');
      return;
    }
    setSaving(true);
    await onSave({
      ...form,
      benefits: form.benefits.split('\n').map((b: string) => b.trim()).filter(Boolean),
      coveragePercentage: Number(form.coveragePercentage),
      validityMonths: Number(form.validityMonths),
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-bold text-foreground">{isEdit ? 'Edit Insurance Plan' : 'New Insurance Plan'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Plan Name *</label>
              <input name="name" value={form.name} onChange={handle} required className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Plan Code *</label>
              <input name="code" value={form.code} onChange={handle} required disabled={isEdit} placeholder="e.g. BASIC-2026"
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Provider *</label>
            <input name="provider" value={form.provider} onChange={handle} required className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handle} rows={2}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Monthly Premium (₱)</label>
              <input name="monthlyPremium" value={form.monthlyPremium} onChange={handle} type="number" min="0" step="0.01"
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Annual Premium (₱)</label>
              <input name="annualPremium" value={form.annualPremium} onChange={handle} type="number" min="0" step="0.01"
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Coverage Limit (₱)</label>
              <input name="coverageLimit" value={form.coverageLimit} onChange={handle} type="number" min="0"
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Coverage %</label>
              <input name="coveragePercentage" value={form.coveragePercentage} onChange={handle} type="number" min="0" max="100"
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Validity (months)</label>
            <input name="validityMonths" value={form.validityMonths} onChange={handle} type="number" min="1"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Benefits <span className="text-muted-foreground font-normal">(one per line)</span>
            </label>
            <textarea name="benefits" value={form.benefits} onChange={handle} rows={3}
              placeholder={"Free annual physical exam\n20% inpatient discount\nDental coverage"}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="planActive" name="active" checked={form.active} onChange={handle} className="rounded border-input w-4 h-4" />
            <label htmlFor="planActive" className="text-sm text-foreground select-none cursor-pointer">Active — visible to patients</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminInsurancePlans() {
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  // undefined = closed; null = creating new; InsurancePlan = editing
  const [modalPlan, setModalPlan] = useState<Partial<InsurancePlan> | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    const result = await apiClient.getAdminInsurancePlans();
    if (result.error) toast.error(result.error);
    else if (result.data) setPlans((result.data as any).plans ?? []);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = search
    ? plans.filter(p => `${p.name} ${p.provider} ${p.code}`.toLowerCase().includes(search.toLowerCase()))
    : plans;

  const handleSave = async (data: Record<string, any>) => {
    if (modalPlan?.id) {
      const result = await apiClient.updateAdminInsurancePlan(modalPlan.id, data);
      if (result.error) { toast.error(result.error); return; }
      toast.success('Plan updated.');
      setPlans(prev => prev.map(p => p.id === modalPlan.id ? { ...p, ...(result.data?.plan as InsurancePlan) } : p));
    } else {
      const result = await apiClient.createAdminInsurancePlan(data);
      if (result.error) { toast.error(result.error); return; }
      toast.success('Insurance plan created and visible to patients.');
      await load();
    }
    setModalPlan(undefined);
  };

  const toggleActive = async (plan: InsurancePlan) => {
    setTogglingId(plan.id);
    const newActive = plan.active === 1 ? 0 : 1;
    const result = await apiClient.updateAdminInsurancePlan(plan.id, { active: newActive });
    setTogglingId(null);
    if (result.error) { toast.error(result.error); return; }
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, active: newActive } : p));
    toast.success(newActive === 1 ? 'Plan is now visible to patients.' : 'Plan hidden from patients.');
  };

  const handleDelete = async (plan: InsurancePlan) => {
    if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    setDeletingId(plan.id);
    const result = await apiClient.deleteAdminInsurancePlan(plan.id);
    setDeletingId(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success('Plan deleted.');
    setPlans(prev => prev.filter(p => p.id !== plan.id));
  };

  return (
    <div className="space-y-6 animate-in slide-up">
      {modalPlan !== undefined && (
        <PlanModal plan={modalPlan} onClose={() => setModalPlan(undefined)} onSave={handleSave} />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Insurance Plans
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} plan{filtered.length !== 1 ? 's' : ''} ·{' '}
            {plans.filter(p => p.active === 1).length} active
          </p>
        </div>
        <button
          onClick={() => setModalPlan(null)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      <SearchFilter value={search} onChange={setSearch} placeholder="Search by name, provider, or code..." />

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded" />)}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="font-medium text-foreground">No insurance plans</p>
          <p className="text-sm text-muted-foreground mt-1">Create a plan to make it available to patients.</p>
          <button onClick={() => setModalPlan(null)} className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90">Add Plan</button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Monthly</th>
                  <th className="px-4 py-3 text-left font-medium">Coverage Limit</th>
                  <th className="px-4 py-3 text-left font-medium">Coverage %</th>
                  <th className="px-4 py-3 text-left font-medium">Validity</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(plan => (
                  <tr key={plan.id} className={`hover:bg-muted/30 transition-colors ${plan.active !== 1 ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{plan.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{plan.code}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{plan.provider}</td>
                    <td className="px-4 py-3 font-mono">₱{Number(plan.monthlyPremium || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono">₱{Number(plan.coverageLimit || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{plan.coveragePercentage}%</td>
                    <td className="px-4 py-3 text-muted-foreground">{plan.validityMonths} mo.</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${plan.active === 1 ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                        {plan.active === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => toggleActive(plan)} disabled={togglingId === plan.id}
                          title={plan.active === 1 ? 'Deactivate' : 'Activate'}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50">
                          {plan.active === 1 ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setModalPlan(plan)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(plan)} disabled={deletingId === plan.id}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border">
            {filtered.map(plan => (
              <div key={plan.id} className={`px-4 py-4 ${plan.active !== 1 ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.provider} · <span className="font-mono">{plan.code}</span></p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${plan.active === 1 ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {plan.active === 1 ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs mt-2">
                  <div><span className="text-muted-foreground">Monthly: </span><span className="font-mono">₱{Number(plan.monthlyPremium || 0).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Coverage: </span><span>₱{Number(plan.coverageLimit || 0).toLocaleString()}</span></div>
                </div>
                <div className="flex gap-1.5 mt-3">
                  <button onClick={() => toggleActive(plan)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
                    {plan.active === 1 ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => setModalPlan(plan)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">Edit</button>
                  <button onClick={() => handleDelete(plan)} className="px-3 py-1.5 rounded-lg border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
