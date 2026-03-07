'use client';
// src/components/billing/PlanGate.tsx
//
// Wraps any UI element. Shows it normally if user has access.
// Shows a plan upgrade prompt if they don't.
//
// Usage:
//   <PlanGate feature="aiContent" requiredTier="PROFESSIONAL">
//     <AIContentToggle />
//   </PlanGate>
//
//   <PlanGate metric="maxTerritories" current={3} limit={2}>
//     <AddTerritoryButton />
//   </PlanGate>

import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '@/lib/billingApi';
import { Lock, ArrowRight, Zap } from 'lucide-react';
import Link from 'next/link';
import { PLANS } from '../../../lib/plansConfig'; // import static config on frontend

interface PlanGateProps {
  children:      React.ReactNode;
  feature?:      string;        // boolean feature flag to check
  metric?:       string;        // quantitative limit to check
  current?:      number;        // current usage
  limit?:        number | null; // plan limit (null = unlimited)
  requiredTier?: string;        // override: which tier is needed
  fallback?:     React.ReactNode; // custom fallback (default: upgrade prompt)
  inline?:       boolean;       // compact inline version
}

export function PlanGate({
  children, feature, metric, current, limit, requiredTier, fallback, inline,
}: PlanGateProps) {
  const { data } = useQuery({
    queryKey: ['my-subscription'],
    queryFn:  () => subscriptionApi.get().then(r => r.data.data),
    staleTime: 60 * 1000, // cache for 1 min
  });

  const tier     = data?.tier ?? 'FREE';
  const features = data?.features ?? {};

  // Determine if access is blocked
  let blocked = false;
  if (feature) {
    blocked = !features[feature];
  } else if (metric && limit !== undefined && limit !== null && current !== undefined) {
    blocked = current >= limit;
  }

  if (!blocked) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  const planOrder = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'];
  const nextTier  = requiredTier ?? planOrder[planOrder.indexOf(tier) + 1] ?? 'PROFESSIONAL';
  const nextPlan  = (PLANS as any)[nextTier];

  if (inline) {
    return (
      <div className="inline-flex items-center gap-2">
        <div className="opacity-30 pointer-events-none select-none">{children}</div>
        <Link href={`/plans?upgrade=${nextTier}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700 whitespace-nowrap">
          <Lock className="w-3 h-3"/> Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="opacity-30 pointer-events-none select-none blur-[1px]">{children}</div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-xl">
        <div className="text-center px-6 py-5 max-w-xs">
          <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-violet-600"/>
          </div>
          <p className="font-bold text-gray-900 mb-1">
            {feature
              ? `Requires ${nextPlan?.name ?? nextTier} Plan`
              : `Plan limit reached`}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {metric
              ? `You've reached the maximum for your ${tier} plan. Upgrade to continue.`
              : `This feature is available on ${nextPlan?.name ?? nextTier} and above.`}
          </p>
          <Link href={`/plans?upgrade=${nextTier}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl hover:bg-[#24527a]">
            <Zap className="w-3.5 h-3.5"/> Upgrade to {nextPlan?.name ?? nextTier}
            {nextPlan?.monthlyPrice && <span className="opacity-70">${nextPlan.monthlyPrice}/mo</span>}
            <ArrowRight className="w-3.5 h-3.5"/>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Compact inline upgrade banner ─────────────────────────────────────

export function UpgradeBanner({ tier, feature, metric }: {
  tier: string; feature?: string; metric?: string;
}) {
  const planOrder = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'];
  const nextTier  = planOrder[planOrder.indexOf(tier) + 1] ?? 'PROFESSIONAL';
  const nextPlan  = (PLANS as any)[nextTier];

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-indigo-600"/>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">
            {metric ? 'Plan limit reached' : 'Feature not available'}
          </p>
          <p className="text-xs text-gray-500">
            Upgrade to {nextPlan?.name} to{metric ? ' get more' : ' unlock this'}.
            {nextPlan?.monthlyPrice ? ` Starting at $${nextPlan.monthlyPrice}/mo.` : ''}
          </p>
        </div>
      </div>
      <Link href={`/plans?upgrade=${nextTier}`}
        className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white text-sm font-bold rounded-xl hover:bg-[#24527a]">
        Upgrade <ArrowRight className="w-4 h-4"/>
      </Link>
    </div>
  );
}
