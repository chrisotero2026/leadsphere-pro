'use client';

export const dynamic = 'force-dynamic';

// src/app/dashboard/seo/pages/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seoPagesApi } from '@/lib/seoApi';
import {
  Globe, Search, CheckCircle, Clock, Archive,
  Eye, Trash2, ExternalLink, Loader2, ChevronLeft, ChevronRight,
  Filter, SlidersHorizontal,
} from 'lucide-react';

const STATUS_OPTS = [
  { value:'',          label:'All Statuses' },
  { value:'PUBLISHED', label:'Published' },
  { value:'DRAFT',     label:'Draft' },
  { value:'ARCHIVED',  label:'Archived' },
];

const SORT_OPTS = [
  { value:'createdAt:desc', label:'Newest First' },
  { value:'views:desc',     label:'Most Views' },
  { value:'title:asc',      label:'Title A–Z' },
  { value:'leads:desc',     label:'Most Leads' },
];

const statusBadge = (s: string) => {
  if (s === 'PUBLISHED') return 'bg-emerald-100 text-emerald-700';
  if (s === 'ARCHIVED')  return 'bg-slate-100 text-slate-500';
  return 'bg-amber-100 text-amber-700';
};

const statusIcon = (s: string) => {
  if (s === 'PUBLISHED') return <CheckCircle className="w-3 h-3"/>;
  if (s === 'ARCHIVED')  return <Archive className="w-3 h-3"/>;
  return <Clock className="w-3 h-3"/>;
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://leadsphere.com';

export default function PagesListPage() {
  const qc = useQueryClient();

  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('');
  const [stateCode,setStateCode]= useState('');
  const [sortStr,  setSortStr]  = useState('createdAt:desc');
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [sortBy, sortDir] = sortStr.split(':');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['seo-pages', search, status, stateCode, sortBy, sortDir, page],
    queryFn:  () => seoPagesApi.list({
      page, limit: 25,
      ...(search    && { search }),
      ...(status    && { status }),
      ...(stateCode && { stateCode }),
      sortBy, sortDir,
    }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const publishMut  = useMutation({ mutationFn: (id: string) => seoPagesApi.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-pages'] }) });
  const unpublishMut = useMutation({ mutationFn: (id: string) => seoPagesApi.unpublish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-pages'] }) });
  const deleteMut   = useMutation({ mutationFn: (id: string) => seoPagesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-pages'] }) });

  const rows  = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = Math.ceil(total / 25);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected(prev =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r: any) => r.id))
    );
  };

  const doBulkAction = async (action: string) => {
    if (!selected.size) return;
    setBulkLoading(true);
    try {
      await seoPagesApi.bulkAction([...selected], action);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['seo-pages'] });
    } finally { setBulkLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SEO Pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total.toLocaleString()} pages total
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input className="input pl-9 py-2" placeholder="Search pages…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
        </div>

        <select className="input py-2 w-40" value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select className="input py-2 w-36" value={stateCode}
          onChange={e => { setStateCode(e.target.value); setPage(1); }}>
          <option value="">All States</option>
          <option value="VA">Virginia</option>
          <option value="MD">Maryland</option>
          <option value="DC">DC</option>
        </select>

        <select className="input py-2 w-44" value={sortStr}
          onChange={e => setSortStr(e.target.value)}>
          {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {isFetching && <Loader2 className="w-4 h-4 animate-spin text-gray-400"/>}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
          <span className="font-semibold text-indigo-700">{selected.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {[
              { action:'publish',   label:'Publish', cls:'bg-emerald-600 text-white' },
              { action:'unpublish', label:'Unpublish', cls:'bg-amber-500 text-white' },
              { action:'archive',   label:'Archive', cls:'bg-slate-500 text-white' },
            ].map(b => (
              <button key={b.action} disabled={bulkLoading}
                onClick={() => doBulkAction(b.action)}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs hover:opacity-90 disabled:opacity-50 ${b.cls}`}>
                {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : b.label}
              </button>
            ))}
            <button onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Clear</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="p-3 w-8">
                <input type="checkbox" className="rounded border-gray-300 text-indigo-600"
                  checked={selected.size === rows.length && rows.length > 0}
                  onChange={toggleAll}/>
              </th>
              <th className="p-3 text-left font-semibold text-gray-600">Page / URL</th>
              <th className="p-3 text-left font-semibold text-gray-600 w-28">Location</th>
              <th className="p-3 text-left font-semibold text-gray-600 w-24">Status</th>
              <th className="p-3 text-left font-semibold text-gray-600 w-16">Views</th>
              <th className="p-3 text-left font-semibold text-gray-600 w-16">Leads</th>
              <th className="p-3 text-left font-semibold text-gray-600 w-24">AI?</th>
              <th className="p-3 w-24"/>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto"/>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center">
                <Globe className="w-10 h-10 mx-auto mb-2 text-gray-200"/>
                <p className="text-gray-400 text-sm">No pages found. Adjust filters or generate some pages.</p>
              </td></tr>
            ) : rows.map((row: any) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/40 transition-colors">
                <td className="p-3">
                  <input type="checkbox" className="rounded border-gray-300 text-indigo-600"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}/>
                </td>
                <td className="p-3">
                  <div className="font-medium text-gray-900 truncate max-w-xs" title={row.title}>
                    {row.title}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-xs">
                    {row.fullPath}
                  </div>
                </td>
                <td className="p-3 text-xs text-gray-600">
                  {row.location?.city}, {row.location?.stateCode}
                  <div className="text-gray-400">{row.location?.zipCode}</div>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge(row.status)}`}>
                    {statusIcon(row.status)}{row.status}
                  </span>
                </td>
                <td className="p-3 text-gray-600 tabular-nums">{row.views.toLocaleString()}</td>
                <td className="p-3 text-gray-600 tabular-nums">{row.leads}</td>
                <td className="p-3">
                  {row.aiGenerated && (
                    <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 text-xs rounded font-medium">AI</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    {row.status === 'PUBLISHED' ? (
                      <button title="Unpublish"
                        onClick={() => unpublishMut.mutate(row.id)}
                        disabled={unpublishMut.isPending}
                        className="p-1.5 text-amber-500 hover:bg-amber-50 rounded transition-colors">
                        <Clock className="w-3.5 h-3.5"/>
                      </button>
                    ) : (
                      <button title="Publish"
                        onClick={() => publishMut.mutate(row.id)}
                        disabled={publishMut.isPending}
                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded transition-colors">
                        <CheckCircle className="w-3.5 h-3.5"/>
                      </button>
                    )}
                    {row.status === 'PUBLISHED' && (
                      <a href={`${SITE_URL}${row.fullPath}`} target="_blank" rel="noopener"
                        className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors">
                        <ExternalLink className="w-3.5 h-3.5"/>
                      </a>
                    )}
                    <button title="Delete"
                      onClick={() => { if (confirm('Delete this page?')) deleteMut.mutate(row.id); }}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {((page-1)*25)+1}–{Math.min(page*25, total)} of {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <ChevronLeft className="w-4 h-4"/>
            </button>
            <span className="px-3 py-2">Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p+1)}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <ChevronRight className="w-4 h-4"/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}