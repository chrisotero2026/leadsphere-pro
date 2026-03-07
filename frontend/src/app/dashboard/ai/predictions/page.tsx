'use client';
// src/app/dashboard/ai/predictions/page.tsx

import { useQuery } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import { Loader2, TrendingUp, TrendingDown, Minus, DollarSign, Target, Users, MapPin } from 'lucide-react';

function ForecastCard({ days, forecast }: { days: number; forecast: any }) {
  const rev  = forecast?.predictedRevenue ?? 0;
  const low  = forecast?.confidenceLow    ?? 0;
  const high = forecast?.confidenceHigh   ?? 0;
  const conf = forecast?.confidence       ?? 0;
  const trend = forecast?.monthlyTrend    ?? [];

  const maxTrend = Math.max(...trend, 1);

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Revenue Forecast</p>
          <p className="text-xs text-gray-400">{days}-day projection</p>
        </div>
        <div className="p-2.5 bg-emerald-50 rounded-xl">
          <DollarSign className="w-5 h-5 text-emerald-600"/>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-4xl font-black text-gray-900">${rev.toLocaleString()}</p>
        <p className="text-sm text-gray-400 mt-1">
          Range: <span className="font-semibold text-gray-600">${low.toLocaleString()} – ${high.toLocaleString()}</span>
        </p>
      </div>

      {/* Confidence */}
      <div className="mb-5">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-500">Model confidence</span>
          <span className="font-bold text-gray-700">{conf}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${conf >= 70 ? 'bg-emerald-500' : conf >= 50 ? 'bg-amber-400' : 'bg-gray-400'}`}
            style={{ width:`${conf}%` }}/>
        </div>
      </div>

      {/* Mini trend chart */}
      {trend.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Monthly trend</p>
          <div className="flex items-end gap-1.5 h-16">
            {trend.map((v: number, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="w-full rounded-t-sm bg-indigo-400 min-h-[3px] transition-all"
                  style={{ height:`${Math.round((v / maxTrend) * 100)}%` }}/>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-300 mt-1">
            <span>{trend.length} mo ago</span>
            <span>This month</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PredictionsPage() {
  const { data: rev30,   isLoading: l30  } = useQuery({ queryKey:['forecast-30'],  queryFn: () => aiApi.revenueForecast(30).then(r => r.data.data) });
  const { data: rev90,   isLoading: l90  } = useQuery({ queryKey:['forecast-90'],  queryFn: () => aiApi.revenueForecast(90).then(r => r.data.data) });
  const { data: agents,  isLoading: lAgents } = useQuery({ queryKey:['agent-stats-pred'], queryFn: () => aiApi.agentStats().then(r => r.data.data) });
  const { data: territories } = useQuery({ queryKey:['territory-pred'], queryFn: () => aiApi.territoryStats().then(r => r.data.data) });

  const topTerritories = [...(territories ?? [])].sort((a: any, b: any) => b.estimatedRevenue - a.estimatedRevenue).slice(0, 8);
  const agentList = agents ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-600"/> Predictive Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Revenue forecasts, agent projections, and territory intelligence</p>
      </div>

      {/* Revenue Forecasts */}
      <div className="grid sm:grid-cols-2 gap-5">
        {l30 ? (
          <div className="card p-6 flex items-center justify-center h-52">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300"/>
          </div>
        ) : <ForecastCard days={30} forecast={rev30}/>}

        {l90 ? (
          <div className="card p-6 flex items-center justify-center h-52">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300"/>
          </div>
        ) : <ForecastCard days={90} forecast={rev90}/>}
      </div>

      {/* Agent Close Probability */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500"/> Agent Close Probability Ranking
        </h2>

        {lAgents ? (
          <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-300"/></div>
        ) : agentList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No agent data yet — assign leads to agents to see rankings</p>
        ) : (
          <div className="space-y-4">
            {agentList.map((a: any) => {
              const closePct = Math.round(a.closeProbability * 100);
              const cvrPct   = Math.round(a.conversionRate  * 100);
              return (
                <div key={a.agentId} className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 ${
                    a.rank === 1 ? 'bg-amber-100 text-amber-700'
                    : a.rank === 2 ? 'bg-gray-100 text-gray-600'
                    : a.rank === 3 ? 'bg-orange-100 text-orange-600'
                    : 'bg-gray-50 text-gray-400'
                  }`}>#{a.rank}</div>

                  {/* Name + bars */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">{a.agentName}</span>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                        <span className="text-gray-400">{a.leadsAssigned} leads</span>
                        <span className="font-bold text-emerald-600">${a.estimatedRevenue.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 items-center">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-20">Close prob</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${closePct >= 50 ? 'bg-emerald-500' : closePct >= 30 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width:`${closePct}%` }}/>
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-9 text-right">{closePct}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-20">CVR</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-blue-400" style={{ width:`${cvrPct}%` }}/>
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-9 text-right">{cvrPct}%</span>
                        </div>
                      </div>

                      <div className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${
                        a.trend === 'STRONG'         ? 'bg-emerald-100 text-emerald-700'
                        : a.trend === 'AVERAGE'      ? 'bg-amber-100 text-amber-700'
                        : a.trend === 'NEEDS_COACHING'? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.trend === 'STRONG'          ? '⭐ Strong'
                        : a.trend === 'AVERAGE'        ? '📊 Average'
                        : a.trend === 'NEEDS_COACHING' ? '📚 Coach'
                        : a.trend}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Territory Revenue Potential */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-violet-500"/> Territory Revenue Potential
        </h2>

        {topTerritories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No territory data yet</p>
        ) : (
          <div className="space-y-3">
            {topTerritories.map((t: any, i: number) => {
              const maxRev = topTerritories[0].estimatedRevenue || 1;
              const pct    = Math.round((t.estimatedRevenue / maxRev) * 100);
              const TrendIcon = t.trend === 'GROWING' ? TrendingUp : t.trend === 'DECLINING' ? TrendingDown : Minus;
              const trendColor = t.trend === 'GROWING' ? 'text-emerald-500' : t.trend === 'DECLINING' ? 'text-red-400' : 'text-gray-400';

              return (
                <div key={t.territoryId} className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 font-mono w-5 flex-shrink-0">#{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate">{t.displayName}</span>
                        <TrendIcon className={`w-3.5 h-3.5 flex-shrink-0 ${trendColor}`}/>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                        <span className="text-gray-400">{t.totalLeads} leads · {Math.round(t.conversionRate * 100)}% CVR</span>
                        <span className="font-bold text-gray-800">${t.estimatedRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct > 60 ? 'bg-violet-500' : 'bg-violet-300'}`}
                        style={{ width:`${pct}%` }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
