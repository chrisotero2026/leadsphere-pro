'use client';
// src/app/dashboard/ai/scored/page.tsx
// All leads ranked by AI score — with filters, search, and quick actions

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import Link from 'next/link';
import {
  Brain, Search, Zap, PhoneCall, ChevronLeft, ChevronRight,
  Loader2, MessageSquare, TrendingUp, RefreshCw, Filter,
} from 'lucide-react';

const TEMP_CFG: Record<string, { emoji: string; pill: string }> = {
  HOT:  { emoji:'🔥', pill:'bg-red-100 text-red-700 border border-red-200' },
  WARM: { emoji:'⚡', pill:'bg-amber-100 text-amber-700 border border-amber-200' },
  COLD: { emoji:'❄️', pill:'bg-blue-100 text-blue-700 border border-blue-200' },
};

function MiniBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width:`${(value/max)*100}%` }}/>
    </div>
  );
}

export default function ScoredLeadsPage() {
  const qc = useQueryClient();
  const [page,      setPage]      = useState(1);
  const [temp,      setTemp]      = useState('');
  const [minScore,  setMinScore]  = useState(0);
  const [search,    setSearch]    = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ranked-leads', page, temp, minScore],
    queryFn:  () => aiApi.rankedLeads({
      page, limit: 25,
      ...(temp     && { temperature: temp }),
      ...(minScore && { minScore }),
    }).then(r => r.data),
  });

  const batchMut = useMutation({
    mutationFn: () => aiApi.batchScore('unscored'),
    onSuccess:  () => setTimeout(() => qc.invalidateQueries({ queryKey: ['ranked-leads'] }), 1500),
  });

  const rescoreMut = useMutation({
    mutationFn: (leadId: string) => aiApi.triggerScore(leadId, false),
  });

  const scores     = data?.data    ?? [];
  const pagination = data?.pagination ?? {};

  const filtered = search
    ? scores.filter((s: any) =>
        `${s.lead?.firstName} ${s.lead?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        s.lead?.city?.toLowerCase().includes(search.toLowerCase())
      )
    : scores;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600"/> AI-Scored Leads
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">All leads ranked by composite AI score</p>
        </div>
        <button onClick={() => batchMut.mutate()} disabled={batchMut.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl hover:bg-[#24527a] disabled:opacity-60">
          {batchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 text-amber-300"/>}
          Score Unscored Leads
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            placeholder="Search name or city…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>

        {/* Temperature filter */}
        <div className="flex gap-1.5">
          {[{ v:'', l:'All' },{ v:'HOT', l:'🔥 Hot' },{ v:'WARM', l:'⚡ Warm' },{ v:'COLD', l:'❄️ Cold' }].map(f => (
            <button key={f.v} onClick={() => { setTemp(f.v); setPage(1); }}
              className={`px-3 py-2 text-sm rounded-xl font-semibold transition-colors ${
                temp === f.v ? 'bg-[#1B3A5C] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{f.l}</button>
          ))}
        </div>

        {/* Min score */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400"/>
          <label className="text-sm text-gray-500">Min score:</label>
          <select className="text-sm border border-gray-200 rounded-xl px-2 py-2 focus:outline-none"
            value={minScore} onChange={e => { setMinScore(+e.target.value); setPage(1); }}>
            {[0, 25, 50, 70, 85].map(v => (
              <option key={v} value={v}>{v > 0 ? `≥ ${v}` : 'Any'}</option>
            ))}
          </select>
        </div>

        {pagination.total > 0 && (
          <span className="text-sm text-gray-400 ml-auto">{pagination.total} leads</span>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin"/> <span>Loading scored leads…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Brain className="w-12 h-12 mx-auto text-gray-200 mb-3"/>
            <p className="text-gray-500 font-semibold">No scored leads found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or score more leads</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Rank</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Lead</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Dimensions</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Best Action</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Close %</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: any, idx: number) => {
                  const rank   = (page - 1) * 25 + idx + 1;
                  const cfg    = TEMP_CFG[s.temperature] ?? TEMP_CFG.COLD;
                  const recs   = s.recommendations as string[] ?? [];
                  const lead   = s.lead;
                  const closePct = s.closeProbability
                    ? Math.round(Number(s.closeProbability) * 100)
                    : null;

                  return (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                      {/* Rank */}
                      <td className="py-3 px-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                          rank === 1 ? 'bg-amber-100 text-amber-700'
                          : rank <= 3 ? 'bg-orange-100 text-orange-600'
                          : 'bg-gray-100 text-gray-500'
                        }`}>#{rank}</div>
                      </td>

                      {/* Lead info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">
                            {lead?.firstName?.[0]}{lead?.lastName?.[0]}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/dashboard/leads/${lead?.id}`}
                              className="font-semibold text-gray-900 hover:text-indigo-600 truncate block max-w-[140px]">
                              {lead?.firstName} {lead?.lastName}
                            </Link>
                            <p className="text-xs text-gray-400 truncate">{lead?.city}, {lead?.stateCode} · {lead?.urgency?.replace('_',' ')}</p>
                          </div>
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="relative w-10 h-10 flex-shrink-0">
                            <svg viewBox="0 0 36 36" className="w-10 h-10" style={{ transform:'rotate(-90deg)' }}>
                              <circle cx="18" cy="18" r="14" fill="none" stroke="#f3f4f6" strokeWidth="4"/>
                              <circle cx="18" cy="18" r="14" fill="none"
                                stroke={s.totalScore >= 70 ? '#ef4444' : s.totalScore >= 45 ? '#f59e0b' : '#3b82f6'}
                                strokeWidth="4"
                                strokeDasharray={`${(s.totalScore / 100) * 87.96} 87.96`}
                                strokeLinecap="round"/>
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-black"
                              style={{ color: s.totalScore >= 70 ? '#ef4444' : s.totalScore >= 45 ? '#f59e0b' : '#3b82f6' }}>
                              {s.totalScore}
                            </span>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.pill}`}>
                            {cfg.emoji} {s.temperature}
                          </span>
                        </div>
                      </td>

                      {/* Dimension bars */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        <div className="space-y-1">
                          {[
                            { k:'urgencyScore',    c:'bg-red-400',   l:'U' },
                            { k:'budgetScore',     c:'bg-emerald-400',l:'B' },
                            { k:'intentScore',     c:'bg-blue-400',  l:'I' },
                          ].map(d => (
                            <div key={d.k} className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-300 w-3">{d.l}</span>
                              <MiniBar value={s[d.k] ?? 0} color={d.c}/>
                              <span className="text-xs text-gray-400 tabular-nums w-5">{s[d.k] ?? 0}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Top recommendation */}
                      <td className="py-3 px-4 hidden lg:table-cell max-w-[200px]">
                        <p className="text-xs text-gray-600 line-clamp-2">{recs[0] ?? '—'}</p>
                      </td>

                      {/* Close probability */}
                      <td className="py-3 px-4 hidden sm:table-cell">
                        {closePct !== null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${closePct >= 50 ? 'bg-emerald-500' : closePct >= 30 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width:`${closePct}%` }}/>
                            </div>
                            <span className="text-xs font-semibold text-gray-700">{closePct}%</span>
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {lead?.phone && (
                            <a href={`tel:${lead.phone}`}
                              className="p-2 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-200 text-gray-400 hover:text-green-600 transition-colors">
                              <PhoneCall className="w-3.5 h-3.5"/>
                            </a>
                          )}
                          <button onClick={() => rescoreMut.mutate(lead?.id)}
                            title="Re-score with AI"
                            className="p-2 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 text-gray-400 hover:text-indigo-600 transition-colors">
                            <RefreshCw className="w-3.5 h-3.5"/>
                          </button>
                          <Link href={`/dashboard/leads/${lead?.id}`}
                            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
                            <TrendingUp className="w-3.5 h-3.5"/>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4"/> Previous
            </button>
            <span className="text-sm text-gray-500">
              Page <strong>{page}</strong> of <strong>{pagination.pages}</strong>
            </span>
            <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
              Next <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
