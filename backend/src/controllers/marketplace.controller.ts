/**
 * marketplace.controller.ts
 * Territory & lead marketplace — browsing, purchasing, listing management
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { createMarketplaceCheckout } from '../services/stripe.service';

const prisma = new PrismaClient();

// ─── List marketplace (public, filterable) ────────────────────────────

export const getMarketplaceListings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page     as string) || 1);
    const limit     = Math.min(50, parseInt(req.query.limit    as string) || 20);
    const stateCode = req.query.stateCode as string;
    const type      = req.query.type      as string;
    const minPrice  = parseFloat(req.query.minPrice as string);
    const maxPrice  = parseFloat(req.query.maxPrice as string);
    const sortBy    = (req.query.sortBy as string) || 'priority';
    const search    = req.query.search   as string;

    const where: any = { status: 'ACTIVE' };
    if (stateCode) where.stateCode = stateCode.toUpperCase();
    if (type)      where.type      = type;
    if (!isNaN(minPrice)) where.price = { ...where.price, gte: minPrice };
    if (!isNaN(maxPrice)) where.price = { ...where.price, lte: maxPrice };
    if (search) {
      where.OR = [
        { title:       { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { zipCode:     { contains: search } },
        { city:        { contains: search, mode: 'insensitive' } },
      ];
    }

    const [listings, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: sortBy === 'price'    ? { price: 'asc' }
               : sortBy === 'newest'   ? { createdAt: 'desc' }
               : sortBy === 'leads'    ? { leadsPerMonth: 'desc' }
               :                        { priority: 'desc' },
      }),
      prisma.marketplaceListing.count({ where }),
    ]);

    // Summary stats
    const stats = await prisma.marketplaceListing.aggregate({
      where: { status: 'ACTIVE' },
      _count:true,
      _min:  { price: true },
      _max:  { price: true },
      _avg:  { price: true },
    });

    return res.json({
      data:       listings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      meta: {
        totalActive: stats._count,
        priceRange:  { min: stats._min.price, max: stats._max.price, avg: stats._avg.price },
      },
    });
  } catch (e) { next(e); }
};

// ─── Single listing detail ────────────────────────────────────────────

export const getListingById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
    });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    // If territory listing, include territory details
    let territory = null;
    if (listing.territoryId) {
      territory = await prisma.territory.findUnique({
        where:   { id: listing.territoryId },
        include: { _count: { select: { assignments: true } } },
      });
    }

    return res.json({ data: { ...listing, territory } });
  } catch (e) { next(e); }
};

// ─── Create checkout for marketplace item ─────────────────────────────

export const purchaseListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { listingId } = z.object({ listingId: z.string().uuid() }).parse(req.body);

    const listing = await prisma.marketplaceListing.findUnique({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'ACTIVE') return res.status(409).json({ error: 'Listing is no longer available' });

    const user = await prisma.user.findUnique({
      where:  { id: req.user!.userId },
      select: { email: true, firstName: true, lastName: true },
    });

    // For recurring territory subscriptions — use subscription checkout
    if (listing.isRecurring && listing.recurringPrice) {
      // Create a one-time checkout with territory metadata
      const { url } = await createMarketplaceCheckout({
        userId:       req.user!.userId,
        email:        user!.email,
        name:         `${user!.firstName} ${user!.lastName}`,
        listingId:    listing.id,
        listingTitle: listing.title,
        amount:       Math.round(Number(listing.price) * 100),
        metadata:     { type: 'territory', territoryId: listing.territoryId ?? '' },
      });

      // Create purchase record (pending)
      await prisma.marketplacePurchase.create({
        data: {
          listingId: listing.id,
          buyerId:   req.user!.userId,
          amount:    listing.price,
          status:    'PENDING',
        },
      });

      return res.json({ data: { url, type: 'checkout' } });
    }

    // One-time purchase
    const { url, sessionId } = await createMarketplaceCheckout({
      userId:       req.user!.userId,
      email:        user!.email,
      name:         `${user!.firstName} ${user!.lastName}`,
      listingId:    listing.id,
      listingTitle: listing.title,
      amount:       Math.round(Number(listing.price) * 100),
    });

    // Create purchase record
    await prisma.marketplacePurchase.create({
      data: {
        listingId:      listing.id,
        buyerId:        req.user!.userId,
        amount:         listing.price,
        stripeSessionId:sessionId,
        status:         'PENDING',
      },
    });

    return res.json({ data: { url, sessionId } });
  } catch (e) { next(e); }
};

// ─── Admin: create listing ────────────────────────────────────────────

export const createListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      type:          z.enum(['TERRITORY', 'LEAD_PACKAGE', 'LEAD_CREDIT']),
      territoryId:   z.string().uuid().optional(),
      title:         z.string().min(1).max(200),
      description:   z.string().optional(),
      highlights:    z.array(z.string()).default([]),
      price:         z.coerce.number().positive(),
      isRecurring:   z.boolean().default(false),
      recurringPrice:z.coerce.number().optional(),
      leadsPerMonth: z.coerce.number().optional(),
      medianValue:   z.string().optional(),
      stateCode:     z.string().length(2),
      zipCode:       z.string().optional(),
      city:          z.string().optional(),
      priority:      z.coerce.number().default(0),
    }).parse(req.body);

    const listing = await prisma.marketplaceListing.create({ data: data as any });
    return res.status(201).json({ data: listing, message: 'Listing created' });
  } catch (e) { next(e); }
};

// ─── Admin: bulk seed from territories ───────────────────────────────

export const seedListingsFromTerritories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { stateCode, price = 299, overwrite = false } = z.object({
      stateCode: z.string().length(2).optional(),
      price:     z.coerce.number().positive().default(299),
      overwrite: z.boolean().default(false),
    }).parse(req.body);

    const where: any = { isActive: true, type: { in: ['EXCLUSIVE','MARKETPLACE'] } };
    if (stateCode) where.stateCode = stateCode.toUpperCase();

    // Only seed territories with no active owners
    where.ownerships = { none: { isActive: true } };

    const territories = await prisma.territory.findMany({ where });
    let created = 0, skipped = 0;

    for (const t of territories) {
      const existing = await prisma.marketplaceListing.findFirst({
        where: { territoryId: t.id, status: 'ACTIVE' },
      });
      if (existing && !overwrite) { skipped++; continue; }
      if (existing && overwrite) {
        await prisma.marketplaceListing.update({
          where: { id: existing.id },
          data:  { price, status: 'ACTIVE' },
        });
        created++;
        continue;
      }

      await prisma.marketplaceListing.create({
        data: {
          type:        'TERRITORY',
          territoryId: t.id,
          stateCode:   t.stateCode,
          zipCode:     t.zipCode ?? undefined,
          city:        t.city ?? undefined,
          title:       `Exclusive Territory: ${t.displayName}`,
          description: `Own all leads from ${t.displayName} — exclusive, never shared.`,
          highlights: [
            `Exclusive ZIP: ${t.zipCode ?? 'City-wide'}`,
            t.leadsPerMonth ? `~${t.leadsPerMonth} leads/month` : 'Growing market',
            'Auto-assigned leads',
            'Email + SMS notifications',
          ],
          price:        t.monthlyPrice ?? price,
          isRecurring:  true,
          recurringPrice:t.monthlyPrice ?? price,
          leadsPerMonth: t.leadsPerMonth,
          priority:     t.priority,
          status:       'ACTIVE',
        },
      });
      created++;
    }

    return res.json({
      data:    { created, skipped, total: territories.length },
      message: `Seeded ${created} marketplace listings`,
    });
  } catch (e) { next(e); }
};

// ─── Admin: update listing ────────────────────────────────────────────

export const updateListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      title:         z.string().optional(),
      description:   z.string().optional(),
      price:         z.coerce.number().optional(),
      isRecurring:   z.boolean().optional(),
      status:        z.enum(['ACTIVE','EXPIRED','REMOVED']).optional(),
      priority:      z.coerce.number().optional(),
      highlights:    z.array(z.string()).optional(),
    }).parse(req.body);

    const listing = await prisma.marketplaceListing.update({
      where: { id: req.params.id },
      data,
    });

    return res.json({ data: listing, message: 'Listing updated' });
  } catch (e) { next(e); }
};

// ─── Get my purchases ─────────────────────────────────────────────────

export const getMyPurchases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const purchases = await prisma.marketplacePurchase.findMany({
      where:   { buyerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: { listing: true },
    });
    return res.json({ data: purchases });
  } catch (e) { next(e); }
};

// ─── Admin: revenue stats ─────────────────────────────────────────────

export const getRevenueStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      totalRevenue, subscriptionRevenue, marketplaceRevenue,
      activeSubCount, activeListings, soldListings,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum:  { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', subscriptionId: { not: null } },
        _sum:  { amount: true },
      }),
      prisma.marketplacePurchase.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum:  { amount: true },
      }),
      prisma.subscription.count({
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
      }),
      prisma.marketplaceListing.count({ where: { status: 'ACTIVE' } }),
      prisma.marketplaceListing.count({ where: { status: 'SOLD' } }),
    ]);

    // Subscriptions by tier
    const subsByTier = await prisma.subscription.groupBy({
      by:     ['planId'],
      where:  { status: { in: ['ACTIVE', 'TRIALING'] } },
      _count: true,
    });

    return res.json({
      data: {
        revenue: {
          total:        totalRevenue._sum.amount ?? 0,
          subscription: subscriptionRevenue._sum.amount ?? 0,
          marketplace:  marketplaceRevenue._sum.amount ?? 0,
        },
        activeSubscriptions: activeSubCount,
        listings:     { active: activeListings, sold: soldListings },
        subsByTier,
      },
    });
  } catch (e) { next(e); }
};
