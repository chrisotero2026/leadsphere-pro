'use client';

import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/lib/api';
import { DashboardStats } from '@/types';
import { STATUS_CONFIG, TEMPERATURE_CONFIG, formatRelativeTime, formatCurrency } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  TrendingUp, Users, Target, Award,
  ArrowUpRight, ArrowDownRight, Flame, Snowflake, Sun
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PIPELINE_COLORS = ['#6366f1', '#f59e0b', '#8b5cf6', '#f97316', '#06b6d4', '#10b981', '#ef4444'];

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<{ data: DashboardStats }>({
    queryKey: ['dashboard'],
    queryFn: () => statsApi.dashboard().then((r) => r.data),
  });

  const stats = data?.data;

  const metricCards = stats ? [
    {
      title: 'Total Leads',
      value: stats.overview.totalLeads.toLocaleString(),
      icon: TrendingUp,
      color: 'bg-brand-50 text-brand-600',
      change: `${stats.overview.monthlyGrowth > 0 ? '+' : ''}${stats.overview.monthlyGrowth}% this month`,
      positive: stats.overview.monthlyGrowth >= 0,
    },
    {
      title: 'New This Month',
      value: stats.overview.newLeadsThisMonth.toLocaleString(),
      icon: Users,
      color: 'bg-green-50 text-green-600',
      change: 'New leads captured',
      positive: true,
    },
    {
      title: 'Avg Lead Score',
      value: `${stats.overview.avgScore}/100`,
      icon: Target,
      color: 'bg-purple-50 text-purple-600',
      change: 'Quality index',
      positive: true,
    },
    {
      title: 'Conversion Rate',
      value: `${stats.overview.conversionRate}%`,
      icon: Award,
      color: 'bg-orange-50 text-orange-600',
      change: 'Leads closed won',
      positive: true,
    },
  ] : [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good morning, {user?.firstName} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening with your leads today.</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <div key={card.title} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${card.positive ? 'text-green-600' : 'text-red-500'}`}>
              {card.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {card.change}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Pipeline Overview</h2>
          {stats?.pipeline && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.pipeline} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="status"
                  tickFormatter={(v) => STATUS_CONFIG[v as keyof typeof STATUS_CONFIG]?.label || v}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip
                  formatter={(value, name) => [value, 'Leads']}
                  labelFormatter={(label) => STATUS_CONFIG[label as keyof typeof STATUS_CONFIG]?.label || label}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats.pipeline.map((entry, index) => (
                    <Cell key={entry.status} fill={PIPELINE_COLORS[index % PIPELINE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Temperature breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Lead Temperature</h2>
          <div className="space-y-3">
            {stats?.temperature?.map((t) => {
              const config = TEMPERATURE_CONFIG[t.temperature as keyof typeof TEMPERATURE_CONFIG];
              const total = stats.temperature.reduce((sum, x) => sum + x.count, 0);
              const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
              return (
                <div key={t.temperature}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm flex items-center gap-1.5">
                      <span>{config?.icon}</span>
                      <span className="text-gray-700 font-medium">{config?.label}</span>
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{t.count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        t.temperature === 'HOT' ? 'bg-red-400' :
                        t.temperature === 'WARM' ? 'bg-orange-400' : 'bg-blue-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top agents */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Agents</h3>
            <div className="space-y-2">
              {stats?.topAgents?.slice(0, 3).map((agent) => (
                <div key={agent.id} className="flex items-center gap-2 text-sm">
                  <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-xs font-bold text-brand-700">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.assignedLeads} leads</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {stats?.recentActivity?.slice(0, 6).map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                {activity.type === 'CALL' ? '📞' : activity.type === 'EMAIL' ? '✉️' : activity.type === 'STATUS_CHANGE' ? '🔄' : '📝'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">{activity.body}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{activity.user?.firstName} {activity.user?.lastName}</span>
                  {activity.lead && (
                    <span className="text-xs text-brand-600">→ {activity.lead.firstName} {activity.lead.lastName}</span>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatRelativeTime(activity.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
