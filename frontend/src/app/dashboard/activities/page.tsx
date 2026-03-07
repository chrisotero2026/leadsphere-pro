'use client';

import { useQuery } from '@tanstack/react-query';
import { activitiesApi } from '@/lib/api';
import { ACTIVITY_CONFIG, formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { Activity } from 'lucide-react';

export default function ActivitiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => activitiesApi.getAll().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const activities = data || [];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Feed</h1>
        <p className="text-sm text-gray-500 mt-0.5">All recent CRM activities across your team</p>
      </div>

      <div className="card divide-y divide-gray-50">
        {isLoading ? (
          [...Array(8)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4 animate-pulse">
              <div className="w-9 h-9 bg-gray-100 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : activities.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <div className="font-medium">No activities yet</div>
          </div>
        ) : (
          activities.map((activity: any) => {
            const cfg = ACTIVITY_CONFIG[activity.type as keyof typeof ACTIVITY_CONFIG];
            return (
              <div key={activity.id} className="flex items-start gap-3 p-4 hover:bg-gray-50/50 transition-colors">
                <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-base flex-shrink-0">
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</span>
                    {activity.lead && (
                      <>
                        <span className="text-xs text-gray-400">→</span>
                        <Link
                          href={`/dashboard/leads/${activity.lead.id}`}
                          className="text-xs text-brand-600 hover:underline font-medium"
                        >
                          {activity.lead.firstName} {activity.lead.lastName}
                        </Link>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{activity.body}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {activity.user && (
                      <span className="text-xs text-gray-400">
                        by {activity.user.firstName} {activity.user.lastName}
                      </span>
                    )}
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatRelativeTime(activity.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
