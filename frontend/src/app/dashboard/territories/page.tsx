'use client';
// src/app/dashboard/territories/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { territoriesApi, assignmentsApi } from '@/lib/territoryApi';
import Link from 'next/link';
import {
  Map, Users, TrendingUp, AlertTriangle, CheckCircle,
  Clock, Zap, ArrowRight, MapPin, Loader2,
} from 'lucide-react';

const TEMP_COLOR: Record<string, string> = {
  HOT: 'text-red-500', WARM: 'text-orange-400', COLD: 'text-blue-400',
};
const TEMP_BG: Record<string, string> = {
  HOT: 'bg-red-50', WARM: 'bg-orange-50', COLD: 'bg-blue-50',
};
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ASSIGNED:   { label:'Assigned',   color:'text-blue-600',    bg:'bg-blue-50' },
  ACCEPTED:   { label:'Accepted',   color:'text-indigo-600',  bg:'bg-indigo-50' },
  WORKING:    { label:'Working',    color:'text-violet-600',  bg:'bg-violet-50' },
  CONVERTED:  { label:'Converted',  color:'text-emerald-600', bg:'bg-emerald-50' },
  REJECTED:   { label:'Rejected',   color:'text-red-500',     bg:'bg-red-50' },
  EXPIRED:    { label:'Expired',    color:'text-slate-400',   bg:'bg-slate-50' },
  UNASSIGNED: { label:'Unassigned', color:'text-amber-600',   bg:'bg-amber-50' },
};

export default function TerritoriesDashboard() {
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const { data: statsData } = useQuery({
    queryKey: ['assignment-stats'],
    queryFn:  () => assignmentsApi.stats().then(r => r.data.data),
    refetchInterval: 30000,
  });

  const { data: myAssignments } = useQuery({
    queryKey: ['my-assignments'],
    queryFn:  () => assignmentsApi.list({ limit: 8, status: 'ASSIGNED' }).then(r => r.data),
  });

  const { data: myTerritories } = useQuery({
    queryKey: ['my-territories'],
    queryFn:  () => territoriesApi.myTerritories().then(r => r.data.data),
  });

  const seedMutation = useMutation({
    mutationFn: () => territoriesApi.seedFromLocations({ type: 'MARKETPLACE', monthlyPrice: 299 }),
    onSuccess: r => { setSeedMsg(r.data.message); qc.invalidateQueries(); },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => assignmentsApi.accept(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-assignments'] }),
  });

  const stats = statsData;
  const assignments = myAssignments?.data ?? [];
  const territories = myTerritories ?? [];

  const metricCards = [
    { label:'Total Assigned',    val: stats?.assigned ?? 0,        icon: CheckCircle,    bg:'bg-emerald-50', fg:'text-emerald-600' },
    { label:'Unassigned Leads',  val: stats?.unassigned ?? 0,      icon: AlertTriangle,  bg:'bg-amber-50',   fg:'text-amber-600' },
    { label:'Expired',           val: stats?.expired ?? 0,         icon: Clock,          bg:'bg-slate-50',   fg:'text-slate-500' },
    { label:'Assignment Rate',   val: `${stats?.assignmentRate ?? 0}%`, icon: TrendingUp, bg:'bg-indigo-50',  fg:'text-indigo-600' },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Territory Distribution</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automatic lead routing by ZIP code · Real-time assignment tracking</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/dashboard/territories/map"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-medium rounded-xl hover:bg-gray-50">
            <Map className="w-4 h-4 text-violet-500"/> Territory Map
          </Link>
          <Link href="/dashboard/territories/assignments"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3A5C] text-white text-sm font-semibold rounded-xl hover:bg-[#24527a]">
            <Zap className="w-4 h-4"/> Live Assignments
          </Link>
        </div>
      </div>

      {/* Quick setup */}
      {!stats?.total && (
        <div className="card p-6 border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50">
          <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-500"/> Get Started with Territories
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Generate territories from your seeded locations. Each ZIP code becomes a purchasable territory.
          </p>
          {seedMsg && <p className="text-sm text-emerald-600 mb-3 font-medium">✓ {seedMsg}</p>}
          <button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60">
            {seedMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin"/> Seeding…</> : <><Map className="w-4 h-4"/> Seed Territories from Locations</>}
          </button>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(c => (
          <div key={c.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{c.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{c.val}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${c.bg}`}><c.icon className={`w-5 h-5 ${c.fg}`}/></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Navigation cards */}
        <div className="lg:col-span-2 space-y-3">
          {[
            { href:'/dashboard/territories',             icon:TrendingUp, label:'Overview',         desc:'Distribution stats and metrics',       color:'indigo' },
            { href:'/dashboard/territories/map',         icon:Map,        label:'Territory Map',    desc:'Visual territory management by state',  color:'violet' },
            { href:'/dashboard/territories/assignments', icon:Zap,        label:'Live Assignments', desc:'Real-time lead routing activity',       color:'emerald' },
            { href:'/dashboard/territories/analytics',   icon:TrendingUp, label:'Analytics',        desc:'Conversion rates by territory',         color:'blue' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="card p-4 flex items-center gap-4 hover:shadow-md transition-all group">
              <div className={`p-2.5 rounded-xl flex-shrink-0 bg-${item.color}-50 text-${item.color}-600`}>
                <item.icon className="w-5 h-5"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 group-hover:text-[#1B3A5C] transition-colors">{item.label}</div>
                <div className="text-xs text-gray-400 truncate">{item.desc}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1B3A5C] transition-colors flex-shrink-0"/>
            </Link>
          ))}
        </div>

        {/* Recent assignments + my territories */}
        <div className="lg:col-span-3 space-y-5">
          {/* My territories */}
          {territories.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">My Territories</h2>
                <Link href="/dashboard/territories/map" className="text-xs text-[#1B3A5C] hover:underline">Manage</Link>
              </div>
              <div className="grid gap-3">
                {territories.slice(0, 3).map((o: any) => (
                  <div key={o.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-9 h-9 bg-[#1B3A5C]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-[#1B3A5C]"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{o.territory.displayName}</div>
                      <div className="text-xs text-gray-400">{o.leadsReceived} leads · {o.leadsConverted} converted</div>
                    </div>
                    <div className="text-xs font-semibold text-emerald-600 flex-shrink-0">
                      {o.leadsReceived > 0 ? Math.round((o.leadsConverted / o.leadsReceived) * 100) : 0}% CVR
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending assignments */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Pending Assignments</h2>
              <Link href="/dashboard/territories/assignments" className="text-xs text-[#1B3A5C] hover:underline">View all</Link>
            </div>

            {assignments.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                No pending assignments — you're all caught up!
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map((a: any) => {
                  const lead = a.lead;
                  const cfg  = STATUS_CFG[a.status] ?? STATUS_CFG.ASSIGNED;
                  return (
                    <div key={a.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold ${TEMP_BG[lead?.temperature ?? 'COLD']} ${TEMP_COLOR[lead?.temperature ?? 'COLD']}`}>
                            {lead?.temperature === 'HOT' ? '🔥' : lead?.temperature === 'WARM' ? '⚡' : '❄️'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">
                              {lead?.firstName} {lead?.lastName}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {lead?.city}, {lead?.stateCode} {lead?.zipCode} · Score {lead?.score}
                            </div>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </div>
                      </div>

                      {a.status === 'ASSIGNED' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => acceptMutation.mutate(a.id)}
                            disabled={acceptMutation.isPending}
                            className="flex-1 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                            Accept Lead
                          </button>
                          <Link href={`/dashboard/leads/${a.leadId}`}
                            className="flex-1 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 text-center transition-colors">
                            View Details
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top territories table */}
      {stats?.topTerritories?.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Top Territories by Volume</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Territory','State','ZIP','Total Leads','Assigned','Owners'].map(h => (
                    <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.topTerritories.map((t: any) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{t.displayName}</td>
                    <td className="py-2.5 px-3 text-gray-600">{t.stateCode}</td>
                    <td className="py-2.5 px-3 font-mono text-gray-500">{t.zipCode ?? '—'}</td>
                    <td className="py-2.5 px-3 tabular-nums font-semibold text-gray-900">{t.totalLeads}</td>
                    <td className="py-2.5 px-3 tabular-nums text-gray-600">{t.totalAssigned}</td>
                    <td className="py-2.5 px-3 text-gray-600">{t._count?.ownerships ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
