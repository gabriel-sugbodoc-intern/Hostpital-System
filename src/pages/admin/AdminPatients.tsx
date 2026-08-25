import React, { useEffect, useState } from 'react';
import { useLocation } from '@/lib/router-compat';
import { toast } from 'sonner';
import { ChevronRight, Users, Filter } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import SearchFilter from '@/components/portal/admin/SearchFilter';
import StatusBadge from '@/components/portal/admin/StatusBadge';
import { usePortalBase } from '@/lib/portal-base';

type Patient = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dob?: string;
  age?: number;
  sex?: string;
  createdAt: string;
  assignedDoctor?: string;
  status: string;
};

export default function AdminPatients() {
  const portalBase = usePortalBase();
  const [, setLocation] = useLocation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setIsLoading(true);
    apiClient.getAdminPatients?.({ search: searchQuery, status: statusFilter !== 'all' ? statusFilter : undefined })
      .then(({ data, error }) => {
        if (error) {
          toast.error(error);
        } else if (data) {
          setPatients((data as any).patients || []);
        }
      })
      .finally(() => setIsLoading(false));
  }, [searchQuery, statusFilter]);

  const filteredPatients = patients.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Patient Directory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchFilter
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, email, or ID..."
          className="flex-1"
        />
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-status-filter"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="font-medium text-foreground">No patients found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Patient ID</th>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Contact</th>
                  <th className="px-5 py-3 text-left font-medium">Age / Sex</th>
                  <th className="px-5 py-3 text-left font-medium">Assigned Doctor</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Registered</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredPatients.map(patient => (
                  <tr
                    key={patient.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setLocation(`${portalBase}/patients/${patient.id}`)}
                    data-testid={`patient-row-${patient.id}`}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {patient.id.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">
                      {patient.name}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div className="text-xs">
                        <div>{patient.email}</div>
                        {patient.phone && <div className="text-[10px] mt-0.5">{patient.phone}</div>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-foreground">
                      {patient.age ? `${patient.age}y` : '—'} / {patient.sex || '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {patient.assignedDoctor || 'Unassigned'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={patient.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(patient.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-border">
            {filteredPatients.map(patient => (
              <button
                key={patient.id}
                onClick={() => setLocation(`${portalBase}/patients/${patient.id}`)}
                className="w-full px-4 py-4 hover:bg-muted/30 transition-colors text-left"
                data-testid={`patient-card-${patient.id}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{patient.name}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      ID: {patient.id.slice(0, 8)}
                    </p>
                  </div>
                  <StatusBadge status={patient.status} />
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>{patient.email}</div>
                  {patient.phone && <div>{patient.phone}</div>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span>{patient.age ? `${patient.age}y` : '—'} / {patient.sex || '—'}</span>
                    <span>·</span>
                    <span>Reg: {new Date(patient.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
