'use client';
// src/app/dashboard/seo/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seoPagesApi, seoTemplatesApi, seoLocationsApi } from '@/lib/seoApi';
import Link from 'next/link';
import {
  Globe, FileText, MapPin, Zap, Eye,
  CheckCircle, Clock, TrendingUp, Loader2,
  ArrowRight, Layers,
} from 'lucide-react';

export default function SeoDashboard() {
  const qc = useQueryClient();
  const [seedMsg, setSeedMsg] = useState('');

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['seo-stats'],
    queryFn:  () => seoPagesApi.stats().then(r => r.data.data),
  });

  const seedLocs = useMutation({
    mutationFn: () => seoLocationsApi.seedVmdc(),
    onSuccess:  (r) => { setSeedMsg(r.data.message); qc.invalidateQueries({ queryKey: ['seo-stats'] }); },
  });

  const seedTpls = useMutation({
    mutationFn: () => seoTemplatesApi.seedDefaults(),
    onSuccess:  (r) => { setSeedMsg(r.data.message); qc.invalidateQueries({ queryKey: ['seo-stats'] }); },
  });

  const stats = statsData?.overview;
  const isNew = !isLoading && !stats?.total;

  const cards = [
    { label:'Total Pages',   val: stats?.total     ?? 0, icon: Globe,        bg:'bg-indigo-50',  fg:'text-indigo-600' },
    { label:'Published',     val: stats?.published ?? 0, icon: CheckCircle,  bg:'bg-emerald-50', fg:'text-emerald-600' },
    { label:'Drafts',        val: stats?.draft     ?? 0, icon: Clock,        bg:'bg-amber-50',   fg:'text-amber-600' },
    { label:'Archived',      val: stats?.archived  ?? 0, icon: Layers,       bg:'bg-slate-50',   fg:'text-slate-500' },
  ];

  const navLinks = [
    { href:'/dashboard/seo/templates', icon:FileText, label:'Templates',   desc:'Create & edit page templates',       color:'indigo' },
    { href:'/dashboard/seo/pages',     icon:Globe,    label:'Pages',       desc:'Browse & manage generated pages',    color:'emerald' },
    { href:'/dashboard/seo/locations', icon:MapPin,   label:'Locations',   desc:'Manage cities and ZIP codes',        color:'violet' },
    { href:'/dashboard/seo/generate',  icon:Zap,      label:'Generate',    desc:'Run bulk page generation',           color:'orange' },
    { href:'/dashboard/seo/jobs',      icon:TrendingUp,label:'Jobs',       desc:'Monitor generation job progress',    color:'sky' },
  ];

  const colorMap: Record<string, string> = {
    indigo:'bg-indigo-50 text-indigo-600', emerald:'bg-emerald-50 text-emerald-600',
    violet:'bg-violet-50 text-violet-600', orange:'bg-orange-50 text-orange-600',
    sky:'bg-sky-50 text-sky-600',
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SEO Engine</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automated hyper-local landing page generation for VA · MD · DC</p>
        </div>
        <Link href="/dashboard/seo/generate"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
          <Zap className="w-4 h-4" /> Generate Pages
        </Link>
      </div>

      {/* Quick-start banner (shows only if no pages yet) */}
      {isNew && (
        <div className="card p-6 border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50">
          <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-500" /> Quick Start — 3 Steps
          </h2>
          <p className="text-sm text-gray-600 mb-4">Seed data, then generate your first batch of landing pages.</p>
          {seedMsg && <p className="text-sm text-emerald-600 mb-3 font-medium">✓ {seedMsg}</p>}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => seedLocs.mutate()} disabled={seedLocs.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-60">
              {seedLocs.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <MapPin className="w-4 h-4 text-violet-500"/>}
              1 · Seed VA/MD/DC Locations
            </button>
            <button onClick={() => seedTpls.mutate()} disabled={seedTpls.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-60">
              {seedTpls.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4 text-indigo-500"/>}
              2 · Seed Default Templates
            </button>
            <Link href="/dashboard/seo/generate"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700">
              <Zap className="w-4 h-4"/> 3 · Generate Pages
            </Link>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{c.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{c.val.toLocaleString()}</p>
              </div>
              <div className={`p-2.5 rounded-xl ${c.bg}`}><c.icon className={`w-5 h-5 ${c.fg}`}/></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Nav cards */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-3">
          {navLinks.map(l => (
            <Link key={l.href} href={l.href}
              className="card p-4 flex items-center gap-4 hover:shadow-md transition-all group">
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${colorMap[l.color]}`}>
                <l.icon className="w-5 h-5"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{l.label}</div>
                <div className="text-xs text-gray-400 truncate">{l.desc}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0"/>
            </Link>
          ))}
        </div>

        {/* Top pages */}
        <div className="lg:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Top Performing Pages</h2>
            <Link href="/dashboard/seo/pages?sortBy=views&sortDir=desc"
              className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {statsData?.topPages?.length ? (
            <div className="space-y-2">
              {statsData.topPages.slice(0, 7).map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-indigo-400"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{p.title}</div>
                    <div className="text-xs text-gray-400 font-mono truncate">{p.fullPath}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                    <Eye className="w-3.5 h-3.5"/> {p.views}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-gray-400">
              <Globe className="w-10 h-10 mx-auto mb-2 opacity-20"/>
              <p className="text-sm">No pages yet. Run a generation job to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
