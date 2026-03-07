'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { leadsApi } from '@/lib/api';
import { Lead, LeadStatus } from '@/types';
import { STATUS_CONFIG, TEMPERATURE_CONFIG, PIPELINE_STAGES, formatCurrency, formatRelativeTime, getInitials } from '@/lib/utils';
import { LeadFormModal } from '@/components/crm/LeadFormModal';
import {
  Plus, Search, Filter, ChevronLeft, ChevronRight,
  ArrowUpDown, Edit2, Trash2, UserPlus
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const PAGE_SIZE = 20;

export default function LeadsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tempFilter, setTempFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [view, setView] = useState<'table' | 'kanban'>('table');

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search, statusFilter, tempFilter],
    queryFn: () => leadsApi.getAll({
      page,
      limit: PAGE_SIZE,
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(tempFilter && { temperature: tempFilter }),
    }).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const leads: Lead[] = data?.data || [];
  const pagination = data?.pagination;

  const canEdit = user?.role.name !== 'viewer';
  const canDelete = ['admin', 'manager'].includes(user?.role.name || '');

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination?.total?.toLocaleString() || '—'} total leads
          </p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditingLead(null); setShowForm(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search leads..."
            className="input pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={tempFilter}
          onChange={(e) => { setTempFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Temps</option>
          <option value="HOT">🔥 Hot</option>
          <option value="WARM">☀️ Warm</option>
          <option value="COLD">❄️ Cold</option>
        </select>

        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {(['table', 'kanban'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                view === v ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanView leads={leads} onEdit={(l) => { setEditingLead(l); setShowForm(true); }} canEdit={canEdit} />
      ) : (
        <>
          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Lead</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Contact</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Property</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Assigned</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Added</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    [...Array(8)].map((_, i) => (
                      <tr key={i} className="border-b border-gray-50 animate-pulse">
                        {[...Array(8)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-100 rounded w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        <div className="text-4xl mb-2">🎯</div>
                        <div className="font-medium">No leads found</div>
                        <div className="text-sm">Try adjusting your filters or add a new lead.</div>
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => {
                      const statusCfg = STATUS_CONFIG[lead.status];
                      const tempCfg = TEMPERATURE_CONFIG[lead.temperature];
                      return (
                        <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/leads/${lead.id}`} className="flex items-center gap-2 group">
                              <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-xs font-bold text-brand-700 flex-shrink-0">
                                {getInitials(lead.firstName, lead.lastName)}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors">
                                  {lead.firstName} {lead.lastName}
                                </div>
                                {lead.zipCode && <div className="text-xs text-gray-400">ZIP {lead.zipCode}</div>}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-800">{lead.email}</div>
                            {lead.phone && <div className="text-xs text-gray-400">{lead.phone}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-700">{lead.city || '—'}{lead.city && lead.state ? `, ${lead.state}` : ''}</div>
                            <div className="text-xs text-gray-400">{formatCurrency(lead.estimatedValue)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{tempCfg.icon}</span>
                              <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>
                                {statusCfg.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full w-16 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${lead.score >= 70 ? 'bg-green-500' : lead.score >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                  style={{ width: `${lead.score}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-700 w-8">{lead.score}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {lead.assignments && lead.assignments.length > 0 ? (
                              <div className="flex -space-x-1">
                                {lead.assignments.slice(0, 3).map((a) => (
                                  <div
                                    key={a.user.id}
                                    title={`${a.user.firstName} ${a.user.lastName}`}
                                    className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700 border-2 border-white"
                                  >
                                    {getInitials(a.user.firstName, a.user.lastName)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            {formatRelativeTime(lead.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {canEdit && (
                                <button
                                  onClick={() => { setEditingLead(lead); setShowForm(true); }}
                                  className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => confirm('Delete this lead?') && deleteMutation.mutate(lead.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, pagination.total)} of {pagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 1}
                    className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-gray-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium text-gray-700">{page} / {pagination.totalPages}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!pagination.hasMore}
                    className="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-gray-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showForm && (
        <LeadFormModal
          lead={editingLead}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['leads'] }); }}
        />
      )}
    </div>
  );
}

function KanbanView({ leads, onEdit, canEdit }: { leads: Lead[]; onEdit: (l: Lead) => void; canEdit: boolean }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_STAGES.map((status) => {
        const stageLeads = leads.filter((l) => l.status === status);
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status} className="flex-shrink-0 w-64">
            <div className={`px-3 py-2 rounded-t-lg border ${cfg.bg} flex items-center justify-between`}>
              <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
              <span className={`text-xs font-bold ${cfg.color}`}>{stageLeads.length}</span>
            </div>
            <div className="bg-gray-100 rounded-b-lg p-2 space-y-2 min-h-[200px] max-h-[600px] overflow-y-auto">
              {stageLeads.map((lead) => (
                <div key={lead.id} className="card p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => canEdit && onEdit(lead)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-gray-900 text-sm">{lead.firstName} {lead.lastName}</div>
                    <span className="text-sm">{TEMPERATURE_CONFIG[lead.temperature].icon}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{lead.city || lead.zipCode || lead.email}</div>
                  <div className="flex items-center gap-1 mt-2">
                    <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${lead.score >= 70 ? 'bg-green-500' : lead.score >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                        style={{ width: `${lead.score}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{lead.score}</span>
                  </div>
                  {lead.estimatedValue && (
                    <div className="text-xs font-medium text-green-600 mt-1">{formatCurrency(lead.estimatedValue)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
