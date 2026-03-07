'use client';
// src/app/dashboard/ai/insights/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import Link from 'next/link';
import {
  Brain, AlertTriangle, CheckCircle, Info,
  Bell, BellOff, ExternalLink, Loader2,
  ChevronRight, Clock,
} from 'lucide-react';

const SEVERITY_CFG: Record<string, {
  border: string; bg: string; iconColor: string; icon: any; badge: string;
}> = {
  CRITICAL: { border:'border-red-300',   bg:'bg-red-50',    iconColor:'text-red-600',    icon:AlertTriangle, badge:'bg-red-600 text-white' },
  URGENT:   { border:'border-red-200',   bg:'bg-red-50',    iconColor:'text-red-500',    icon:AlertTriangle, badge:'bg-red-500 text-white' },
  WARNING:  { border:'border-amber-200', bg:'bg-amber-50',  iconColor:'text-amber-500',  icon:AlertTriangle, badge:'bg-amber-500 text-white' },
  INFO:     { border:'border-blue-200',  bg:'bg-blue-50',   iconColor:'text-blue-500',   icon:Info,          badge:'bg-blue-500 text-white' },
};

const TYPE_LABEL: Record<string, string> = {
  LEAD_OPPORTUNITY:  '🎯 Lead Opportunity',
  TERRITORY_TREND:   '📍 Territory Trend',
  AGENT_COACHING:    '📚 Agent Coaching',
  REVENUE_FORECAST:  '💰 Revenue Forecast',
  CAMPAIGN_ALERT:    '📣 Campaign Alert',
  CONVERSION_PATTERN:'🔄 Pattern Detected',
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function InsightsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');
  const [severity, setSeverity] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ai-insights', filter, severity],
    queryFn:  () => aiApi.insights({
      ...(filter === 'unread' && { unread: 'true' }),
      ...(severity && { severity }),
    }).then(r => r.data),
    refetchInterval: 30000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => aiApi.markRead(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ai-insights'] }),
  });

  const insights   = data?.data        ?? [];
  const unreadCount= data?.unreadCount  ?? 0;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-violet-600"/> AI Insights
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automated alerts and recommendations from the AI engine
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="px-3 py-1.5 bg-violet-100 text-violet-700 text-sm font-bold rounded-full">
            {unreadCount} unread
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {[{ v:'unread', l:`Unread (${unreadCount})` }, { v:'all', l:'All' }].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v as any)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                filter === f.v ? 'bg-[#1B3A5C] text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{f.l}</button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {[{ v:'', l:'All' },{ v:'CRITICAL', l:'🚨 Critical' },{ v:'URGENT', l:'⚡ Urgent' },{ v:'WARNING', l:'⚠️ Warning' },{ v:'INFO', l:'ℹ️ Info' }].map(f => (
            <button key={f.v} onClick={() => setSeverity(f.v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                severity === f.v ? 'bg-gray-800 text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Insights list */}
      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
      ) : insights.length === 0 ? (
        <div className="card py-20 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500"/>
          </div>
          <p className="font-semibold text-gray-700">
            {filter === 'unread' ? 'All caught up!' : 'No insights found'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === 'unread'
              ? 'No unread insights. The AI will notify you when something needs attention.'
              : 'Try a different filter to see more insights.'}
          </p>
          {filter === 'unread' && (
            <button onClick={() => setFilter('all')}
              className="mt-4 text-sm text-indigo-600 font-semibold hover:underline">
              View all insights →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight: any) => {
            const cfg    = SEVERITY_CFG[insight.severity] ?? SEVERITY_CFG.INFO;
            const SIcon  = cfg.icon;
            const isRead = insight.isRead;

            return (
              <div key={insight.id}
                className={`border-2 rounded-2xl overflow-hidden transition-all ${cfg.border} ${isRead ? 'opacity-70' : 'shadow-sm'}`}>
                <div className={`p-5 ${cfg.bg}`}>
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white shadow-sm`}>
                      <SIcon className={`w-5 h-5 ${cfg.iconColor}`}/>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            {insight.severity}
                          </span>
                          <span className="text-xs text-gray-500">
                            {TYPE_LABEL[insight.type] ?? insight.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3"/> {timeAgo(insight.createdAt)}
                          </span>
                          {!isRead && (
                            <button onClick={() => markReadMut.mutate(insight.id)}
                              className="text-xs font-semibold text-gray-400 hover:text-gray-700 flex items-center gap-1">
                              <BellOff className="w-3 h-3"/> Mark read
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="font-bold text-gray-900 mb-1">{insight.title}</h3>
                      <p className="text-sm text-gray-700 leading-relaxed">{insight.body}</p>

                      {insight.actionUrl && (
                        <div className="mt-3">
                          <Link href={insight.actionUrl}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-sm font-semibold text-gray-700 rounded-xl hover:bg-gray-50 shadow-sm">
                            {insight.actionLabel ?? 'View Details'}
                            <ChevronRight className="w-3.5 h-3.5"/>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
