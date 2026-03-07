'use client';
// src/app/dashboard/territories/analytics/page.tsx

import { useQuery } from '@tanstack/react-query';
import { assignmentsApi, territoriesApi } from '@/lib/territoryApi';
import {
  TrendingUp, DollarSign, MapPin, Users,
  CheckCircle, XCircle, Clock, Zap,
  BarChart2, Loader2,
} from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; bg: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${bg}`}><Icon className={`w-5 h-5 ${color}`}/></div>
      </div>
    </div>
  );
}

function ProgressBar({ value, color = 'bg-indigo-500' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }}/>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dist-stats-analytics'],
    queryFn:  () => assignmentsApi.stats().then(r => r.data.data),
    refetchInterval: 60000,
  });

  const { data: territoriesData } = useQuery({
    queryKey: ['territories-analytics'],
    queryFn:  () => territoriesApi.list({ limit: 20, sortBy:'totalAssigned', sortDir:'desc' }).then(r => r.data),
  });

  const { data: unassignedData } = useQuery({
    queryKey: ['unassigned-analytics'],
    queryFn:  () => assignmentsApi.unassigned({ limit: 5 }).then(r => r.data),
  });

  const stats = statsData;
  const territories = territoriesData?.data ?? [];
  const unassigned  = unassignedData?.data ?? [];

  const assignRate  = stats?.assignmentRate ?? 0;
  const rejectedEst = stats?.total ? Math.round(stats.total * 0.05) : 0; // estimate

  // Estimated monthly revenue from owned territories
  const monthlyRevEstimate = territories
    .filter((t: any) => t.ownerships?.some((o: any) => o.isActive))
    .reduce((sum: number, t: any) => sum + (t.monthlyPrice ?? 0), 0);

  const metricCards = [
    { label:'Assignment Rate',   value:`${assignRate}%`,    sub:'Leads matched to territory', icon:TrendingUp,   color:'text-indigo-600',  bg:'bg-indigo-50' },
    { label:'Assigned Leads',    value: stats?.assigned ?? 0, sub:'Active in pipeline',      icon:CheckCircle,  color:'text-emerald-600', bg:'bg-emerald-50' },
    { label:'Unassigned Leads',  value: stats?.unassigned ?? 0, sub:'Need territory or sale', icon:MapPin,       color:'text-amber-600',   bg:'bg-amber-50' },
    { label:'Monthly Revenue',   value:`$${monthlyRevEstimate.toLocaleString()}`, sub:'From territory subscriptions', icon:DollarSign, color:'text-violet-600', bg:'bg-violet-50' },
  ];

  if (statsLoading) return (
    <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Territory Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Distribution performance, conversion rates, and revenue tracking</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(c => <StatCard key={c.label} {...c}/>)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Assignment funnel */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500"/> Assignment Funnel
          </h2>
          <div className="space-y-4">
            {[
              { label:'Total Leads',  val: stats?.total ?? 0,     color:'bg-gray-400', pct:100 },
              { label:'Assigned',     val: stats?.assigned ?? 0,  color:'bg-indigo-500', pct: stats?.total ? Math.round(((stats.assigned??0) / stats.total) * 100) : 0 },
              { label:'Unassigned',   val: stats?.unassigned ?? 0,color:'bg-amber-400', pct: stats?.total ? Math.round(((stats.unassigned??0) / stats.total) * 100) : 0 },
              { label:'Expired',      val: stats?.expired ?? 0,   color:'bg-red-300',  pct: stats?.total ? Math.round(((stats.expired??0) / stats.total) * 100) : 0 },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 font-medium">{item.label}</span>
                  <span className="font-bold text-gray-900 tabular-nums">{item.val.toLocaleString()} <span className="text-gray-400 font-normal text-xs">({item.pct}%)</span></span>
                </div>
                <ProgressBar value={item.pct} color={item.color}/>
              </div>
            ))}
          </div>
        </div>

        {/* Top territories by volume */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-violet-500"/> Top Territories by Volume
          </h2>

          {territories.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              No territories with assignments yet
            </div>
          ) : (
            <div className="space-y-3">
              {territories.slice(0, 8).map((t: any) => {
                const activeOwners = t.ownerships?.filter((o: any) => o.isActive) ?? [];
                const cvr = activeOwners.reduce((s: number, o: any) => s + o.leadsConverted, 0);
                const lrx = activeOwners.reduce((s: number, o: any) => s + o.leadsReceived, 0);
                const cvrPct = lrx > 0 ? Math.round((cvr / lrx) * 100) : 0;
                const maxLeads = territories[0]?.totalAssigned || 1;
                const barPct = Math.round((t.totalAssigned / maxLeads) * 100);

                return (
                  <div key={t.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-900 truncate">{t.displayName}</span>
                        {activeOwners.length > 0 && (
                          <span className="flex-shrink-0 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">
                            <Users className="w-2.5 h-2.5 inline mr-0.5"/>{activeOwners.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                        <span className="text-gray-500 tabular-nums">{t.totalAssigned} leads</span>
                        {cvrPct > 0 && (
                          <span className="text-emerald-600 font-bold">{cvrPct}% CVR</span>
                        )}
                        {t.monthlyPrice && (
                          <span className="text-violet-600 font-semibold">${t.monthlyPrice}/mo</span>
                        )}
                      </div>
                    </div>
                    <ProgressBar value={barPct} color={cvrPct > 20 ? 'bg-emerald-500' : cvrPct > 10 ? 'bg-blue-500' : 'bg-indigo-400'}/>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unassigned leads — revenue opportunity */}
      {unassigned.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500"/> Revenue Opportunity — Unassigned Leads
            </h2>
            <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
              {stats?.unassigned ?? 0} leads need a territory
            </span>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            These leads have no territory owner. Create or sell territories for these ZIP codes to capture revenue.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Lead','Location','Score','Urgency','Assigned At'].map(h => (
                    <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unassigned.map((a: any) => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      {a.lead?.firstName} {a.lead?.lastName}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {a.lead?.city}, {a.lead?.stateCode} <span className="font-mono text-xs">{a.lead?.zipCode}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold text-sm ${
                        (a.lead?.score ?? 0) >= 70 ? 'text-red-500'
                        : (a.lead?.score ?? 0) >= 40 ? 'text-amber-500' : 'text-blue-500'
                      }`}>{a.lead?.score}</span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">{a.lead?.urgency?.replace('_',' ')}</td>
                    <td className="py-2.5 px-3 text-gray-400 text-xs">
                      {new Date(a.assignedAt).toLocaleDateString()}
                    </td>
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
