'use client';
// src/app/dashboard/ai/agents/page.tsx

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import {
  Users, TrendingUp, TrendingDown, Star, Clock,
  Brain, ChevronDown, Loader2, PhoneCall, Target,
} from 'lucide-react';

const TREND_CFG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  STRONG:        { label:'⭐ Strong',   bg:'bg-emerald-100', text:'text-emerald-700', icon:TrendingUp   },
  AVERAGE:       { label:'📊 Average',  bg:'bg-amber-100',   text:'text-amber-700',   icon:TrendingUp   },
  NEEDS_COACHING:{ label:'📚 Coaching', bg:'bg-red-100',     text:'text-red-600',     icon:TrendingDown },
};

function StatPill({ label, value, color = 'text-gray-800' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="text-center px-3 py-2 bg-gray-50 rounded-xl">
      <p className={`text-lg font-black ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

function AgentCard({ agent, rank }: { agent: any; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const [coaching, setCoaching] = useState<any>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);

  const cfg      = TREND_CFG[agent.trend] ?? TREND_CFG.AVERAGE;
  const cvrPct   = Math.round(agent.conversionRate  * 100);
  const closePct = Math.round(agent.closeProbability * 100);
  const accPct   = Math.round((agent.acceptanceRate ?? 0) * 100);

  const loadCoaching = async () => {
    if (coaching) { setExpanded(e => !e); return; }
    setLoadingCoach(true);
    try {
      const r = await aiApi.agentCoaching(agent.agentId);
      setCoaching(r.data.data);
      setExpanded(true);
    } catch {
      setExpanded(e => !e);
    } finally {
      setLoadingCoach(false);
    }
  };

  return (
    <div className={`border-2 rounded-2xl overflow-hidden ${
      rank === 1 ? 'border-amber-300 shadow-lg shadow-amber-50' : 'border-gray-200'
    }`}>
      {/* Main row */}
      <div className="p-5 bg-white">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Rank + avatar */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${
              rank === 1 ? 'bg-amber-400 text-white'
              : rank === 2 ? 'bg-gray-300 text-gray-700'
              : rank === 3 ? 'bg-orange-300 text-white'
              : 'bg-gray-100 text-gray-500'
            }`}>#{rank}</div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center font-bold text-indigo-600 text-sm">
              {agent.agentName.split(' ').map((n: string) => n[0]).join('')}
            </div>
          </div>

          {/* Name + trend */}
          <div className="flex-1 min-w-[160px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900">{agent.agentName}</h3>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {agent.leadsAssigned} leads assigned · {agent.converted} converted
              {agent.avgResponseHrs != null && ` · avg ${agent.avgResponseHrs}h response`}
            </p>
          </div>

          {/* Stats row */}
          <div className="flex gap-2 flex-wrap">
            <StatPill label="CVR"     value={`${cvrPct}%`}   color={cvrPct >= 20 ? 'text-emerald-600' : cvrPct >= 10 ? 'text-amber-600' : 'text-red-500'}/>
            <StatPill label="Close %" value={`${closePct}%`} color={closePct >= 50 ? 'text-emerald-600' : 'text-gray-600'}/>
            <StatPill label="Revenue" value={`$${agent.estimatedRevenue.toLocaleString()}`} color="text-indigo-700"/>
          </div>

          {/* Coaching button */}
          <button onClick={loadCoaching} disabled={loadingCoach}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 border border-indigo-200 text-indigo-600 text-sm font-semibold rounded-xl hover:bg-indigo-50 disabled:opacity-60">
            {loadingCoach ? <Loader2 className="w-4 h-4 animate-spin"/> : <Brain className="w-4 h-4"/>}
            AI Coaching
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}/>
          </button>
        </div>

        {/* Progress bars */}
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          {[
            { label:'Conversion rate', value:cvrPct,   max:40, color:'bg-emerald-500' },
            { label:'Close probability', value:closePct, max:100, color:'bg-indigo-500' },
            { label:'Acceptance rate', value:accPct,  max:100, color:'bg-blue-400'   },
          ].map(bar => (
            <div key={bar.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">{bar.label}</span>
                <span className="font-semibold text-gray-700">{bar.value}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${bar.color} rounded-full`}
                  style={{ width:`${Math.min(100, (bar.value / bar.max) * 100)}%` }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Coaching panel */}
      {expanded && coaching && (
        <div className="border-t border-gray-100 p-5 bg-gradient-to-br from-indigo-50 to-violet-50 space-y-4">
          {coaching.coachingNotes && (
            <div>
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Brain className="w-3 h-3"/> AI Assessment
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{coaching.coachingNotes}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {coaching.strengthAreas?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">💪 Strengths</p>
                <ul className="space-y-1.5">
                  {coaching.strengthAreas.map((s: string, i: number) => (
                    <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-0.5">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {coaching.improvementAreas?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">🎯 Improve</p>
                <ul className="space-y-1.5">
                  {coaching.improvementAreas.map((s: string, i: number) => (
                    <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                      <span className="text-amber-500 font-bold mt-0.5">→</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-stats'],
    queryFn:  () => aiApi.agentStats().then(r => r.data.data),
    refetchInterval: 120000,
  });

  const agents = data ?? [];

  const strongCount  = agents.filter((a: any) => a.trend === 'STRONG').length;
  const coachCount   = agents.filter((a: any) => a.trend === 'NEEDS_COACHING').length;
  const totalRevenue = agents.reduce((s: number, a: any) => s + a.estimatedRevenue, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600"/> Agent Performance + AI Coaching
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Rankings, close probability, and AI-generated coaching</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Total Agents',   val:agents.length,                  color:'text-gray-900',    bg:'bg-gray-50' },
          { label:'⭐ Strong',      val:strongCount,                     color:'text-emerald-700', bg:'bg-emerald-50' },
          { label:'📚 Need Coaching',val:coachCount,                   color:'text-red-700',     bg:'bg-red-50' },
          { label:'Est. Revenue',   val:`$${totalRevenue.toLocaleString()}`, color:'text-indigo-700', bg:'bg-indigo-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.bg} border border-gray-100 text-center`}>
            <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Agent cards */}
      {isLoading ? (
        <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
      ) : agents.length === 0 ? (
        <div className="card py-16 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-500 font-semibold">No agent data yet</p>
          <p className="text-sm text-gray-400 mt-1">Assign leads to agents to start tracking performance</p>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent: any, i: number) => (
            <AgentCard key={agent.agentId} agent={agent} rank={i + 1}/>
          ))}
        </div>
      )}
    </div>
  );
}
