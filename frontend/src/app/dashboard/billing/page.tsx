'use client';
// src/app/dashboard/billing/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '@/lib/billingApi';
import Link from 'next/link';
import {
  CreditCard, FileText, TrendingUp, AlertTriangle,
  CheckCircle, Clock, ExternalLink, Download,
  Loader2, ArrowRight, Zap, RefreshCw, X,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  ACTIVE:     { label:'Active',     color:'text-emerald-700', bg:'bg-emerald-50 border-emerald-200', icon:CheckCircle },
  TRIALING:   { label:'Trial',      color:'text-blue-700',    bg:'bg-blue-50 border-blue-200',       icon:Clock },
  PAST_DUE:   { label:'Past Due',   color:'text-red-700',     bg:'bg-red-50 border-red-200',         icon:AlertTriangle },
  CANCELED:   { label:'Canceled',   color:'text-gray-500',    bg:'bg-gray-50 border-gray-200',       icon:X },
  INCOMPLETE: { label:'Incomplete', color:'text-amber-700',   bg:'bg-amber-50 border-amber-200',     icon:AlertTriangle },
  PAUSED:     { label:'Paused',     color:'text-slate-600',   bg:'bg-slate-50 border-slate-200',     icon:Clock },
};

const PAYMENT_STATUS: Record<string, { label:string; color:string }> = {
  SUCCEEDED: { label:'Paid',    color:'text-emerald-600' },
  FAILED:    { label:'Failed',  color:'text-red-500' },
  PENDING:   { label:'Pending', color:'text-amber-500' },
  REFUNDED:  { label:'Refunded',color:'text-blue-500' },
};

function UsageMeter({ label, current, limit, color = 'bg-indigo-500' }: {
  label: string; current: number; limit: number | null; color?: string;
}) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const isUnlimited = limit === null;
  const isHigh = pct >= 80;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`font-semibold ${isHigh && !isUnlimited ? 'text-orange-600' : 'text-gray-600'}`}>
          {isUnlimited ? `${current} / ∞` : `${current} / ${limit}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isHigh ? 'bg-orange-500' : color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="h-2 bg-gradient-to-r from-indigo-300 to-violet-300 rounded-full opacity-50"/>
      )}
    </div>
  );
}

export default function BillingDashboard() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const success = params.get('success');
  const [cancelModal, setCancelModal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data, isLoading: subLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn:  () => subscriptionApi.get().then(r => r.data.data),
  });

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['my-payments'],
    queryFn:  () => subscriptionApi.payments({ limit: 5 }).then(r => r.data),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['my-invoices'],
    queryFn:  () => subscriptionApi.invoices({ limit: 5 }).then(r => r.data),
  });

  const cancelMut = useMutation({
    mutationFn: () => subscriptionApi.cancel(),
    onSuccess: () => {
      setCancelModal(false);
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
    },
  });

  const reactivateMut = useMutation({
    mutationFn: () => subscriptionApi.reactivate(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-subscription'] }),
  });

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const r = await subscriptionApi.portal();
      if (r.data.data?.url) window.location.href = r.data.data.url;
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const sub     = data?.subscription;
  const tier    = data?.tier ?? 'FREE';
  const plan    = data?.plan;
  const usage   = data?.usage;
  const features= data?.features;

  const payments = paymentsData?.data ?? [];
  const invoices = invoicesData?.data ?? [];

  const statusCfg = STATUS_CFG[sub?.status ?? 'ACTIVE'] ?? STATUS_CFG.ACTIVE;
  const StatusIcon = statusCfg.icon;

  if (subLoading) return (
    <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-300"/></div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0"/>
          <div>
            <p className="font-bold text-emerald-800">Welcome to LeadSphere {plan?.name ?? tier}! 🎉</p>
            <p className="text-sm text-emerald-700">Your subscription is active. Territories and features are now unlocked.</p>
          </div>
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your plan, payments, and invoices</p>
      </div>

      {/* Current plan card */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Plan badge */}
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-lg"
              style={{ background: plan?.color ?? '#6b7280' }}>
              {tier[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900">{plan?.name ?? tier} Plan</h2>
                {sub && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.color}`}>
                    <StatusIcon className="w-3 h-3"/>
                    {statusCfg.label}
                  </span>
                )}
              </div>
              {sub ? (
                <p className="text-sm text-gray-500 mt-0.5">
                  {sub.cancelAtPeriodEnd
                    ? `Cancels ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                    : sub.status === 'TRIALING'
                    ? `Trial ends ${new Date(sub.trialEnd!).toLocaleDateString()}`
                    : `Renews ${new Date(sub.currentPeriodEnd!).toLocaleDateString()}`
                  }
                  {' · '}{sub.interval === 'ANNUAL' ? 'Annual billing' : 'Monthly billing'}
                </p>
              ) : (
                <p className="text-sm text-gray-500">No active subscription</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {!sub || tier === 'FREE' ? (
              <Link href="/plans"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl hover:bg-[#24527a]">
                <Zap className="w-4 h-4"/> Upgrade Plan
              </Link>
            ) : (
              <>
                {sub.cancelAtPeriodEnd ? (
                  <button onClick={() => reactivateMut.mutate()} disabled={reactivateMut.isPending}
                    className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60">
                    {reactivateMut.isPending ? 'Reactivating…' : 'Reactivate'}
                  </button>
                ) : (
                  <button onClick={openPortal} disabled={portalLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-sm font-semibold rounded-xl hover:bg-gray-50 text-gray-700 disabled:opacity-60">
                    {portalLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <ExternalLink className="w-4 h-4"/>}
                    Manage Billing
                  </button>
                )}
                <Link href="/plans"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl hover:bg-[#24527a]">
                  <ArrowRight className="w-4 h-4"/> Change Plan
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Past due alert */}
        {sub?.status === 'PAST_DUE' && (
          <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0"/>
            <p className="text-sm text-red-700 flex-1">
              Your last payment failed. Please update your payment method to keep access.
            </p>
            <button onClick={openPortal}
              className="text-xs font-bold text-red-600 hover:underline whitespace-nowrap">
              Fix Payment →
            </button>
          </div>
        )}
      </div>

      {/* Usage meters */}
      {features && usage && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500"/> Usage this month
            </h2>
            <span className="text-xs text-gray-400">Resets on the 1st</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <UsageMeter
              label="Territories owned"
              current={usage.territories}
              limit={features.maxTerritories}
              color="bg-violet-500"
            />
            <UsageMeter
              label="Leads received"
              current={usage.leadsThisMonth}
              limit={features.maxLeadsPerMonth}
              color="bg-indigo-500"
            />
          </div>
          {tier !== 'ENTERPRISE' && (
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">Need more? Upgrade your plan for higher limits.</p>
              <Link href="/plans" className="text-xs font-bold text-[#1B3A5C] hover:underline">
                View plans →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Payment history */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-500"/> Recent Payments
          </h2>
          <Link href="/dashboard/billing/payments"
            className="text-xs text-[#1B3A5C] font-semibold hover:underline">View all</Link>
        </div>

        {paymentsLoading ? (
          <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-300"/></div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No payments yet</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p: any) => {
              const pCfg = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.PENDING;
              return (
                <div key={p.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.description ?? 'Subscription payment'}</p>
                    <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${Number(p.amount).toFixed(2)}</p>
                    <p className={`text-xs font-semibold ${pCfg.color}`}>{pCfg.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500"/> Invoices
          </h2>
          <Link href="/dashboard/billing/invoices"
            className="text-xs text-[#1B3A5C] font-semibold hover:underline">View all</Link>
        </div>

        {invoices.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No invoices yet</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-400">{new Date(inv.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${Number(inv.total).toFixed(2)}</p>
                    <p className={`text-xs font-semibold ${inv.status === 'PAID' ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {inv.status}
                    </p>
                  </div>
                  {inv.invoicePdfUrl && (
                    <a href={inv.invoicePdfUrl} target="_blank" rel="noreferrer"
                      className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
                      <Download className="w-4 h-4"/>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      {sub && sub.status !== 'CANCELED' && !sub.cancelAtPeriodEnd && (
        <div className="card p-6 border-red-100">
          <h2 className="font-semibold text-gray-900 mb-3">Cancel Subscription</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your subscription will remain active until the end of the current billing period. You can reactivate anytime before then.
          </p>
          <button onClick={() => setCancelModal(true)}
            className="px-4 py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors">
            Cancel Subscription
          </button>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500"/>
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Cancel subscription?</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Your plan will remain active until{' '}
              <strong>{sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'end of period'}</strong>.
              After that, you'll be downgraded to the Free plan and excess territories will be released.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Keep Subscription
              </button>
              <button onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-60">
                {cancelMut.isPending ? 'Canceling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
