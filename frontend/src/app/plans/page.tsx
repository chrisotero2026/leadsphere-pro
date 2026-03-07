'use client';
// src/app/plans/page.tsx
// Public pricing page — no auth required

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { plansApi, subscriptionApi } from '@/lib/billingApi';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check, X, Zap, Shield, Map, Brain, Phone, TrendingUp,
  Globe, Code, Star, Users, ArrowRight, Loader2,
} from 'lucide-react';

const FEATURE_ICONS: Record<string, any> = {
  aiContent:         Brain,
  callCenterAccess:  Phone,
  advancedAnalytics: TrendingUp,
  apiAccess:         Code,
  whiteLabel:        Globe,
  webhooks:          Zap,
  teamManagement:    Users,
  prioritySupport:   Shield,
};

const PLAN_COLORS: Record<string, string> = {
  FREE:         '#6b7280',
  BASIC:        '#0ea5e9',
  PROFESSIONAL: '#1B3A5C',
  ENTERPRISE:   '#7c3aed',
};

// Feature comparison table rows
const COMPARISON_FEATURES = [
  { key:'maxTerritories',   label:'Exclusive territories',  format:(v: any) => v === null ? 'Unlimited' : v === 0 ? '—' : v },
  { key:'maxLeadsPerMonth', label:'Leads per month',        format:(v: any) => v === null ? 'Unlimited' : v },
  { key:'maxUsers',         label:'Team seats',             format:(v: any) => v === null ? 'Unlimited' : v },
  { key:'maxSeoPages',      label:'SEO landing pages',      format:(v: any) => v === null ? 'Unlimited' : v === 5 ? '5' : v },
  { key:'aiContent',        label:'AI content generation',  bool: true },
  { key:'callCenterAccess', label:'Call center access',     bool: true },
  { key:'advancedAnalytics',label:'Advanced analytics',     bool: true },
  { key:'webhooks',         label:'Webhook integrations',   bool: true },
  { key:'teamManagement',   label:'Team management',        bool: true },
  { key:'apiAccess',        label:'API access',             bool: true },
  { key:'whiteLabel',       label:'White-label',            bool: true },
  { key:'prioritySupport',  label:'Priority support',       bool: true },
];

interface Plan {
  id: string;
  tier: string;
  name: string;
  monthlyPrice: string;
  annualPrice:  string;
  badge?: string;
  color: string;
  config?: {
    features: Record<string, any>;
    highlights: string[];
    description: string;
  };
}

export default function PlansPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['plans-public'],
    queryFn:  () => plansApi.list().then(r => r.data.data as Plan[]),
  });

  const plans = data?.filter(p => p.tier !== 'FREE') ?? [];
  const freePlan = data?.find(p => p.tier === 'FREE');

  const handleSubscribe = async (tier: string) => {
    if (tier === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@leadsphere.com?subject=Enterprise Plan Inquiry';
      return;
    }
    setLoading(tier);
    try {
      const r = await subscriptionApi.checkout(tier, interval);
      if (r.data.data?.url) window.location.href = r.data.data.url;
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push(`/login?redirect=/plans`);
      }
    } finally {
      setLoading(null);
    }
  };

  const annualDiscount = 17; // ~2 months free

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <div className="text-center pt-16 pb-12 px-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold mb-6">
          <Zap className="w-3.5 h-3.5"/> Transparent pricing — no hidden fees
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4 leading-tight">
          Grow your real estate<br className="hidden sm:block"/> business with LeadSphere
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
          From independent realtors to large brokerages — every plan includes automatic lead distribution, SEO landing pages, and CRM tools.
        </p>

        {/* Interval toggle */}
        <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['monthly', 'annual'] as const).map(i => (
            <button key={i} onClick={() => setInterval(i)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                interval === i
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {i === 'monthly' ? 'Monthly' : (
                <span className="flex items-center gap-2">
                  Annual
                  <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    Save {annualDiscount}%
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-gray-300"/></div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 pb-16">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map(plan => {
              const price = interval === 'annual'
                ? (Number(plan.annualPrice) / 12).toFixed(0)
                : Number(plan.monthlyPrice).toFixed(0);
              const isPopular = plan.badge === 'Most Popular';
              const color = PLAN_COLORS[plan.tier] ?? plan.color;

              return (
                <div key={plan.id}
                  className={`relative rounded-2xl border-2 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl ${
                    isPopular
                      ? 'border-[#1B3A5C] shadow-xl shadow-[#1B3A5C]/10'
                      : 'border-gray-200 shadow-sm'
                  }`}>
                  {isPopular && (
                    <div className="bg-[#1B3A5C] text-white text-center py-2 text-xs font-bold tracking-wider uppercase">
                      ⭐ Most Popular
                    </div>
                  )}

                  <div className={`p-8 ${isPopular ? 'bg-[#1B3A5C] text-white' : 'bg-white'}`}>
                    {/* Plan name */}
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 ${
                      isPopular ? 'bg-white/20' : 'bg-gray-100'
                    }`}>
                      <Map className={`w-6 h-6 ${isPopular ? 'text-white' : ''}`} style={{ color: isPopular ? undefined : color }}/>
                    </div>
                    <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                    <p className={`text-sm mb-6 ${isPopular ? 'text-blue-200' : 'text-gray-500'}`}>
                      {plan.config?.description}
                    </p>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-semibold">$</span>
                        <span className="text-5xl font-black">{price}</span>
                        <span className={`text-sm ${isPopular ? 'text-blue-200' : 'text-gray-400'}`}>/mo</span>
                      </div>
                      {interval === 'annual' && (
                        <p className={`text-xs mt-1 ${isPopular ? 'text-blue-200' : 'text-gray-400'}`}>
                          Billed ${plan.annualPrice}/year
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => handleSubscribe(plan.tier)}
                      disabled={loading === plan.tier}
                      className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        isPopular
                          ? 'bg-white text-[#1B3A5C] hover:bg-blue-50'
                          : 'bg-[#1B3A5C] text-white hover:bg-[#24527a]'
                      } disabled:opacity-70`}>
                      {loading === plan.tier ? (
                        <><Loader2 className="w-4 h-4 animate-spin"/> Processing…</>
                      ) : plan.tier === 'ENTERPRISE' ? (
                        <>Contact Sales <ArrowRight className="w-4 h-4"/></>
                      ) : (
                        <>Get Started <ArrowRight className="w-4 h-4"/></>
                      )}
                    </button>
                  </div>

                  {/* Highlights */}
                  <div className="bg-white border-t border-gray-100 p-8">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-4">What's included</p>
                    <ul className="space-y-3">
                      {(plan.config?.highlights ?? []).map((h, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0"/>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Free plan mention */}
          {freePlan && (
            <p className="text-center text-sm text-gray-400 mt-6">
              Not ready to commit? Start with our{' '}
              <button onClick={() => router.push('/register')} className="text-[#1B3A5C] font-semibold hover:underline">
                Free plan
              </button>{' '}
              — 10 leads/month and 5 SEO pages, no credit card required.
            </p>
          )}
        </div>
      )}

      {/* Feature comparison table */}
      <div className="max-w-5xl mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">Compare all features</h2>

        <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-4 px-6 text-left font-semibold text-gray-700 w-56">Feature</th>
                <th className="py-4 px-4 text-center font-semibold text-gray-400">Free</th>
                {plans.map(p => (
                  <th key={p.id} className={`py-4 px-4 text-center font-bold ${p.badge ? 'text-[#1B3A5C]' : 'text-gray-700'}`}>
                    {p.name} {p.badge && <span className="text-xs text-indigo-500 block font-normal">★ Popular</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((f, i) => (
                <tr key={f.key} className={`border-b border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="py-3.5 px-6 font-medium text-gray-700">{f.label}</td>
                  {/* Free column */}
                  <td className="py-3.5 px-4 text-center text-gray-400">
                    {f.bool
                      ? <X className="w-4 h-4 text-gray-300 mx-auto"/>
                      : f.format?.(0) ?? '—'}
                  </td>
                  {plans.map(p => {
                    const val = p.config?.features?.[f.key];
                    return (
                      <td key={p.id} className="py-3.5 px-4 text-center">
                        {f.bool
                          ? val
                            ? <Check className="w-4 h-4 text-emerald-500 mx-auto"/>
                            : <X className="w-4 h-4 text-gray-300 mx-auto"/>
                          : <span className="font-semibold text-gray-900">{f.format?.(val) ?? val ?? '—'}</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 pb-24">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Frequently asked questions</h2>
        <div className="space-y-4">
          {[
            { q:'Can I change plans anytime?',           a:'Yes — upgrades take effect immediately. Downgrades apply at the next renewal.' },
            { q:'Is there a contract?',                  a:'Monthly plans are pay-as-you-go. Annual plans are prepaid but refundable within 30 days.' },
            { q:'How does territory pricing work?',      a:'Your subscription gives you a set number of territories. Purchase additional ones directly in the Marketplace.' },
            { q:'What happens when I reach my lead limit?', a:"New leads continue to arrive but won't be auto-assigned until next month or you upgrade." },
            { q:'Do you offer a free trial?',            a:'Yes — all paid plans include a 14-day free trial on signup. No credit card required for the Free plan.' },
          ].map(faq => (
            <details key={faq.q} className="border border-gray-200 rounded-xl overflow-hidden group">
              <summary className="flex items-center justify-between cursor-pointer px-6 py-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors list-none">
                {faq.q}
                <span className="text-gray-400 group-open:rotate-45 transition-transform text-xl font-light">+</span>
              </summary>
              <div className="px-6 pb-5 text-sm text-gray-600 leading-relaxed">{faq.a}</div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
