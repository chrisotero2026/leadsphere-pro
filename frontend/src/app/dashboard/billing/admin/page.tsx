'use client';
// src/app/dashboard/billing/admin/page.tsx
// Admin-only revenue overview

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminBillingApi } from '@/lib/billingApi';
import {
  DollarSign, Users, TrendingUp, Tag,
  Loader2, RefreshCw, MapPin, CheckCircle,
} from 'lucide-react';
import { useState } from 'react';

const TIER_COLORS: Record<string, string> = {
  FREE:         '#6b7280', BASIC:        '#0ea5e9',
  PROFESSIONAL: '#1B3A5C', ENTERPRISE:   '#7c3aed',
};

function StatCard({ label, value, sub, icon: Icon, color, bg }: {
  label: string; value: string | number; sub?: string; icon: any; color: string; bg: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-3xl font-black text-gray-900 mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${bg}`}><Icon className={`w-5 h-5 ${color}`}/></div>
      </div>
    </div>
  );
}

export default function AdminRevenuePage() {
  const qc = useQueryClient();
  const [seedForm, setSeedForm] = useState({ stateCode:'', price:'299', overwrite:false });
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn:  () => adminBillingApi.revenue().then(r => r.data.data),
    refetchInterval: 60000,
  });

  const { data: subsData } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn:  () => adminBillingApi.subscriptions({ limit: 20, sortBy:'createdAt' }).then(r => r.data),
  });

  const seedMut = useMutation({
    mutationFn: () => adminBillingApi.seedListings(seedForm),
    onSuccess: (r) => { setSeedMsg(r.data.message); qc.invalidateQueries(); },
  });

  const rev   = revenueData?.revenue;
  const subs  = subsData?.data ?? [];

  if (isLoading) return (
    <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Subscription MRR, marketplace sales, and active customers</p>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={`$${Number(rev?.total ?? 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`}
          sub="All time"
          icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50"
        />
        <StatCard
          label="Subscription Rev"
          value={`$${Number(rev?.subscription ?? 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`}
          sub="Recurring revenue"
          icon={TrendingUp} color="text-indigo-600" bg="bg-indigo-50"
        />
        <StatCard
          label="Marketplace Rev"
          value={`$${Number(rev?.marketplace ?? 0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`}
          sub="One-time purchases"
          icon={Tag} color="text-violet-600" bg="bg-violet-50"
        />
        <StatCard
          label="Active Subscribers"
          value={revenueData?.activeSubscriptions ?? 0}
          sub={`${revenueData?.listings?.active ?? 0} listings available`}
          icon={Users} color="text-blue-600" bg="bg-blue-50"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent subscriptions */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-500"/> Recent Subscriptions
          </h2>
          {subs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No subscriptions yet</p>
          ) : (
            <div className="space-y-3">
              {subs.slice(0, 8).map((s: any) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: TIER_COLORS[s.plan?.tier ?? 'FREE'] }}>
                    {s.plan?.tier?.[0] ?? 'F'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {s.user?.firstName} {s.user?.lastName}
                    </div>
                    <div className="text-xs text-gray-400">{s.user?.email}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-gray-700">{s.plan?.name}</div>
                    <div className={`text-xs font-semibold ${
                      s.status === 'ACTIVE' ? 'text-emerald-500'
                      : s.status === 'TRIALING' ? 'text-blue-500'
                      : s.status === 'PAST_DUE' ? 'text-red-500'
                      : 'text-gray-400'
                    }`}>{s.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seed marketplace */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-violet-500"/> Seed Marketplace Listings
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Generate marketplace listings from unowned territories automatically.
          </p>

          {seedMsg && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl mb-3 text-sm text-emerald-700 font-medium">
              <CheckCircle className="w-4 h-4"/> {seedMsg}
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">State</label>
                <select className="input py-2 text-sm" value={seedForm.stateCode}
                  onChange={e => setSeedForm(p => ({...p, stateCode: e.target.value}))}>
                  <option value="">All States</option>
                  <option value="VA">Virginia</option>
                  <option value="MD">Maryland</option>
                  <option value="DC">Washington DC</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Price/mo</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">$</span>
                  <input className="input pl-7 py-2 text-sm" type="number" value={seedForm.price}
                    onChange={e => setSeedForm(p => ({...p, price: e.target.value}))}/>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-gray-300"
                checked={seedForm.overwrite}
                onChange={e => setSeedForm(p => ({...p, overwrite: e.target.checked}))}/>
              <span className="text-sm text-gray-600">Overwrite existing listings</span>
            </label>

            <button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}
              className="w-full py-2.5 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl hover:bg-[#24527a] disabled:opacity-60">
              {seedMut.isPending ? 'Seeding…' : '🌱 Seed Marketplace'}
            </button>
          </div>
        </div>
      </div>

      {/* Marketplace stats */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Marketplace Overview</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label:'Available Listings', val: revenueData?.listings?.active ?? 0, color:'text-emerald-600' },
            { label:'Sold Territories',   val: revenueData?.listings?.sold ?? 0,   color:'text-violet-600' },
            { label:'Marketplace Revenue',val: `$${Number(rev?.marketplace ?? 0).toFixed(2)}`, color:'text-indigo-600' },
          ].map(s => (
            <div key={s.label} className="text-center p-4 bg-gray-50 rounded-xl">
              <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-xs text-gray-500 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
