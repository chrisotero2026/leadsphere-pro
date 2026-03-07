'use client';
// src/app/dashboard/seo/templates/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seoTemplatesApi } from '@/lib/seoApi';
import {
  FileText, Plus, Edit2, Trash2, Loader2,
  CheckCircle, Bot, Globe, Eye, Zap,
} from 'lucide-react';

const SERVICE_LABELS: Record<string, string> = {
  SELL_HOUSE_FAST:     'Sell House Fast',
  CASH_OFFER:          'Cash Offer',
  FORECLOSURE:         'Stop Foreclosure',
  PROBATE:             'Probate Sale',
  DIVORCE_SALE:        'Divorce Sale',
  FIRST_TIME_BUYER:    'First Time Buyer',
  REFINANCE:           'Refinance',
  INVESTMENT_PROPERTY: 'Investment Property',
};
const SERVICE_COLORS: Record<string, string> = {
  SELL_HOUSE_FAST:'bg-blue-100 text-blue-700',   CASH_OFFER:'bg-green-100 text-green-700',
  FORECLOSURE:'bg-red-100 text-red-700',          PROBATE:'bg-purple-100 text-purple-700',
  DIVORCE_SALE:'bg-orange-100 text-orange-700',   FIRST_TIME_BUYER:'bg-teal-100 text-teal-700',
  REFINANCE:'bg-sky-100 text-sky-700',            INVESTMENT_PROPERTY:'bg-indigo-100 text-indigo-700',
};

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<any>(null);
  const [preview, setPreview]   = useState<any>(null);
  const [seedMsg, setSeedMsg]   = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['seo-templates'],
    queryFn:  () => seoTemplatesApi.list({ limit: 50 }).then(r => r.data),
  });

  const seedMut = useMutation({
    mutationFn: () => seoTemplatesApi.seedDefaults(),
    onSuccess:  r => { setSeedMsg(r.data.message); qc.invalidateQueries({ queryKey:['seo-templates'] }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => seoTemplatesApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['seo-templates'] }),
  });

  const previewMut = useMutation({
    mutationFn: (id: string) => seoTemplatesApi.preview(id),
    onSuccess:  r => setPreview(r.data.data),
  });

  const templates = data?.data ?? [];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SEO Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define content structure with <code className="bg-gray-100 px-1 rounded text-xs">{'{{variable}}'}</code> placeholders</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-60">
            {seedMut.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4 text-amber-500"/>}
            Seed Defaults
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700">
            <Plus className="w-4 h-4"/> New Template
          </button>
        </div>
      </div>

      {seedMsg && (
        <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4"/> {seedMsg}
        </div>
      )}

      {/* Variable reference */}
      <div className="card p-4 bg-gray-50/50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Available Variables</h3>
        <div className="flex flex-wrap gap-2">
          {['{{city}}','{{stateCode}}','{{state}}','{{zipCode}}','{{county}}','{{cityState}}','{{nearbyCity}}',
            '{{medianValue}}','{{population}}','{{serviceLabel}}','{{company}}','{{phone}}','{{year}}'].map(v => (
            <code key={v} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-indigo-600 font-mono">{v}</code>
          ))}
        </div>
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
      ) : templates.length === 0 ? (
        <div className="card py-16 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200"/>
          <p className="text-gray-500 font-medium">No templates yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Seed the defaults or create your own</p>
          <button onClick={() => seedMut.mutate()} disabled={seedMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700">
            <Zap className="w-4 h-4"/> Seed Default Templates
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t: any) => (
            <div key={t.id} className="card p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${SERVICE_COLORS[t.serviceType] ?? 'bg-gray-100 text-gray-600'}`}>
                    {SERVICE_LABELS[t.serviceType] ?? t.serviceType}
                  </span>
                </div>
                {t.aiEnabled && (
                  <Bot className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                )}
              </div>

              {t.description && (
                <p className="text-xs text-gray-500 leading-relaxed">{t.description}</p>
              )}

              <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Globe className="w-3.5 h-3.5"/>
                  <span>{t._count?.pages ?? 0} pages</span>
                </div>
                <div className="flex gap-1">
                  <button title="Preview" onClick={() => previewMut.mutate(t.id)}
                    disabled={previewMut.isPending}
                    className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors">
                    <Eye className="w-3.5 h-3.5"/>
                  </button>
                  <button title="Edit" onClick={() => { setEditing(t); setShowForm(true); }}
                    className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-colors">
                    <Edit2 className="w-3.5 h-3.5"/>
                  </button>
                  <button title="Delete"
                    onClick={() => { if (confirm('Delete template? Pages using it will remain.')) deleteMut.mutate(t.id); }}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-bold text-gray-900">Template Preview</h2>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div><span className="font-semibold text-gray-500 text-xs uppercase tracking-wide">Title</span>
                <p className="mt-1 text-gray-900">{preview.rendered?.title}</p></div>
              <div><span className="font-semibold text-gray-500 text-xs uppercase tracking-wide">Meta Description</span>
                <p className="mt-1 text-gray-600">{preview.rendered?.metaDescription}</p></div>
              <div><span className="font-semibold text-gray-500 text-xs uppercase tracking-wide">H1</span>
                <p className="mt-1 font-bold text-gray-900 text-xl">{preview.rendered?.h1}</p></div>
              <div><span className="font-semibold text-gray-500 text-xs uppercase tracking-wide">Hero Headline</span>
                <p className="mt-1 text-gray-800 font-semibold">{preview.rendered?.heroHeadline}</p></div>
              <div><span className="font-semibold text-gray-500 text-xs uppercase tracking-wide">URL</span>
                <code className="mt-1 block bg-gray-50 px-3 py-2 rounded text-indigo-600 font-mono">{preview.rendered?.fullPath}</code></div>
              <div><span className="font-semibold text-gray-500 text-xs uppercase tracking-wide">FAQ Items ({preview.rendered?.faqJson?.length})</span>
                <div className="mt-2 space-y-2">
                  {preview.rendered?.faqJson?.slice(0,3).map((f: any, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-3">
                      <p className="font-medium text-gray-800 text-xs">Q: {f.q}</p>
                      <p className="text-gray-500 text-xs mt-1">A: {f.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}