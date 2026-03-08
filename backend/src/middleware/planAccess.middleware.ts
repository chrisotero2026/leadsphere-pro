/**
 * planAccess.middleware.ts
 *
 * Express middleware that enforces plan limits before any protected action.
 *
 * Usage:
 *   router.post('/territories', authenticate, requireFeature('maxTerritories'), createTerritory);
 *   router.post('/seo/generate', authenticate, requireFeature('aiContent'), generatePages);
 *
 * Returns 402 Payment Required with upgrade info when limit exceeded.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { PLANS } from '../services/plans.config';

// Placeholder functions
const checkPlanLimit = async (userId: string, metric: string) => ({
  allowed: true,
  tier: 'PROFESSIONAL',
  current: 0,
  limit: 1000,
});
const checkFeatureAccess = async (userId: string, feature: string) => ({
  allowed: true,
  tier: 'PROFESSIONAL',
  requiredTier: 'BASIC',
});
const getUserPlanTier = async (userId: string) => 'PROFESSIONAL';

// ─── Require a quantitative limit has not been reached ────────────────

export function requireLimit(
  metric: 'maxTerritories' | 'maxLeadsPerMonth' | 'maxUsers' | 'maxSeoPages'
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Admins bypass plan checks
      if (req.user?.userId === process.env.ADMIN_USER_ID) return next();

      const check = await checkPlanLimit(userId, metric);

      if (!check.allowed) {
        const nextPlan = suggestUpgrade(check.tier, metric);
        return res.status(402).json({
          error:     'Plan limit reached',
          code:      'PLAN_LIMIT_EXCEEDED',
          metric,
          current:   check.current,
          limit:     check.limit,
          tier:      check.tier,
          upgrade:   nextPlan,
          upgradeUrl:`/plans?from=${check.tier}`,
          message:   `Your ${check.tier} plan allows ${check.limit} ${metricLabel(metric)}. Upgrade to get more.`,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Require a boolean feature flag ──────────────────────────────────

export function requireFeature(feature: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (req.user?.userId === process.env.ADMIN_USER_ID) return next();

      const check = await checkFeatureAccess(userId, feature);

      if (!check.allowed) {
        return res.status(402).json({
          error:       'Feature not available on your plan',
          code:        'FEATURE_NOT_AVAILABLE',
          feature,
          tier:        check.tier,
          requiredTier:check.requiredTier,
          upgradeUrl:  `/plans?feature=${feature}`,
          message:     `The "${feature}" feature requires the ${check.requiredTier} plan or higher.`,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Attach plan info to request (for downstream use) ────────────────

export async function attachPlanInfo(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (req.user?.userId) {
      const tier = await getUserPlanTier(req.user.userId);
      (req as any).planTier = tier;
      (req as any).plan     = PLANS[tier];
    }
    next();
  } catch {
    next();
  }
}

// ─── Require active subscription (not free) ───────────────────────────

export async function requirePaidPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user?.userId === process.env.ADMIN_USER_ID) return next();

    const tier = await getUserPlanTier(userId);
    if (tier === 'FREE') {
      return res.status(402).json({
        error:     'Paid plan required',
        code:      'PAID_PLAN_REQUIRED',
        tier,
        upgradeUrl:'/plans',
        message:   'Please subscribe to a paid plan to access this feature.',
      });
    }
    next();
  } catch (err) { next(err); }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function metricLabel(metric: string): string {
  const map: Record<string, string> = {
    maxTerritories:   'territories',
    maxLeadsPerMonth: 'leads per month',
    maxUsers:         'team members',
    maxSeoPages:      'SEO pages',
  };
  return map[metric] ?? metric;
}

function suggestUpgrade(currentTier: string, metric: string) {
  const order = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'];
  const idx   = order.indexOf(currentTier);
  const next  = order[idx + 1];
  if (!next) return null;
  const plan = PLANS[next];
  return plan ? { tier: next, name: plan.name, monthlyPrice: plan.monthlyPrice } : null;
}
