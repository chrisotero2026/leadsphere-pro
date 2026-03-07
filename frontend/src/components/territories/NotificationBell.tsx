'use client';
// src/components/territories/NotificationBell.tsx
//
// Drop this into your dashboard <Header> or <Navbar> component.
// Shows unread count, opens a dropdown with the latest notifications.
//
// Usage:
//   import { NotificationBell } from '@/components/territories/NotificationBell';
//   <NotificationBell />

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/territoryApi';
import { Bell, CheckCheck, ExternalLink, MapPin, TrendingUp, Clock } from 'lucide-react';
import Link from 'next/link';

const TEMP_EMOJI: Record<string, string> = { HOT:'🔥', WARM:'⚡', COLD:'❄️' };
const URGENCY_LABEL: Record<string, string> = {
  IMMEDIATE:'ASAP', THREE_MONTHS:'1–3mo', SIX_MONTHS:'3–6mo', EXPLORING:'Exploring',
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)  return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Unread count — poll every 30s
  const { data: countData } = useQuery({
    queryKey: ['notif-unread-count'],
    queryFn:  () => notificationsApi.unreadCount().then(r => r.data.data?.unreadCount ?? 0),
    refetchInterval: 30000,
  });

  // Full list — only fetch when open
  const { data: notifData, isLoading } = useQuery({
    queryKey: ['notifications-dropdown'],
    queryFn:  () => notificationsApi.list({ limit: 8 }).then(r => r.data.data),
    enabled:  open,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-dropdown'] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-dropdown'] });
    },
  });

  const unreadCount = countData ?? 0;
  const notifications = notifData?.notifications ?? [];

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-block' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position:'relative', padding:8, borderRadius:10,
          background: open ? '#f0f4f8' : 'transparent',
          border:'none', cursor:'pointer', color:'#6b7280',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'background .15s',
        }}
        title="Notifications"
      >
        <Bell style={{ width:20, height:20 }}/>
        {unreadCount > 0 && (
          <span style={{
            position:'absolute', top:4, right:4,
            width:16, height:16, background:'#ef4444', color:'white',
            borderRadius:'50%', fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'2px solid white', lineHeight:1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:'absolute', right:0, top:'calc(100% + 8px)', zIndex:1000,
          width:380, background:'white', borderRadius:16,
          boxShadow:'0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          overflow:'hidden',
          animation:'notifFadeIn .15s ease-out',
        }}>
          {/* Header */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'14px 16px', borderBottom:'1px solid #f3f4f6',
          }}>
            <div>
              <h3 style={{ fontWeight:700, color:'#111827', fontSize:15, margin:0 }}>Notifications</h3>
              {unreadCount > 0 && (
                <p style={{ fontSize:11, color:'#6b7280', margin:'2px 0 0', fontFamily:'system-ui' }}>
                  {unreadCount} unread
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllMut.mutate()}
                disabled={markAllMut.isPending}
                style={{
                  display:'flex', alignItems:'center', gap:4,
                  fontSize:11, fontWeight:600, color:'#1B3A5C',
                  background:'none', border:'none', cursor:'pointer',
                  padding:'4px 8px', borderRadius:6,
                }}
              >
                <CheckCheck style={{ width:12, height:12 }}/> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight:420, overflowY:'auto' }}>
            {isLoading ? (
              <div style={{ padding:32, textAlign:'center', color:'#9ca3af', fontSize:13 }}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding:32, textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔔</div>
                <p style={{ color:'#9ca3af', fontSize:13, margin:0 }}>No notifications yet</p>
                <p style={{ color:'#d1d5db', fontSize:11, margin:'4px 0 0' }}>You'll see lead assignments here</p>
              </div>
            ) : (
              notifications.map((n: any) => {
                const lead = n.assignment?.lead;
                const territory = n.assignment?.territory;
                const isUnread = !n.readAt;
                const meta = n.metadata ?? {};

                return (
                  <div
                    key={n.id}
                    onClick={() => { if (isUnread) markReadMut.mutate(n.id); }}
                    style={{
                      display:'flex', gap:12, padding:'12px 16px',
                      borderBottom:'1px solid #f9fafb', cursor:'pointer',
                      background: isUnread ? '#fafbff' : 'white',
                      transition:'background .15s',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width:38, height:38, borderRadius:10, flexShrink:0,
                      background: meta.temperature === 'HOT' ? '#fef2f2'
                                : meta.temperature === 'WARM' ? '#fff7ed' : '#eff6ff',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18,
                    }}>
                      {TEMP_EMOJI[meta.temperature ?? 'COLD'] ?? '🏠'}
                    </div>

                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
                        <p style={{ fontWeight: isUnread ? 700 : 600, color:'#111827', fontSize:13, margin:0, lineHeight:1.4 }}>
                          {meta.leadName ?? `${lead?.firstName ?? ''} ${lead?.lastName ?? ''}`.trim() || 'New Lead'}
                        </p>
                        <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                          {isUnread && (
                            <span style={{ width:7, height:7, background:'#3b82f6', borderRadius:'50%', display:'inline-block' }}/>
                          )}
                          <span style={{ fontSize:10, color:'#9ca3af', fontFamily:'system-ui', whiteSpace:'nowrap' }}>
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                      </div>

                      <p style={{ fontSize:11, color:'#6b7280', margin:'3px 0 0', lineHeight:1.5 }}>
                        {territory?.displayName ?? meta.territoryName ?? 'Territory'} · Score {meta.score ?? lead?.score ?? '—'} · {URGENCY_LABEL[meta.urgency ?? lead?.urgency ?? ''] ?? lead?.urgency}
                      </p>

                      <div style={{ display:'flex', gap:6, marginTop:6 }}>
                        <Link
                          href={`/dashboard/territories/assignments`}
                          onClick={e => e.stopPropagation()}
                          style={{
                            fontSize:10, fontWeight:700, color:'#1B3A5C',
                            textDecoration:'none', display:'flex', alignItems:'center', gap:3,
                            padding:'3px 7px', border:'1px solid #d1d5db', borderRadius:6,
                            background:'white',
                          }}
                        >
                          <TrendingUp style={{ width:10, height:10 }}/> View
                        </Link>
                        {lead?.city && (
                          <span style={{
                            fontSize:10, color:'#9ca3af', display:'flex', alignItems:'center', gap:3,
                          }}>
                            <MapPin style={{ width:10, height:10 }}/> {lead.city}, {lead.stateCode}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid #f3f4f6', textAlign:'center' }}>
            <Link href="/dashboard/territories/notifications"
              style={{
                fontSize:12, fontWeight:700, color:'#1B3A5C', textDecoration:'none',
                display:'flex', alignItems:'center', justifyContent:'center', gap:4,
              }}>
              View all notifications <ExternalLink style={{ width:11, height:11 }}/>
            </Link>
          </div>
        </div>
      )}

      <style>{`
        @keyframes notifFadeIn {
          from { opacity:0; transform:translateY(-6px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
