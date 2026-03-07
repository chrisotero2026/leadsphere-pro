'use client';
// src/components/ai/LeadScoreCard.tsx
//
// Drop-in score card for any lead detail view.
// Shows the full AI analysis: score, dimensions, script, recommendations.
//
// Usage:
//   import { LeadScoreCard } from '@/components/ai/LeadScoreCard';
//   <LeadScoreCard leadId={lead.id} />

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import {
  Brain, Zap, PhoneCall, AlertTriangle,
  CheckCircle, ChevronDown, Copy, Check,
  Loader2, RefreshCw, MessageSquare,
} from 'lucide-react';

const DIM_LABELS: Record<string, string> = {
  urgencyScore:    'Urgency',
  budgetScore:     'Budget',
  intentScore:     'Intent',
  engagementScore: 'Engagement',
  creditScore:     'Credit Signal',
  timelineScore:   'Timeline',
};

const DIM_COLORS: Record<string, string> = {
  urgencyScore:    'bg-red-400',
  budgetScore:     'bg-emerald-400',
  intentScore:     'bg-blue-400',
  engagementScore: 'bg-violet-400',
  creditScore:     'bg-amber-400',
  timelineScore:   'bg-indigo-400',
};

function ScoreGauge({ score, temperature }: { score: number; temperature: string }) {
  const r     = 44;
  const circ  = 2 * Math.PI * r;
  const fill  = (score / 100) * circ;
  const color = temperature === 'HOT' ? '#ef4444' : temperature === 'WARM' ? '#f59e0b' : '#3b82f6';
  const emoji = temperature === 'HOT' ? '🔥' : temperature === 'WARM' ? '⚡' : '❄️';

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={100} height={100} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={50} cy={50} r={r} fill="none" stroke="#f3f4f6" strokeWidth={8}/>
          <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
            style={{ transition:'stroke-dasharray .6s ease' }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ transform:'none' }}>
          <span style={{ color, fontSize:22, fontWeight:900, lineHeight:1 }}>{score}</span>
          <span style={{ fontSize:10, color:'#9ca3af', fontWeight:600 }}>/ 100</span>
        </div>
      </div>
      <span className="text-sm font-bold mt-1" style={{ color }}>
        {emoji} {temperature}
      </span>
    </div>
  );
}

export function LeadScoreCard({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const [showScript, setShowScript]       = useState(false);
  const [showHandlers, setShowHandlers]   = useState(false);
  const [copied, setCopied]               = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['lead-score', leadId],
    queryFn:  () => aiApi.getScore(leadId).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const rescoreMut = useMutation({
    mutationFn: () => aiApi.triggerScore(leadId, true),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['lead-score', leadId] }),
  });

  const followUpMut = useMutation({
    mutationFn: () => aiApi.createFollowUp(leadId, 'manual'),
  });

  const copyScript = () => {
    if (data?.callScript) {
      navigator.clipboard.writeText(data.callScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return (
    <div className="card p-6 flex items-center justify-center gap-2 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin"/>
      <span className="text-sm">Loading AI analysis…</span>
    </div>
  );

  if (!data) return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-500"/> AI Score
        </h3>
        <button onClick={() => rescoreMut.mutate()} disabled={rescoreMut.isPending}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-60">
          {rescoreMut.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>}
          Score Now
        </button>
      </div>
      <p className="text-sm text-gray-400 text-center py-4">
        No AI analysis yet. Click "Score Now" to analyze this lead.
      </p>
    </div>
  );

  const dims = [
    'urgencyScore','budgetScore','intentScore','engagementScore','creditScore','timelineScore'
  ] as const;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-500"/> AI Lead Analysis
          </h3>
          <button onClick={() => rescoreMut.mutate()} disabled={rescoreMut.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 disabled:opacity-60">
            {rescoreMut.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
            Re-score
          </button>
        </div>

        <div className="flex items-center gap-6">
          <ScoreGauge score={data.totalScore} temperature={data.temperature}/>
          <div className="flex-1 min-w-0">
            {data.summary && (
              <p className="text-sm text-gray-600 leading-relaxed mb-3 italic">"{data.summary}"</p>
            )}
            <div className="flex flex-wrap gap-2">
              {data.productMatch && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-semibold">
                  {data.productMatch.replace(/_/g,' ')}
                </span>
              )}
              {data.closeProbability && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
                  {Math.round(Number(data.closeProbability) * 100)}% close prob
                </span>
              )}
              {data.estimatedDaysToClose && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">
                  ~{data.estimatedDaysToClose}d to close
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="px-5 py-4 border-b border-gray-100 space-y-2.5">
        {dims.map(dim => {
          const val = Number((data as any)[dim] ?? 0);
          return (
            <div key={dim} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 flex-shrink-0">{DIM_LABELS[dim]}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${DIM_COLORS[dim]}`} style={{ width:`${val}%` }}/>
              </div>
              <span className="text-xs font-bold text-gray-700 w-7 text-right">{val}</span>
            </div>
          );
        })}
      </div>

      {/* Strengths + Risks */}
      <div className="px-5 py-4 border-b border-gray-100 grid sm:grid-cols-2 gap-4">
        {(data.strengths as string[])?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Strengths</p>
            <ul className="space-y-1.5">
              {(data.strengths as string[]).map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0"/>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(data.risks as string[])?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Watch For</p>
            <ul className="space-y-1.5">
              {(data.risks as string[]).map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0"/>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {(data.recommendations as string[])?.length > 0 && (
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Next Actions</p>
          <ol className="space-y-1.5">
            {(data.recommendations as string[]).map((r: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Call Script */}
      {data.callScript && (
        <div className="px-5 py-4 border-b border-gray-100">
          <button onClick={() => setShowScript(s => !s)}
            className="flex items-center justify-between w-full text-left">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <PhoneCall className="w-3 h-3 text-green-500"/> AI Call Script
            </p>
            <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${showScript ? 'rotate-180' : ''}`}/>
          </button>
          {showScript && (
            <div className="mt-3">
              <div className="relative px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 leading-relaxed italic">
                "{data.callScript}"
                <button onClick={copyScript}
                  className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-gray-700">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500"/> : <Copy className="w-3.5 h-3.5"/>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Objection Handlers */}
      {data.objectionHandlers && Object.keys(data.objectionHandlers).length > 0 && (
        <div className="px-5 py-4 border-b border-gray-100">
          <button onClick={() => setShowHandlers(s => !s)}
            className="flex items-center justify-between w-full text-left">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-blue-500"/> Objection Handlers
            </p>
            <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${showHandlers ? 'rotate-180' : ''}`}/>
          </button>
          {showHandlers && (
            <div className="mt-3 space-y-3">
              {Object.entries(data.objectionHandlers).map(([obj, resp]: any) => (
                <div key={obj} className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500">
                    "{obj}"
                  </div>
                  <div className="px-3 py-2 text-xs text-gray-700 leading-relaxed">
                    → {resp}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Follow-up action */}
      <div className="px-5 py-4">
        <button onClick={() => followUpMut.mutate()} disabled={followUpMut.isPending || followUpMut.isSuccess}
          className="w-full py-2.5 border border-indigo-200 text-indigo-600 text-sm font-bold rounded-xl hover:bg-indigo-50 disabled:opacity-60 transition-colors">
          {followUpMut.isPending ? 'Creating sequence…'
          : followUpMut.isSuccess ? '✓ Follow-up sequence created'
          : '📨 Create AI Follow-up Sequence'}
        </button>
      </div>
    </div>
  );
}