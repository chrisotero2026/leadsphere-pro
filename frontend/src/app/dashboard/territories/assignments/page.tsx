'use client';
// src/app/dashboard/territories/assignments/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '@/lib/territoryApi';
import {
  Zap, CheckCircle, XCircle, Eye, Search,
  Clock, Loader2, ChevronLeft, ChevronRight,
  Filter, RefreshCw, TrendingUp, AlertTriangle, MapPin,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dotColor: string }> = {
  ASSIGNED:   { label:'Assigned',   color:'text-blue-700',    bg:'bg-blue-50 border-blue-200',    dotColor:'bg-blue-500' },
  ACCEPTED:   { label:'Accepted',   color:'text-indigo-700',  bg:'bg-indigo-50 border-indigo-200', dotColor:'bg-indigo-500' },
  WORKING:    { label:'Working',    color:'text-violet-700',  bg:'bg-violet-50 border-violet-200', dotColor:'bg-violet-500' },
  CONVERTED:  { label:'Converted',  color:'text-emerald-700', bg:'bg-emerald-50 border-emerald-200',dotColor:'bg-emerald-500' },
  REJECTED:   { label:'Rejected',   color:'text-red-700',     bg:'bg-red-50 border-red-200',      dotColor:'bg-red-500' },
  EXPIRED:    { label:'Expired',    color:'text-slate-500',   bg:'bg-slate-50 border-slate-200',  dotColor:'bg-slate-400' },
  UNASSIGNED: { label:'Unassigned', color:'text-amber-700',   bg:'bg-amber-50 border-amber-200',  dotColor:'bg-amber-500' },
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)  return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function timeRemaining(expires: string | null) {
  if (!expires) return null;
  const ms = new Date(expires).getTime() - Date.now();
  if (ms < 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export default function AssignmentsPage() {
  const qc = useQueryClient();

  const [status, setStatus]     = useState('');
  const [search, setSearch]     = useState('');
  const [page,   setPage]       = useState(1);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['assignments', status, search, page],
    queryFn:  () => assignmentsApi.list({
      page, limit: 20,
      ...(status && { status }),
    }).then(r => r.data),
    refetchInterval: 15000, // live updates
  });

  const acceptMut = useMutation({
    mutationFn: (id: string) => assignmentsApi.accept(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['assignments'] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      assignmentsApi.reject(id, reason),
    onSuccess:  () => {
      setRejectModal(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey:['assignments'] });
    },
  });

  const workingMut = useMutation({
    mutationFn: (id: string) => assignmentsApi.markWorking(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['assignments'] }),
  });

  const convertMut = useMutation({
    mutationFn: (id: string) => assignmentsApi.markConverted(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['assignments'] }),
  });

  const rows  = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = Math.ceil(total / 20);

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Assignments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total.toLocaleString()} assignments · auto-refreshes every 15s
          </p>
        </div>
        <button onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-sm rounded-xl hover:bg-gray-50">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-500' : 'text-gray-400'}`}/>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {['', 'ASSIGNED', 'ACCEPTED', 'WORKING', 'CONVERTED', 'REJECTED', 'UNASSIGNED', 'EXPIRED'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === s
                  ? 'bg-[#1B3A5C] text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto"/>}
      </div>

      {/* Assignment cards */}
      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
      ) : rows.length === 0 ? (
        <div className="card py-16 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-200"/>
          <p className="text-gray-500">No assignments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((a: any) => {
            const lead = a.lead;
            const cfg  = STATUS_CFG[a.status] ?? STATUS_CFG.ASSIGNED;
            const remaining = timeRemaining(a.expiresAt);
            const isUrgent = a.status === 'ASSIGNED' && remaining && remaining !== 'Expired'
              && a.expiresAt && (new Date(a.expiresAt).getTime() - Date.now()) < 4 * 3600000;

            return (
              <div key={a.id}
                className={`card p-5 ${isUrgent ? 'border-orange-300 bg-orange-50/30' : ''}`}>
                <div className="flex items-start gap-4 flex-wrap">
                  {/* Temperature + name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-xl
                      ${lead?.temperature === 'HOT' ? 'bg-red-100' : lead?.temperature === 'WARM' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                      {lead?.temperature === 'HOT' ? '🔥' : lead?.temperature === 'WARM' ? '⚡' : '❄️'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 text-base">
                        {lead?.firstName} {lead?.lastName}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap mt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3"/> {lead?.city}, {lead?.stateCode} {lead?.zipCode}
                        </span>
                        {a.territory && (
                          <span className="text-indigo-500">· {a.territory.displayName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score + status */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{lead?.score}<span className="text-xs text-gray-400">/100</span></div>
                      <div className="text-xs text-gray-400">score</div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`}/>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Lead details row */}
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                  <span>Urgency: <strong className="text-gray-800">{lead?.urgency?.replace('_',' ')}</strong></span>
                  {lead?.estimatedValue && (
                    <span>Value: <strong className="text-gray-800">${Number(lead.estimatedValue).toLocaleString()}</strong></span>
                  )}
                  <span>Assigned: <strong className="text-gray-800">{timeAgo(a.assignedAt)}</strong></span>
                  {remaining && (
                    <span className={`font-semibold ${isUrgent ? 'text-orange-600' : 'text-gray-500'}`}>
                      {isUrgent && '⚠ '}⏱ {remaining}
                    </span>
                  )}
                  {a.assignedTo && (
                    <span>Owner: <strong className="text-gray-800">{a.assignedTo.firstName} {a.assignedTo.lastName}</strong></span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Link href={`/dashboard/leads/${a.leadId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                    <Eye className="w-3.5 h-3.5"/> View Lead
                  </Link>

                  {a.status === 'ASSIGNED' && (
                    <>
                      <button onClick={() => acceptMut.mutate(a.id)}
                        disabled={acceptMut.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60">
                        <CheckCircle className="w-3.5 h-3.5"/> Accept
                      </button>
                      <button onClick={() => setRejectModal({ id: a.id })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50">
                        <XCircle className="w-3.5 h-3.5"/> Reject
                      </button>
                    </>
                  )}

                  {a.status === 'ACCEPTED' && (
                    <button onClick={() => workingMut.mutate(a.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700">
                      <Zap className="w-3.5 h-3.5"/> Mark Working
                    </button>
                  )}

                  {(a.status === 'WORKING' || a.status === 'ACCEPTED') && (
                    <button onClick={() => convertMut.mutate(a.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1B3A5C] text-white text-xs font-semibold rounded-lg hover:bg-[#24527a]">
                      <TrendingUp className="w-3.5 h-3.5"/> Converted! 🎉
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {pages} · {total.toLocaleString()} total</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4"/>
            </button>
            <button disabled={page >= pages} onClick={() => setPage(p => p+1)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
              <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 mb-2">Reject Assignment</h3>
            <p className="text-sm text-gray-500 mb-4">The lead will be redistributed to the next available owner in this territory.</p>
            <textarea
              className="input h-24 text-sm resize-none"
              placeholder="Optional: reason for rejection…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => rejectMut.mutate({ id: rejectModal.id, reason: rejectReason })}
                disabled={rejectMut.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
                {rejectMut.isPending ? 'Rejecting…' : 'Reject Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
