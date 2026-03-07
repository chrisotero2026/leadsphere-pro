/**
 * plansConfig.ts — frontend mirror of backend plans.config.ts
 * Used by PlanGate and pricing page without a DB call
 */

export const PLANS: Record<string, {
  name: string; monthlyPrice: number; color: string;
  features: Record<string, any>;
}> = {
  FREE: {
    name: 'Free', monthlyPrice: 0, color: '#6b7280',
    features: {
      maxTerritories: 0, maxLeadsPerMonth: 10, maxUsers: 1, maxSeoPages: 5,
      aiContent: false, callCenterAccess: false, advancedAnalytics: false,
      apiAccess: false, whiteLabel: false, webhooks: false, teamManagement: false,
    },
  },
  BASIC: {
    name: 'Basic', monthlyPrice: 99, color: '#0ea5e9',
    features: {
      maxTerritories: 2, maxLeadsPerMonth: 50, maxUsers: 2, maxSeoPages: 50,
      aiContent: false, callCenterAccess: false, advancedAnalytics: false,
      apiAccess: false, whiteLabel: false, webhooks: true, teamManagement: false,
    },
  },
  PROFESSIONAL: {
    name: 'Professional', monthlyPrice: 299, color: '#1B3A5C',
    features: {
      maxTerritories: 10, maxLeadsPerMonth: 300, maxUsers: 10, maxSeoPages: 500,
      aiContent: true, callCenterAccess: true, advancedAnalytics: true,
      apiAccess: false, whiteLabel: false, webhooks: true, teamManagement: true,
    },
  },
  ENTERPRISE: {
    name: 'Enterprise', monthlyPrice: 799, color: '#7c3aed',
    features: {
      maxTerritories: null, maxLeadsPerMonth: null, maxUsers: null, maxSeoPages: null,
      aiContent: true, callCenterAccess: true, advancedAnalytics: true,
      apiAccess: true, whiteLabel: true, webhooks: true, teamManagement: true,
    },
  },
};
