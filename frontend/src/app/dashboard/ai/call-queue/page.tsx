'use client';
// src/app/dashboard/ai/call-queue/page.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import {
  PhoneCall, Brain, Clock, TrendingUp, ChevronDown,
  Loader2, MapPin, AlertTriangle, Star, Copy, Check,
} from 'lucide-react';

const TEMP_CFG: Record<string, { emoji: string; bg: string; border: string; text: string }> = {
  HOT:  { emoji:'🔥', bg:'bg-red-50',    border:'border-red-200',    text:'text-red-700' },
  WARM: { emoji:'⚡', bg:'bg-amber-50',  border:'border-amber-200',  text:'text-amber-700' },
  COLD: { emoji:'❄️', bg:'bg-blue-50',   border:'border-blue-200',   text:'text-blue-700' },
};

const URGENCY_LABEL: Record<string, string> = {
  IMMEDIATE: 'ASAP', THREE_MONTHS: '1–3 mo', SIX_MONTHS: '3–6 mo', EXPLORING: 'Exploring',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-red-500' : score >= 45 ? 'bg-amber-400' : 'bg-blue-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width:`${score}%` }}/>
      </div>
      <span className="text-xs font-bold tabular-nums text-gray-700 w-8 text-right">{score}</span>
    </div>
  );
}

function LeadCallCard({ lead, rank }: { lead: any; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied,   setCopied]   = useState(false);
  const cfg = TEMP_CFG[lead.temperature] ?? TEMP_CFG.COLD;

  const copyScript = () => {
    if (lead.callScript) {
      navigator.clipboard.writeText(lead.callScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const urgencyMinutes = lead.waitingHours > 24 ? `${Math.round(lead.waitingHours/24)}d` :
    lead.waitingHours > 1 ? `${Math.round(lead.waitingHours)}h` : `${Math.round(lead.waitingHours * 60)}m`;

  return (
    <div className={`border-2 rounded-2xl overflow-hidden transition-all ${
      rank === 1 ? 'border-red-200 shadow-lg shadow-red-50' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className={`flex items-center gap-4 p-4 ${rank === 1 ? 'bg-red-50' : 'bg-white'}`}>
        {/* Rank */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
          rank === 1 ? 'bg-red-500 text-white' :
          rank === 2 ? 'bg-orange-400 text-white' :
          rank === 3 ? 'bg-amber-400 text-white' :
          'bg-gray-100 text-gray-500'
        }`}>#{rank}</div>

        {/* Lead info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">{lead.leadName}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
              {cfg.emoji} {lead.temperature}
            </span>
            {lead.waitingHours > 4 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                <Clock className="w-3 h-3"/> {urgencyMinutes} waiting
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{lead.phone}</span>
            <span>{URGENCY_LABEL[lead.urgency] ?? lead.urgency}</span>
            {lead.estimatedValue > 0 && (
              <span className="font-semibold text-gray-600">${lead.estimatedValue.toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="hidden sm:block w-32">
          <div className="text-xs text-gray-400 mb-1 font-medium">AI Priority</div>
          <ScoreBar score={lead.score}/>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={`tel:${lead.phone}`}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-colors ${
              rank <= 3
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-[#1B3A5C] text-white hover:bg-[#24527a]'
            }`}>
            <PhoneCall className="w-4 h-4"/> Call
          </a>
          <button onClick={() => setExpanded(e => !e)}
            className="p-2.5 border border-gray-200 rounded-xl text-gray-400 hover:bg-gray-50">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}/>
          </button>
        </div>
      </div>

      {/* Expanded AI guidance */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          {lead.callScript && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Brain className="w-3 h-3 text-indigo-500"/> AI Call Script
                </p>
                <button onClick={copyScript}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
                  {copied ? <Check className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="px-4 py-3 bg-white border border-indigo-100 rounded-xl text-sm text-gray-700 leading-relaxed italic">
                "{lead.callScript}"
              </div>
            </div>
          )}

          {lead.topRecommendation && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-500"/> Top Recommendation
              </p>
              <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
                {lead.topRecommendation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CallQueuePage() {
  const [filter, setFilter] = useState<'all' | 'hot' | 'warm'>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['call-queue'],
    queryFn:  () => aiApi.callQueue().then(r => r.data),
    refetchInterval: 30000,
  });

  const queue = (data?.data ?? []) as any[];
  const meta  = data?.meta ?? {};

  const filtered = filter === 'hot'  ? queue.filter(q => q.temperature === 'HOT') :
                   filter === 'warm' ? queue.filter(q => q.temperature === 'WARM') :
                   queue;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-green-600"/> Priority Call Queue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Leads ranked by AI score, urgency, and wait time
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <span className="flex items-center gap-1">🔥 <strong className="text-gray-800">{meta.hot ?? 0}</strong></span>
          <span className="flex items-center gap-1">⚡ <strong className="text-gray-800">{meta.warm ?? 0}</strong></span>
          <span className="flex items-center gap-1">❄️ <strong className="text-gray-800">{meta.cold ?? 0}</strong></span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[{ v:'all', l:`All (${queue.length})` }, { v:'hot', l:`🔥 Hot (${meta.hot ?? 0})` }, { v:'warm', l:`⚡ Warm (${meta.warm ?? 0})` }].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v as any)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              filter === f.v ? 'bg-[#1B3A5C] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Queue */}
      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
      ) : filtered.length === 0 ? (
        <div className="card py-16 text-center">
          <PhoneCall className="w-12 h-12 mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-500 font-medium">No leads in queue</p>
          <p className="text-sm text-gray-400 mt-1">All caught up! New leads will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead: any, i: number) => (
            <LeadCallCard key={lead.assignmentId} lead={lead} rank={i + 1}/>
          ))}
        </div>
      )}
    </div>
  );
}
