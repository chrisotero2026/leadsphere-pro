'use client';
// src/app/dashboard/territories/notifications/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/territoryApi';
import {
  Bell, CheckCheck, MapPin, TrendingUp,
  ChevronLeft, ChevronRight, Loader2, Settings,
} from 'lucide-react';
import Link from 'next/link';

const TEMP_EMOJI: Record<string,string> = { HOT:'🔥', WARM:'⚡', COLD:'❄️' };

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-page', unreadOnly, page],
    queryFn:  () => notificationsApi.list({
      page, limit: 20, unread: unreadOnly ? 'true' : undefined,
    }).then(r => r.data.data),
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications-page'] });
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notifications-page'] });
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] });
    },
  });

  const notifications = data?.notifications ?? [];
  const total    = data?.pagination?.total ?? 0;
  const pages    = Math.ceil(total / 20);
  const unreadCt = data?.unreadCount ?? 0;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Lead assignment alerts and territory updates
            {unreadCt > 0 && <span className="ml-1 text-blue-600 font-semibold">· {unreadCt} unread</span>}
          </p>
        </div>

        <div className="flex gap-2">
          {unreadCt > 0 && (
            <button onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-60">
              <CheckCheck className="w-4 h-4 text-gray-400"/>
              Mark all read
            </button>
          )}
          <Link href="/dashboard/territories/notifications/preferences"
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-sm font-medium rounded-xl hover:bg-gray-50">
            <Settings className="w-4 h-4 text-gray-400"/> Preferences
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { label:'All',    val: false },
          { label:'Unread', val: true  },
        ].map(t => (
          <button key={String(t.val)} onClick={() => { setUnreadOnly(t.val); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              unreadOnly === t.val
                ? 'bg-[#1B3A5C] text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
      ) : notifications.length === 0 ? (
        <div className="card py-16 text-center">
          <Bell className="w-12 h-12 mx-auto mb-3 text-gray-200"/>
          <p className="text-gray-500 font-medium">{unreadOnly ? 'No unread notifications' : 'No notifications yet'}</p>
          <p className="text-sm text-gray-400 mt-1">Lead assignments will appear here</p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-gray-50">
          {notifications.map((n: any) => {
            const lead      = n.assignment?.lead;
            const territory = n.assignment?.territory;
            const meta      = n.metadata ?? {};
            const isUnread  = !n.readAt;

            return (
              <div
                key={n.id}
                onClick={() => isUnread && markReadMut.mutate(n.id)}
                className={`flex gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${isUnread ? 'bg-blue-50/40' : ''}`}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-xl mt-0.5 ${
                  meta.temperature === 'HOT' ? 'bg-red-100'
                  : meta.temperature === 'WARM' ? 'bg-orange-100' : 'bg-blue-100'
                }`}>
                  {TEMP_EMOJI[meta.temperature ?? 'COLD'] ?? '🏠'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                        {n.subject}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{n.body}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isUnread && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"/>
                      )}
                      <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    {territory?.displayName && (
                      <span className="inline-flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                        <MapPin className="w-2.5 h-2.5"/> {territory.displayName}
                      </span>
                    )}
                    {meta.score && (
                      <span className="text-xs text-gray-500">Score: <strong className="text-gray-800">{meta.score}</strong></span>
                    )}
                    <Link href="/dashboard/territories/assignments"
                      onClick={e => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B3A5C] hover:underline ml-auto">
                      <TrendingUp className="w-3 h-3"/> View assignment
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {pages}</span>
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
    </div>
  );
}
