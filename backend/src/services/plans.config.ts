/**
 * plans.config.ts
 *
 * Single source of truth for all subscription plans.
 * Used by:
 *  - Database seeder
 *  - Frontend pricing page
 *  - Access control middleware
 *  - Stripe price creation
 */

export interface PlanFeatures {
  // Territory limits
  maxTerritories:    number | null;  // null = unlimited
  maxLeadsPerMonth:  number | null;
  maxUsers:          number | null;
  maxSeoPages:       number | null;

  // Feature flags
  aiContent:         boolean;
  callCenterAccess:  boolean;
  advancedAnalytics: boolean;
  apiAccess:         boolean;
  whiteLabel:        boolean;
  prioritySupport:   boolean;
  customIntegrations:boolean;
  webhooks:          boolean;
  teamManagement:    boolean;
}

export interface PlanConfig {
  tier:         string;
  slug:         string;
  name:         string;
  description:  string;
  badge?:       string;
  color:        string;
  monthlyPrice: number;
  annualPrice:  number;   // typically 2 months free
  features:     PlanFeatures;
  highlights:   string[]; // marketing bullets
  sortOrder:    number;
}

export const PLANS: Record<string, PlanConfig> = {

  FREE: {
    tier:        'FREE',
    slug:        'free',
    name:        'Free',
    description: 'Get started with basic lead management',
    color:       '#6b7280',
    monthlyPrice:0,
    annualPrice: 0,
    sortOrder:   0,
    features: {
      maxTerritories:    0,
      maxLeadsPerMonth:  10,
      maxUsers:          1,
      maxSeoPages:       5,
      aiContent:         false,
      callCenterAccess:  false,
      advancedAnalytics: false,
      apiAccess:         false,
      whiteLabel:        false,
      prioritySupport:   false,
      customIntegrations:false,
      webhooks:          false,
      teamManagement:    false,
    },
    highlights: [
      '10 leads/month',
      '5 SEO landing pages',
      'Basic CRM access',
      'Email support',
    ],
  },

  BASIC: {
    tier:        'BASIC',
    slug:        'basic',
    name:        'Basic',
    description: 'For independent realtors getting started',
    color:       '#0ea5e9',
    monthlyPrice:99,
    annualPrice: 990,  // $82.50/mo = ~2 months free
    sortOrder:   1,
    features: {
      maxTerritories:    2,
      maxLeadsPerMonth:  50,
      maxUsers:          2,
      maxSeoPages:       50,
      aiContent:         false,
      callCenterAccess:  false,
      advancedAnalytics: false,
      apiAccess:         false,
      whiteLabel:        false,
      prioritySupport:   false,
      customIntegrations:false,
      webhooks:          true,
      teamManagement:    false,
    },
    highlights: [
      '2 exclusive territories',
      '50 leads/month',
      'Automatic lead routing',
      '50 SEO pages',
      'Email + dashboard notifications',
    ],
  },

  PROFESSIONAL: {
    tier:        'PROFESSIONAL',
    slug:        'professional',
    name:        'Professional',
    description: 'For growing real estate teams and agencies',
    badge:       'Most Popular',
    color:       '#1B3A5C',
    monthlyPrice:299,
    annualPrice: 2990,  // $249/mo
    sortOrder:   2,
    features: {
      maxTerritories:    10,
      maxLeadsPerMonth:  300,
      maxUsers:          10,
      maxSeoPages:       500,
      aiContent:         true,
      callCenterAccess:  true,
      advancedAnalytics: true,
      apiAccess:         false,
      whiteLabel:        false,
      prioritySupport:   false,
      customIntegrations:false,
      webhooks:          true,
      teamManagement:    true,
    },
    highlights: [
      '10 exclusive territories',
      '300 leads/month',
      'AI-enhanced SEO content',
      '500 SEO landing pages',
      'Call center integration',
      'Advanced analytics',
      'Team management (10 seats)',
      'SMS notifications',
    ],
  },

  ENTERPRISE: {
    tier:        'ENTERPRISE',
    slug:        'enterprise',
    name:        'Enterprise',
    description: 'For large brokerages, investors, and white-label operators',
    color:       '#7c3aed',
    monthlyPrice:799,
    annualPrice: 7990,  // $666/mo
    sortOrder:   3,
    features: {
      maxTerritories:    null,  // unlimited
      maxLeadsPerMonth:  null,
      maxUsers:          null,
      maxSeoPages:       null,
      aiContent:         true,
      callCenterAccess:  true,
      advancedAnalytics: true,
      apiAccess:         true,
      whiteLabel:        true,
      prioritySupport:   true,
      customIntegrations:true,
      webhooks:          true,
      teamManagement:    true,
    },
    highlights: [
      'Unlimited territories',
      'Unlimited leads',
      'Unlimited SEO pages',
      'Full API access',
      'White-label ready',
      'Custom integrations',
      'Dedicated account manager',
      'Priority phone support',
      'Custom contract & SLA',
    ],
  },

};

// ── Access control helpers ─────────────────────────────────────────────

export function canAccessFeature(
  feature: keyof PlanFeatures,
  tier: string
): boolean {
  const plan = PLANS[tier];
  if (!plan) return false;
  return Boolean(plan.features[feature]);
}

export function getLimit(
  metric: 'maxTerritories' | 'maxLeadsPerMonth' | 'maxUsers' | 'maxSeoPages',
  tier: string
): number | null {
  const plan = PLANS[tier];
  if (!plan) return 0;
  return plan.features[metric];
}

export function isWithinLimit(
  metric: 'maxTerritories' | 'maxLeadsPerMonth' | 'maxUsers' | 'maxSeoPages',
  current: number,
  tier: string
): boolean {
  const limit = getLimit(metric, tier);
  if (limit === null) return true; // unlimited
  return current < limit;
}

export function getPlanByStripePrice(priceId: string, plans: any[]): any {
  return plans.find(p =>
    p.stripeMonthlyPriceId === priceId || p.stripeAnnualPriceId === priceId
  );
}

// ── Seeder (call from a migration or setup script) ────────────────────

export async function seedPlans(prisma: any) {
  for (const [, config] of Object.entries(PLANS)) {
    await prisma.plan.upsert({
      where:  { tier: config.tier as any },
      update: {
        name:         config.name,
        monthlyPrice: config.monthlyPrice,
        annualPrice:  config.annualPrice,
        features:     config.features,
        description:  config.description,
        badge:        config.badge,
        color:        config.color,
        sortOrder:    config.sortOrder,
        isActive:     true,
      },
      create: {
        tier:         config.tier as any,
        slug:         config.slug,
        name:         config.name,
        monthlyPrice: config.monthlyPrice,
        annualPrice:  config.annualPrice,
        features:     config.features,
        description:  config.description,
        badge:        config.badge,
        color:        config.color,
        sortOrder:    config.sortOrder,
        isActive:     true,
      },
    });
    console.log(`[Plans] Upserted: ${config.name}`);
  }
}
