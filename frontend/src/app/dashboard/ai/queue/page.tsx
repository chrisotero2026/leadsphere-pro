'use client';
// src/app/dashboard/ai/queue/page.tsx — Admin only

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '@/lib/aiApi';
import {
  Cpu, CheckCircle, AlertTriangle, Clock,
  Loader2, Trash2, Play, RefreshCw, Zap,
} from 'lucide-react';

export default function QueueAdminPage() {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['queue-stats'],
    queryFn:  () => aiApi.queueStats().then(r => r.data.data),
    refetchInterval: 5000,
  });

  const batchMut   = useMutation({ mutationFn: () => aiApi.batchScore('unscored') });
  const cleanupMut = useMutation({
    mutationFn: () => aiApi.cleanupQueue(),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['queue-stats'] }),
  });

  const stats = data ?? {};

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-indigo-600"/> AI Job Queue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.isRunning ? '🟢 Worker running' : '🔴 Worker stopped'} · Auto-refreshes every 5s
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-500"/>
          </button>
          <button onClick={() => batchMut.mutate()} disabled={batchMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60">
            {batchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}
            Score All Unscored
          </button>
          <button onClick={() => cleanupMut.mutate()} disabled={cleanupMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 disabled:opacity-60">
            {cleanupMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
            Cleanup Old Jobs
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Queued',    val:stats.queued,    icon:Clock,        bg:'bg-amber-50',   ic:'text-amber-500' },
          { label:'Processing',val:stats.processing, icon:Loader2,     bg:'bg-blue-50',    ic:'text-blue-500' },
          { label:'Completed', val:stats.completed,  icon:CheckCircle, bg:'bg-emerald-50', ic:'text-emerald-500' },
          { label:'Failed',    val:stats.failed,     icon:AlertTriangle,bg:'bg-red-50',    ic:'text-red-500' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-gray-100`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.ic} ${s.label === 'Processing' && stats.processing > 0 ? 'animate-spin' : ''}`}/>
            </div>
            <p className="text-3xl font-black text-gray-900">{isLoading ? '…' : (s.val ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Performance */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Performance</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Avg Processing Time</p>
            <p className="text-2xl font-black text-gray-800">
              {stats.avgProcessingMs ? `${(stats.avgProcessingMs / 1000).toFixed(1)}s` : '—'}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Success Rate</p>
            <p className="text-2xl font-black text-emerald-700">
              {stats.total > 0
                ? `${Math.round((stats.completed / (stats.total - stats.queued - stats.processing || 1)) * 100)}%`
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Recent errors */}
      {stats.recentErrors?.length > 0 && (
        <div className="card p-5 border-red-100">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500"/> Recent Errors
          </h2>
          <div className="space-y-2">
            {stats.recentErrors.map((err: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0"/>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-red-700">{err.type}</p>
                  <p className="text-xs text-red-600 mt-0.5 truncate">{err.error}</p>
                  <p className="text-xs text-red-400 mt-0.5">
                    {err.completedAt ? new Date(err.completedAt).toLocaleString() : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
