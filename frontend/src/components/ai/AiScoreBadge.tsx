'use client';
// src/components/ai/AiScoreBadge.tsx
//
// Drop-in badge for any lead list, table row, or card.
// Shows score + temperature + click-to-expand summary.
//
// Usage:
//   <AiScoreBadge leadId={lead.id} score={lead.score} temperature={lead.temperature}/>

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import { Brain, ChevronDown, Loader2 } from 'lucide-react';

interface AiScoreBadgeProps {
  leadId:      string;
  score?:      number;          // if already known (from lead.score)
  temperature?: string;         // if already known
  size?:       'sm' | 'md';
  showPopover?: boolean;        // expand on click for mini-summary
}

const TEMP_COLOR: Record<string, string> = {
  HOT:  '#ef4444',
  WARM: '#f59e0b',
  COLD: '#3b82f6',
};

const TEMP_EMOJI: Record<string, string> = {
  HOT: '🔥', WARM: '⚡', COLD: '❄️',
};

export function AiScoreBadge({
  leadId, score, temperature, size = 'md', showPopover = true,
}: AiScoreBadgeProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['lead-score-badge', leadId],
    queryFn:  () => aiApi.getScore(leadId).then(r => r.data.data),
    enabled:  open || (score == null), // fetch lazily or if no score provided
    staleTime:5 * 60 * 1000,
  });

  const displayScore = score ?? data?.totalScore;
  const displayTemp  = temperature ?? data?.temperature ?? 'COLD';
  const color        = TEMP_COLOR[displayTemp] ?? TEMP_COLOR.COLD;

  if (displayScore == null && !isLoading) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400 border border-dashed border-gray-200 px-2 py-1 rounded-lg">
        <Brain className="w-3 h-3"/> No score
      </span>
    );
  }

  const ringSize = size === 'sm' ? 28 : 36;
  const r        = (ringSize - 4) / 2;
  const circ     = 2 * Math.PI * r;
  const fill     = ((displayScore ?? 0) / 100) * circ;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => showPopover && setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 ${showPopover ? 'cursor-pointer' : 'cursor-default'}`}
        title={`AI Score: ${displayScore}/100 — ${displayTemp}`}>

        {/* Mini ring */}
        <svg width={ringSize} height={ringSize} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
          <circle cx={ringSize/2} cy={ringSize/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={3}/>
          <circle cx={ringSize/2} cy={ringSize/2} r={r} fill="none" stroke={color} strokeWidth={3}
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"/>
          {/* Score text via foreignObject won't work in SVG well — use overlay div */}
        </svg>
        <span className={`font-black tabular-nums ${size === 'sm' ? 'text-xs' : 'text-sm'}`} style={{ color }}>
          {isLoading ? '…' : displayScore}
        </span>

        {size !== 'sm' && (
          <span className="text-xs font-semibold" style={{ color }}>
            {TEMP_EMOJI[displayTemp]}
          </span>
        )}

        {showPopover && (
          <ChevronDown className={`w-3 h-3 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`}/>
        )}
      </button>

      {/* Popover */}
      {open && showPopover && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}/>
          <div className="absolute top-8 left-0 z-40 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl p-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin"/> Loading analysis…
              </div>
            ) : data ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div style={{ color }} className="text-3xl font-black tabular-nums">{data.totalScore}</div>
                  <div>
                    <p className="text-sm font-bold" style={{ color }}>{TEMP_EMOJI[data.temperature]} {data.temperature}</p>
                    {data.closeProbability && (
                      <p className="text-xs text-gray-400">{Math.round(Number(data.closeProbability) * 100)}% close probability</p>
                    )}
                  </div>
                </div>

                {data.summary && (
                  <p className="text-xs text-gray-600 italic leading-relaxed mb-3">
                    "{data.summary}"
                  </p>
                )}

                {/* Mini dimension bars */}
                <div className="space-y-1.5 mb-3">
                  {[
                    { k:'urgencyScore',    l:'Urgency',    c:'bg-red-400' },
                    { k:'budgetScore',     l:'Budget',     c:'bg-emerald-400' },
                    { k:'intentScore',     l:'Intent',     c:'bg-blue-400' },
                    { k:'engagementScore', l:'Engagement', c:'bg-violet-400' },
                  ].map(d => (
                    <div key={d.k} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-16">{d.l}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${d.c} rounded-full`} style={{ width:`${(data as any)[d.k]}%` }}/>
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-5 text-right">{(data as any)[d.k]}</span>
                    </div>
                  ))}
                </div>

                {/* Top recommendation */}
                {(data.recommendations as string[])?.[0] && (
                  <div className="px-3 py-2 bg-indigo-50 rounded-xl">
                    <p className="text-xs font-bold text-indigo-500 mb-0.5">Top action</p>
                    <p className="text-xs text-indigo-800">{(data.recommendations as string[])[0]}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400">No AI analysis available yet</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Inline temperature label only ─────────────────────────────────────

export function TemperatureLabel({ temperature }: { temperature?: string }) {
  if (!temperature) return null;
  const cfg: Record<string, string> = {
    HOT:  'bg-red-100 text-red-700 border-red-200',
    WARM: 'bg-amber-100 text-amber-700 border-amber-200',
    COLD: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${cfg[temperature] ?? cfg.COLD}`}>
      {TEMP_EMOJI[temperature] ?? '?'} {temperature}
    </span>
  );
}