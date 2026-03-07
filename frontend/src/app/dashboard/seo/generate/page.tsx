'use client';

export const dynamic = 'force-dynamic';

// src/app/dashboard/seo/generate/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { seoPagesApi, seoTemplatesApi, seoLocationsApi, seoJobsApi } from '@/lib/seoApi';
import { Zap, Bot, CheckCircle, AlertCircle, Clock, Loader2, RefreshCw, MapPin, Info } from 'lucide-react';

const JOB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; spin?: boolean }> = {
  PENDING:   { label:'Pending',   color:'text-slate-500',   bg:'bg-slate-100' },
  RUNNING:   { label:'Running',   color:'text-blue-600',    bg:'bg-blue-50', spin:true },
  COMPLETED: { label:'Completed', color:'text-emerald-600', bg:'bg-emerald-50' },
  FAILED:    { label:'Failed',    color:'text-red-500',     bg:'bg-red-50' },
  CANCELLED: { label:'Cancelled', color:'text-slate-400',   bg:'bg-slate-50' },
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

export default function GeneratePage() {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    templateId:  '',
    stateCode:   '',
    useAi:       false,
    overwrite:   false,
    publishNow:  false,
  });
  const [jobResult, setJobResult] = useState<any>(null);

  const { data: tplData } = useQuery({
    queryKey: ['seo-templates-list'],
    queryFn:  () => seoTemplatesApi.list({ limit:50 }).then(r => r.data),
  });

  const { data: locCount } = useQuery({
    queryKey: ['loc-count', form.stateCode],
    queryFn:  () => seoLocationsApi.list({
      limit: 1, isActive: 'true',
      ...(form.stateCode && { stateCode: form.stateCode }),
    }).then(r => r.data?.pagination?.total ?? 0),
  });

  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ['seo-jobs-list'],
    queryFn:  () => seoJobsApi.list({ limit: 8 }).then(r => r.data),
    refetchInterval: 4000,
  });

  const generateMut = useMutation({
    mutationFn: () => seoPagesApi.generate({
      templateId: form.templateId,
      ...(form.stateCode && { stateCode: form.stateCode }),
      useAi:      form.useAi,
      overwrite:  form.overwrite,
      publishNow: form.publishNow,
    }),
    onSuccess: r => {
      setJobResult(r.data.data);
      qc.invalidateQueries({ queryKey: ['seo-jobs-list'] });
      qc.invalidateQueries({ queryKey: ['seo-stats'] });
    },
  });

  const templates = tplData?.data ?? [];
  const jobs      = jobsData?.data ?? [];
  const canRun    = form.templateId && (locCount ?? 0) > 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate SEO Pages</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create hyper-local landing pages in bulk — one per ZIP code per service type</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Left: Config form ───────────────────────── */}
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-gray-800">Generation Config</h2>

          {/* Template picker */}
          <div>
            <label className="label">SEO Template *</label>
            <select className="input" value={form.templateId}
              onChange={e => setForm(p => ({...p, templateId: e.target.value}))}>
              <option value="">Select a template…</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}  ({t._count?.pages ?? 0} pages existing)
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No templates — go to Templates → Seed Defaults first.
              </p>
            )}
          </div>

          {/* State filter */}
          <div>
            <label className="label">State Filter</label>
            <select className="input" value={form.stateCode}
              onChange={e => setForm(p => ({...p, stateCode: e.target.value}))}>
              <option value="">All States ({locCount ?? '…'} locations)</option>
              <option value="VA">Virginia only</option>
              <option value="MD">Maryland only</option>
              <option value="DC">Washington DC only</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Will attempt to generate <strong>{locCount ?? '…'}</strong> pages
            </p>
          </div>

          {/* Toggle options */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            {[
              {
                key: 'useAi', icon: Bot, label: 'AI-Enhanced Content',
                badge: 'GPT-4o-mini', badgeColor: 'bg-violet-100 text-violet-700',
                desc: 'Generates unique city-specific copy per page via OpenAI. ~$0.003/page. Requires OPENAI_API_KEY.',
              },
              {
                key: 'publishNow', icon: CheckCircle, label: 'Publish Immediately',
                desc: 'Pages go live right after generation. Leave unchecked to review as drafts first.',
              },
              {
                key: 'overwrite', icon: RefreshCw, label: 'Overwrite Existing Pages',
                desc: 'Re-generates pages that already exist for this template + location combination.',
              },
            ].map(opt => (
              <label key={opt.key} className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox"
                  className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={(form as any)[opt.key]}
                  onChange={e => setForm(p => ({...p, [opt.key]: e.target.checked}))}
                />
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <opt.icon className="w-3.5 h-3.5 text-gray-400"/>
                    {opt.label}
                    {opt.badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Feedback */}
          {jobResult && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle className="w-4 h-4"/> {jobResult.message}
              </div>
              <div className="text-xs font-mono text-emerald-600">Job: {jobResult.jobId}</div>
            </div>
          )}

          {generateMut.isError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0"/>
              {(generateMut.error as any)?.response?.data?.message ?? 'Generation failed — check the console.'}
            </div>
          )}

          <button onClick={() => generateMut.mutate()}
            disabled={!canRun || generateMut.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {generateMut.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin"/> Starting…</>
              : <><Zap className="w-4 h-4"/> Generate {locCount ? `~${locCount}` : ''} Pages</>
            }
          </button>
        </div>

        {/* ── Right: Info panel ───────────────────────── */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-500"/> What Each Page Gets
            </h3>
            <ul className="space-y-1.5">
              {[
                'Title tag + meta description (unique per ZIP)',
                'H1, hero headline & subheadline',
                'Full body HTML with local context',
                '6 FAQ items optimized for Google PAA',
                'JSON-LD schema (LocalBusiness + FAQPage)',
                'SEO URL: /va/arlington/22201/sell-my-house-fast',
                'Lead capture form → CRM integration',
                'Open Graph metadata for social sharing',
              ].map(i => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0"/>
                  {i}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5 bg-violet-50/60 border-violet-200">
            <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-600"/> AI Mode vs Template Mode
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-800">Template mode (default)</span>
                <p className="text-xs text-gray-500 mt-0.5">Variable substitution only. Lightning fast — can generate 1,000 pages/minute. No API cost.</p>
              </div>
              <div>
                <span className="font-medium text-gray-800">AI mode</span>
                <p className="text-xs text-gray-500 mt-0.5">GPT-4o-mini writes unique copy per city. Slower (rate-limited to 3 concurrent). ~$0.003/page via OpenAI.</p>
              </div>
            </div>
          </div>

          <div className="card p-5 bg-amber-50/60 border-amber-200">
            <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600"/> Scale Estimate
            </h3>
            <div className="space-y-1 text-xs text-gray-600 mt-2">
              {[
                ['VA locations (seeded)', '~23'],
                ['MD locations (seeded)', '~14'],
                ['DC locations (seeded)', '~14'],
                ['Total with 3 templates', '~153 pages'],
                ['With full VA/MD/DC ZIPs', '~4,000+ pages'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-semibold text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Job history ──────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
          <button onClick={() => refetchJobs()}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4"/>
          </button>
        </div>

        {jobs.length === 0 ? (
          <p className="text-center py-8 text-sm text-gray-400">No jobs yet.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job: any) => {
              const cfg = JOB_STATUS_CONFIG[job.status] ?? JOB_STATUS_CONFIG.PENDING;
              return (
                <div key={job.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${cfg.bg} flex-shrink-0`}>
                        {job.status === 'RUNNING'
                          ? <Loader2 className={`w-4 h-4 ${cfg.color} animate-spin`}/>
                          : job.status === 'COMPLETED'
                          ? <CheckCircle className={`w-4 h-4 ${cfg.color}`}/>
                          : job.status === 'FAILED'
                          ? <AlertCircle className={`w-4 h-4 ${cfg.color}`}/>
                          : <Clock className={`w-4 h-4 ${cfg.color}`}/>
                        }
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {job.template?.name ?? 'Unknown Template'}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                          <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                          <span>·</span>
                          <span>{timeAgo(job.createdAt)}</span>
                          {job.useAi && <span className="text-violet-500 font-medium">· AI</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-gray-900 tabular-nums">
                        {job.generatedPages}/{job.totalPages}
                      </div>
                      <div className="text-xs text-gray-400">pages</div>
                    </div>
                  </div>

                  {job.totalPages > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500
                          ${job.status==='COMPLETED' ? 'bg-emerald-500'
                          : job.status==='FAILED' ? 'bg-red-400'
                          : 'bg-indigo-500'}`}
                          style={{ width:`${job.progressPct}%` }}/>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>{job.progressPct}% complete</span>
                        {job.failedPages > 0 && (
                          <span className="text-red-400">{job.failedPages} failed</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}