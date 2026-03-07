'use client';
// src/app/dashboard/ai/page.tsx
// AI Intelligence Command Center

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import Link from 'next/link';
import {
  Brain, Zap, TrendingUp, Target, Users,
  AlertTriangle, CheckCircle, Clock, PhoneCall,
  ArrowRight, Loader2, RefreshCw, Eye, BarChart2,
  MapPin, ChevronRight, Star, Bot,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────

const TEMP_COLOR: Record<string, string> = {
  HOT:  'text-red-600 bg-red-50 border-red-200',
  WARM: 'text-amber-600 bg-amber-50 border-amber-200',
  COLD: 'text-blue-600 bg-blue-50 border-blue-200',
};
const TEMP_EMOJI: Record<string, string> = { HOT: '🔥', WARM: '⚡', COLD: '❄️' };

const SEVERITY_CFG: Record<string, { border: string; icon: any; iconColor: string }> = {
  URGENT:   { border:'border-red-200 bg-red-50',    icon:AlertTriangle, iconColor:'text-red-500' },
  WARNING:  { border:'border-amber-200 bg-amber-50', icon:AlertTriangle, iconColor:'text-amber-500' },
  INFO:     { border:'border-blue-200 bg-blue-50',   icon:Brain,         iconColor:'text-blue-500' },
  CRITICAL: { border:'border-red-300 bg-red-100',    icon:AlertTriangle, iconColor:'text-red-700' },
};

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r     = (size - 8) / 2;
  const circ  = 2 * Math.PI * r;
  const fill  = ((score / 100) * circ);
  const color = score >= 70 ? '#ef4444' : score >= 45 ? '#f59e0b' : '#3b82f6';

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"/>
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fill: color, fontSize: size * 0.22, fontWeight: 800, transform: 'rotate(90deg)', transformOrigin:'50% 50%' }}>
        {score}
      </text>
    </svg>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color, bg, href }: any) {
  return (
    <Link href={href ?? '#'} className={`card p-5 hover:shadow-md transition-all ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-3xl font-black text-gray-900 mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${bg}`}><Icon className={`w-5 h-5 ${color}`}/></div>
      </div>
    </Link>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function AiDashboardPage() {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ai-dashboard'],
    queryFn:  () => aiApi.dashboard().then(r => r.data.data),
    refetchInterval: 60000,
  });

  const batchScoreMut = useMutation({
    mutationFn: () => aiApi.batchScore('unscored'),
    onSuccess:  () => setTimeout(() => qc.invalidateQueries({ queryKey: ['ai-dashboard'] }), 2000),
  });

  const markInsightRead = useMutation({
    mutationFn: (id: string) => aiApi.markRead(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ai-dashboard'] }),
  });

  if (isLoading) return (
    <div className="py-20 text-center">
      <Bot className="w-12 h-12 mx-auto text-gray-200 mb-3 animate-pulse"/>
      <p className="text-gray-400 font-medium">Loading AI Intelligence…</p>
    </div>
  );

  const kpis       = data?.kpis ?? {};
  const dist       = data?.scoreDistribution ?? {};
  const revenue    = data?.revenue ?? {};
  const insights   = data?.insights ?? [];
  const topScores  = data?.recentHighScores ?? [];
  const agents     = data?.agentRankings ?? [];
  const territories= data?.topTerritories ?? [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-7 h-7 text-indigo-600"/> AI Intelligence Center
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Powered by GPT-4o · Auto-updates every 60s
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => batchScoreMut.mutate()} disabled={batchScoreMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-60">
            {batchScoreMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 text-amber-500"/>}
            Score All Leads
          </button>
          <button onClick={() => refetch()}
            className="p-2 border border-gray-200 bg-white rounded-xl hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-400"/>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Leads"     value={kpis.totalLeads ?? 0}     sub="In system"                      icon={Users}      color="text-indigo-600" bg="bg-indigo-50"  href="/dashboard/leads"/>
        <KpiCard label="Avg AI Score"    value={`${kpis.avgScore ?? 0}/100`} sub="All scored leads"            icon={Brain}      color="text-violet-600" bg="bg-violet-50" href="/dashboard/ai/scored"/>
        <KpiCard label="Conversion Rate" value={kpis.conversionRate ?? '0%'} sub={`${kpis.conversions ?? 0} converted`} icon={Target} color="text-emerald-600" bg="bg-emerald-50" href="/dashboard/analytics"/>
        <KpiCard label="Revenue Forecast" value={`$${Number(revenue.predictedRevenue ?? 0).toLocaleString()}`} sub="Next 30 days (predicted)" icon={TrendingUp} color="text-blue-600" bg="bg-blue-50" href="/dashboard/ai/predictions"/>
      </div>

      {/* Score distribution + Insights */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Score Distribution */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500"/> Lead Temperature
          </h2>
          <div className="space-y-3">
            {[
              { label:'🔥 Hot (70-100)', val:dist.hot ?? 0,      pct: Math.round(((dist.hot ?? 0) / (kpis.totalLeads || 1)) * 100), color:'bg-red-500' },
              { label:'⚡ Warm (45-69)', val:dist.warm ?? 0,     pct: Math.round(((dist.warm ?? 0) / (kpis.totalLeads || 1)) * 100), color:'bg-amber-400' },
              { label:'❄️ Cold (0-44)',  val:dist.cold ?? 0,     pct: Math.round(((dist.cold ?? 0) / (kpis.totalLeads || 1)) * 100), color:'bg-blue-400' },
              { label:'⬜ Unscored',     val:dist.unscored ?? 0, pct: Math.round(((dist.unscored ?? 0) / (kpis.totalLeads || 1)) * 100), color:'bg-gray-300' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 font-medium">{item.label}</span>
                  <span className="font-bold text-gray-800 tabular-nums">{item.val.toLocaleString()} <span className="text-gray-400 font-normal text-xs">({item.pct}%)</span></span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width:`${item.pct}%` }}/>
                </div>
              </div>
            ))}
          </div>

          {(dist.unscored ?? 0) > 0 && (
            <button onClick={() => batchScoreMut.mutate()} disabled={batchScoreMut.isPending}
              className="mt-4 w-full py-2 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-60">
              {batchScoreMut.isPending ? 'Queuing…' : `Score ${dist.unscored} unscored leads`}
            </button>
          )}
        </div>

        {/* AI Insights */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-500"/> AI Insights
            </h2>
            {insights.length > 0 && (
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-bold">
                {insights.filter((i: any) => !i.isRead).length} new
              </span>
            )}
          </div>

          {insights.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-200 mb-2"/>
              <p className="text-gray-400 text-sm">No active insights — system is healthy</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {insights.map((insight: any) => {
                const cfg   = SEVERITY_CFG[insight.severity] ?? SEVERITY_CFG.INFO;
                const SIcon = cfg.icon;
                return (
                  <div key={insight.id}
                    onClick={() => !insight.isRead && markInsightRead.mutate(insight.id)}
                    className={`flex gap-3 p-3.5 rounded-xl border cursor-pointer transition-opacity ${cfg.border} ${insight.isRead ? 'opacity-60' : ''}`}>
                    <SIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.iconColor}`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{insight.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{insight.body}</p>
                      {insight.actionUrl && (
                        <Link href={insight.actionUrl}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 mt-1.5 hover:underline">
                          {insight.actionLabel ?? 'View'} <ChevronRight className="w-3 h-3"/>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hot Leads + Agent Rankings */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Top Scored Leads */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Star className="w-4 h-4 text-red-500"/> Top Scored Leads
            </h2>
            <Link href="/dashboard/ai/scored" className="text-xs font-semibold text-indigo-600 hover:underline">
              View all →
            </Link>
          </div>

          {topScores.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No hot leads yet</p>
          ) : (
            <div className="space-y-3">
              {topScores.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3">
                  <ScoreRing score={s.totalScore} size={48}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {s.lead?.firstName} {s.lead?.lastName}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border font-semibold ${TEMP_COLOR[s.temperature]}`}>
                        {TEMP_EMOJI[s.temperature]} {s.temperature}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {s.lead?.city} · {s.lead?.urgency?.replace('_',' ')}
                    </p>
                  </div>
                  {s.lead?.phone && (
                    <a href={`tel:${s.lead.phone}`}
                      className="p-2 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-200">
                      <PhoneCall className="w-4 h-4 text-green-600"/>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <Link href="/dashboard/ai/call-queue"
            className="mt-4 flex items-center justify-center gap-2 py-2.5 w-full border border-indigo-200 text-indigo-600 text-sm font-bold rounded-xl hover:bg-indigo-50">
            <PhoneCall className="w-4 h-4"/> Open Priority Call Queue
          </Link>
        </div>

        {/* Agent Rankings */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500"/> Agent Rankings
            </h2>
            <Link href="/dashboard/ai/agents" className="text-xs font-semibold text-indigo-600 hover:underline">
              Full report →
            </Link>
          </div>

          {agents.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No agent data yet</p>
          ) : (
            <div className="space-y-3">
              {agents.slice(0,5).map((a: any, idx: number) => (
                <div key={a.agentId} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black ${
                    idx === 0 ? 'bg-amber-100 text-amber-700'
                    : idx === 1 ? 'bg-gray-100 text-gray-600'
                    : idx === 2 ? 'bg-orange-100 text-orange-600'
                    : 'bg-gray-50 text-gray-400'
                  }`}>#{a.rank}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{a.agentName}</p>
                      <span className={`text-xs font-bold ${
                        a.trend === 'STRONG' ? 'text-emerald-600'
                        : a.trend === 'AVERAGE' ? 'text-amber-600'
                        : 'text-red-500'
                      }`}>{Math.round(a.conversionRate * 100)}% CVR</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          a.trend === 'STRONG' ? 'bg-emerald-500'
                          : a.trend === 'AVERAGE' ? 'bg-amber-400'
                          : 'bg-red-400'
                        }`} style={{ width:`${Math.round(a.closeProbability * 100)}%` }}/>
                      </div>
                      <span className="text-xs text-gray-400 tabular-nums">{Math.round(a.closeProbability * 100)}% close</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Territory Performance */}
      {territories.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-violet-500"/> Territory Intelligence
            </h2>
            <Link href="/dashboard/ai/territories" className="text-xs font-semibold text-indigo-600 hover:underline">
              Full map →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Territory','Leads','Converted','CVR','Avg Score','Revenue','Trend'].map(h => (
                    <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {territories.slice(0, 8).map((t: any) => (
                  <tr key={t.territoryId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900 truncate max-w-[150px]">{t.displayName}</td>
                    <td className="py-2.5 px-3 text-gray-600 tabular-nums">{t.totalLeads}</td>
                    <td className="py-2.5 px-3 text-gray-600 tabular-nums">{t.converted}</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-600">{Math.round(t.conversionRate * 100)}%</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        t.avgScore >= 70 ? 'bg-red-100 text-red-600'
                        : t.avgScore >= 45 ? 'bg-amber-100 text-amber-600'
                        : 'bg-blue-100 text-blue-600'
                      }`}>{t.avgScore}</span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-800">${t.estimatedRevenue.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-bold flex items-center gap-1 ${
                        t.trend === 'GROWING'   ? 'text-emerald-600'
                        : t.trend === 'DECLINING' ? 'text-red-500'
                        : 'text-gray-400'
                      }`}>
                        {t.trend === 'GROWING' ? '↑' : t.trend === 'DECLINING' ? '↓' : '→'}
                        {t.trend} {t.trendPct !== 0 ? `${t.trendPct > 0 ? '+' : ''}${t.trendPct}%` : ''}
                      </span>
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
