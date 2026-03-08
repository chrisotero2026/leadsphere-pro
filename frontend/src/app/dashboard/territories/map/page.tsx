'use client';
// src/app/dashboard/territories/map/page.tsx
// Visual territory browser: filter by state, see ownership status, assign/purchase

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { territoriesApi } from '@/lib/territoryApi';
import {
  Map, Search, Filter, CheckCircle, AlertCircle,
  Users, Lock, Unlock, DollarSign, ChevronDown,
  Loader2, MapPin, X, TrendingUp, User, Plus,
} from 'lucide-react';

// ── Type colours ────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  EXCLUSIVE:   { label:'Exclusive',   color:'text-violet-700',  bg:'bg-violet-50',  border:'border-violet-200', icon:Lock },
  SHARED:      { label:'Shared',      color:'text-blue-700',    bg:'bg-blue-50',    border:'border-blue-200',   icon:Users },
  MARKETPLACE: { label:'Available',   color:'text-emerald-700', bg:'bg-emerald-50', border:'border-emerald-200', icon:Unlock },
  AUCTION:     { label:'Auction',     color:'text-amber-700',   bg:'bg-amber-50',   border:'border-amber-200',  icon:DollarSign },
};

interface Territory {
  id: string;
  displayName: string;
  zipCode?: string;
  city?: string;
  county?: string;
  stateCode: string;
  type: string;
  status: string;
  monthlyPrice?: number;
  leadsPerMonth?: number;
  totalLeads: number;
  totalAssigned: number;
  priority: number;
  ownerships: Array<{
    id: string;
    isActive: boolean;
    startDate: string;
    endDate?: string;
    leadsReceived: number;
    leadsConverted: number;
    user: { id: string; firstName: string; lastName: string; email: string };
  }>;
  maxOwners?: number;
  _count: { assignments: number };
}

// ── Assign owner modal ───────────────────────────────────────────────
function AssignModal({
  territory,
  onClose,
  onAssigned,
}: {
  territory: Territory;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [form, setForm] = useState({
    userId:              '',
    monthlyFee:          territory.monthlyPrice?.toString() ?? '',
    leadNotifyEmail:     true,
    leadNotifySms:       false,
    leadNotifyDashboard: true,
    webhookUrl:          '',
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-for-assign'],
    queryFn:  () =>
      fetch('/api/v1/users?limit=100', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      }).then(r => r.json()).then(r => r.data ?? []),
  });

  const assignMut = useMutation({
    mutationFn: () => territoriesApi.assignUser(territory.id, {
      userId:      form.userId,
      monthlyFee:  form.monthlyFee ? Number(form.monthlyFee) : undefined,
      leadNotifyEmail:     form.leadNotifyEmail,
      leadNotifySms:       form.leadNotifySms,
      leadNotifyDashboard: form.leadNotifyDashboard,
      webhookUrl:  form.webhookUrl || undefined,
    }),
    onSuccess: () => { onAssigned(); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-900">Assign Territory Owner</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="px-4 py-3 bg-gray-50 rounded-xl text-sm">
            <div className="font-semibold text-gray-900">{territory.displayName}</div>
            <div className="text-gray-500 mt-0.5">{territory.type} · {territory.monthlyPrice ? `$${territory.monthlyPrice}/mo` : 'No price set'}</div>
          </div>

          <div>
            <label className="label">Select User *</label>
            <select className="input" value={form.userId}
              onChange={e => setForm(p => ({...p, userId: e.target.value}))}>
              <option value="">Choose a user…</option>
              {(usersData ?? []).map((u: any) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.email}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Monthly Fee (override)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
              <input className="input pl-7" type="number" placeholder="299"
                value={form.monthlyFee}
                onChange={e => setForm(p => ({...p, monthlyFee: e.target.value}))}/>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notification Preferences</p>
            {[
              { key:'leadNotifyEmail',     label:'Email notifications' },
              { key:'leadNotifyDashboard', label:'Dashboard notifications' },
              { key:'leadNotifySms',       label:'SMS notifications (requires Twilio)' },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-indigo-600"
                  checked={(form as any)[opt.key]}
                  onChange={e => setForm(p => ({...p, [opt.key]: e.target.checked}))}/>
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="label">Webhook URL (optional)</label>
            <input className="input" placeholder="https://yourcrm.com/webhook/lead"
              value={form.webhookUrl}
              onChange={e => setForm(p => ({...p, webhookUrl: e.target.value}))}/>
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => assignMut.mutate()}
            disabled={!form.userId || assignMut.isPending}
            className="flex-1 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-bold hover:bg-[#24527a] disabled:opacity-50">
            {assignMut.isPending ? 'Assigning…' : 'Assign Owner'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Territory Card ───────────────────────────────────────────────────
function TerritoryCard({
  territory,
  onAssign,
  onRemoveOwner,
}: {
  territory: Territory;
  onAssign: (t: Territory) => void;
  onRemoveOwner: (territoryId: string, userId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CFG[territory.type] ?? TYPE_CFG.MARKETPLACE;
  const Icon = cfg.icon;
  const activeOwners = territory.ownerships?.filter(o => o.isActive) ?? [];
  const isAvailable  = activeOwners.length === 0;
  const cvr = activeOwners.reduce((sum, o) => sum + o.leadsConverted, 0);
  const lrx = activeOwners.reduce((sum, o) => sum + o.leadsReceived, 0);

  return (
    <div className={`card border overflow-hidden transition-all ${!isAvailable ? 'border-gray-200' : 'border-emerald-200 bg-emerald-50/20'}`}>
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${cfg.color}`}/>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate text-sm">{territory.displayName}</div>
              {territory.zipCode && (
                <div className="text-xs text-gray-400 font-mono mt-0.5">{territory.zipCode}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3"/> {territory.totalLeads} leads
          </span>
          {territory.leadsPerMonth && (
            <span>~{territory.leadsPerMonth}/mo</span>
          )}
          {territory.monthlyPrice && (
            <span className="font-semibold text-gray-800">${territory.monthlyPrice}/mo</span>
          )}
          {lrx > 0 && (
            <span className="text-emerald-600 font-semibold">
              {Math.round((cvr / lrx) * 100)}% CVR
            </span>
          )}
        </div>

        {/* Owners */}
        {activeOwners.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {activeOwners.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[#1B3A5C]/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 text-[#1B3A5C]"/>
                  </div>
                  <span className="text-xs font-medium text-gray-800 truncate">
                    {o.user.firstName} {o.user.lastName}
                  </span>
                  <span className="text-xs text-gray-400 hidden sm:block">· {o.leadsReceived} leads</span>
                </div>
                <button
                  onClick={() => onRemoveOwner(territory.id, o.user.id)}
                  className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 hover:underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          {isAvailable ? (
            <button
              onClick={() => onAssign(territory)}
              className="flex-1 py-2 bg-[#1B3A5C] text-white text-xs font-bold rounded-lg hover:bg-[#24527a] flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5"/> Assign Owner
            </button>
          ) : territory.type === 'SHARED' && activeOwners.length < (territory as any).maxOwners ? (
            <button
              onClick={() => onAssign(territory)}
              className="flex-1 py-2 border border-[#1B3A5C] text-[#1B3A5C] text-xs font-bold rounded-lg hover:bg-[#1B3A5C]/5 flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5"/> Add Co-owner ({activeOwners.length}/{(territory as any).maxOwners})
            </button>
          ) : (
            <div className="flex-1 py-2 bg-gray-100 text-gray-400 text-xs font-medium rounded-lg text-center">
              {territory.type === 'EXCLUSIVE' ? 'Exclusive — 1 owner max' : 'At capacity'}
            </div>
          )}

          <button
            onClick={() => setExpanded(e => !e)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}/>
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-500">
            {territory.county && <div>County: <span className="text-gray-800">{territory.county}</span></div>}
            <div>Total assigned: <span className="text-gray-800">{territory.totalAssigned}</span></div>
            <div>Priority score: <span className="text-gray-800">{territory.priority}</span></div>
            <div>Territory ID: <code className="bg-gray-100 px-1 rounded font-mono text-xs">{territory.id.slice(0,8)}…</code></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function TerritoryMapPage() {
  const qc = useQueryClient();

  const [stateCode,  setStateCode]  = useState('VA');
  const [typeFilter, setTypeFilter] = useState('');
  const [search,     setSearch]     = useState('');
  const [available,  setAvailable]  = useState(false);
  const [assignTarget, setAssignTarget] = useState<Territory | null>(null);
  const [page, setPage] = useState(1);
  const [seedModal, setSeedModal] = useState(false);
  const [seedForm, setSeedForm] = useState({
    stateCode: 'VA', type: 'MARKETPLACE', monthlyPrice: '299',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['territories-map', stateCode, typeFilter, available, search, page],
    queryFn:  () => territoriesApi.list({
      page, limit: 24,
      ...(stateCode  && { stateCode }),
      ...(typeFilter && { type: typeFilter }),
      ...(available  && { available: 'true' }),
      ...(search     && { search }),
    }).then(r => r.data),
  });

  const removeOwnerMut = useMutation({
    mutationFn: ({ territoryId, userId }: { territoryId: string; userId: string }) =>
      territoriesApi.removeOwner(territoryId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['territories-map'] }),
  });

  const seedMut = useMutation({
    mutationFn: () => territoriesApi.seedFromLocations({
      stateCode:    seedForm.stateCode,
      type:         seedForm.type,
      monthlyPrice: seedForm.monthlyPrice ? Number(seedForm.monthlyPrice) : undefined,
    }),
    onSuccess: (r) => {
      setSeedModal(false);
      qc.invalidateQueries({ queryKey: ['territories-map'] });
      alert(r.data.message);
    },
  });

  const territories: Territory[] = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = Math.ceil(total / 24);

  const owned     = territories.filter(t => t.ownerships?.some(o => o.isActive)).length;
  const available_count = territories.filter(t => !t.ownerships?.some(o => o.isActive)).length;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Territory Map</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} territories · <span className="text-emerald-600 font-medium">{available_count} available</span> · <span className="text-violet-600 font-medium">{owned} owned</span>
          </p>
        </div>
        <button onClick={() => setSeedModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3A5C] text-white text-sm font-semibold rounded-xl hover:bg-[#24527a]">
          <Plus className="w-4 h-4"/> Seed Territories
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        {/* State tabs */}
        <div className="flex gap-1">
          {['VA','MD','DC',''].map(s => (
            <button key={s} onClick={() => { setStateCode(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                stateCode === s
                  ? 'bg-[#1B3A5C] text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select className="input py-1.5 w-36 text-sm"
          value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="EXCLUSIVE">Exclusive</option>
          <option value="SHARED">Shared</option>
          <option value="MARKETPLACE">Available</option>
        </select>

        {/* Available toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded border-gray-300 text-indigo-600"
            checked={available} onChange={e => { setAvailable(e.target.checked); setPage(1); }}/>
          <span className="text-sm text-gray-600 font-medium">Available only</span>
        </label>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input className="input pl-9 py-1.5 text-sm" placeholder="Search ZIP, city…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
        </div>

        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400"/>}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(TYPE_CFG).map(([type, cfg]) => (
          <div key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
            <cfg.icon className="w-3 h-3"/>
            {cfg.label}
          </div>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
      ) : territories.length === 0 ? (
        <div className="card py-16 text-center">
          <Map className="w-12 h-12 mx-auto mb-3 text-gray-200"/>
          <p className="text-gray-500 font-medium mb-2">No territories yet for {stateCode || 'this filter'}</p>
          <button onClick={() => setSeedModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3A5C] text-white text-sm font-semibold rounded-xl hover:bg-[#24527a]">
            <Plus className="w-4 h-4"/> Seed Territories
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {territories.map(t => (
              <TerritoryCard
                key={t.id}
                territory={t}
                onAssign={setAssignTarget}
                onRemoveOwner={(tId, uId) => removeOwnerMut.mutate({ territoryId: tId, userId: uId })}
              />
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: Math.min(pages, 8) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                    page === p ? 'bg-[#1B3A5C] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Assign modal */}
      {assignTarget && (
        <AssignModal
          territory={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => {
            qc.invalidateQueries({ queryKey: ['territories-map'] });
            setAssignTarget(null);
          }}
        />
      )}

      {/* Seed modal */}
      {seedModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-gray-900">Seed Territories</h2>
              <button onClick={() => setSeedModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Creates one territory per seeded location (ZIP code). You can assign owners afterward.</p>
              <div>
                <label className="label">State</label>
                <select className="input" value={seedForm.stateCode}
                  onChange={e => setSeedForm(p => ({...p, stateCode: e.target.value}))}>
                  <option value="">All States</option>
                  <option value="VA">Virginia</option>
                  <option value="MD">Maryland</option>
                  <option value="DC">Washington DC</option>
                </select>
              </div>
              <div>
                <label className="label">Territory Type</label>
                <select className="input" value={seedForm.type}
                  onChange={e => setSeedForm(p => ({...p, type: e.target.value}))}>
                  <option value="MARKETPLACE">Marketplace (available to purchase)</option>
                  <option value="EXCLUSIVE">Exclusive (1 owner)</option>
                  <option value="SHARED">Shared (multiple owners)</option>
                </select>
              </div>
              <div>
                <label className="label">Monthly Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">$</span>
                  <input className="input pl-7" type="number" placeholder="299"
                    value={seedForm.monthlyPrice}
                    onChange={e => setSeedForm(p => ({...p, monthlyPrice: e.target.value}))}/>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setSeedModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}
                className="flex-1 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-bold hover:bg-[#24527a] disabled:opacity-60">
                {seedMut.isPending ? 'Seeding…' : 'Seed Territories'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
