/**
 * territories.controller.ts
 * CRUD + ownership management + territory purchase
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { auditLog } from '../utils/audit';

const prisma = new PrismaClient();

// ─── Schemas ──────────────────────────────────────────────────────────

const territorySchema = z.object({
  zipCode:     z.string().optional(),
  city:        z.string().optional(),
  county:      z.string().optional(),
  stateCode:   z.string().length(2),
  displayName: z.string().min(1).max(200),
  type:        z.enum(['EXCLUSIVE', 'SHARED', 'AUCTION', 'MARKETPLACE']).default('EXCLUSIVE'),
  maxOwners:   z.coerce.number().int().min(1).max(10).default(1),
  monthlyPrice:z.coerce.number().positive().optional(),
  setupFee:    z.coerce.number().optional(),
  leadsPerMonth:z.coerce.number().optional(),
  description: z.string().optional(),
  notes:       z.string().optional(),
  isActive:    z.boolean().default(true),
  priority:    z.coerce.number().default(0),
});

// ─── List territories ─────────────────────────────────────────────────

export const getTerritories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit    = Math.min(100, parseInt(req.query.limit as string) || 25);
    const search   = req.query.search   as string;
    const stateCode= req.query.stateCode as string;
    const type     = req.query.type     as string;
    const available= req.query.available as string; // 'true' = no owners
    const sortBy   = (req.query.sortBy  as string) || 'priority';
    const sortDir  = (req.query.sortDir as string) === 'asc' ? 'asc' : 'desc';

    const where: any = {};
    if (stateCode) where.stateCode = stateCode.toUpperCase();
    if (type)      where.type      = type;
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { zipCode:     { contains: search } },
        { city:        { contains: search, mode: 'insensitive' } },
      ];
    }
    if (available === 'true') {
      where.ownerships = { none: { isActive: true } };
    }

    const [rows, total] = await Promise.all([
      prisma.territory.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { [sortBy]: sortDir },
        include: {
          ownerships: {
            where: { isActive: true },
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
          },
          _count: { select: { assignments: true } },
        },
      }),
      prisma.territory.count({ where }),
    ]);

    return sendPaginated(res, rows, total, page, limit);
  } catch (e) { next(e); }
};

// ─── Single territory ─────────────────────────────────────────────────

export const getTerritoryById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await prisma.territory.findUnique({
      where: { id: req.params.id },
      include: {
        ownerships: {
          where: { isActive: true },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          take: 10,
          include: { lead: { select: { firstName: true, lastName: true, score: true, temperature: true } } },
        },
        _count: { select: { assignments: true, ownerships: true } },
      },
    });
    if (!t) return sendError(res, 'Territory not found', 404);
    return sendSuccess(res, t);
  } catch (e) { next(e); }
};

// ─── Create territory ─────────────────────────────────────────────────

export const createTerritory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = territorySchema.parse(req.body);

    // Validate: exclusive territories can only have 1 owner
    if (data.type === 'EXCLUSIVE') data.maxOwners = 1;

    const t = await prisma.territory.create({ data: data as any });

    await auditLog(t.id, req.user!.userId, 'territory_created', { data });
    return sendSuccess(res, t, 'Territory created', 201);
  } catch (e) { next(e); }
};

// ─── Update territory ─────────────────────────────────────────────────

export const updateTerritory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = territorySchema.partial().parse(req.body);
    const before = await prisma.territory.findUnique({ where: { id: req.params.id } });
    const t = await prisma.territory.update({ where: { id: req.params.id }, data: data as any });
    await auditLog(t.id, req.user!.userId, 'territory_updated', { before, after: data });
    return sendSuccess(res, t, 'Territory updated');
  } catch (e) { next(e); }
};

// ─── Delete territory ─────────────────────────────────────────────────

export const deleteTerritory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerships = await prisma.territoryOwnership.count({
      where: { territoryId: req.params.id, isActive: true },
    });
    if (ownerships > 0)
      return sendError(res, 'Cannot delete territory with active owners. Deactivate it instead.', 400);

    await prisma.territory.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Territory deleted');
  } catch (e) { next(e); }
};

// ─── Assign territory to user (admin) ────────────────────────────────

export const assignTerritoryToUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      userId:     z.string().uuid(),
      startDate:  z.coerce.date().optional(),
      endDate:    z.coerce.date().optional(),
      monthlyFee: z.coerce.number().optional(),
      autoRenew:  z.boolean().default(true),
      leadNotifyEmail:    z.boolean().default(true),
      leadNotifySms:      z.boolean().default(false),
      leadNotifyDashboard:z.boolean().default(true),
      webhookUrl: z.string().url().optional(),
    }).parse(req.body);

    const territory = await prisma.territory.findUnique({
      where: { id: req.params.id },
      include: { ownerships: { where: { isActive: true } } },
    });
    if (!territory) return sendError(res, 'Territory not found', 404);

    // Check exclusive limit
    if (territory.type === 'EXCLUSIVE' && territory.ownerships.length >= 1) {
      return sendError(res, 'This exclusive territory already has an owner.', 400);
    }

    // Check max owners for shared territories
    if (territory.ownerships.length >= territory.maxOwners) {
      return sendError(res, `Territory is at capacity (${territory.maxOwners} max owners).`, 400);
    }

    // Check if user already owns this territory
    const existing = await prisma.territoryOwnership.findUnique({
      where: { territoryId_userId: { territoryId: territory.id, userId: body.userId } },
    });
    if (existing?.isActive) {
      return sendError(res, 'User already owns this territory.', 400);
    }

    const ownership = await prisma.territoryOwnership.upsert({
      where: { territoryId_userId: { territoryId: territory.id, userId: body.userId } },
      create: {
        territoryId: territory.id,
        userId:      body.userId,
        startDate:   body.startDate ?? new Date(),
        endDate:     body.endDate,
        monthlyFee:  body.monthlyFee,
        autoRenew:   body.autoRenew,
        leadNotifyEmail:     body.leadNotifyEmail,
        leadNotifySms:       body.leadNotifySms,
        leadNotifyDashboard: body.leadNotifyDashboard,
        webhookUrl:  body.webhookUrl,
        isActive:    true,
      },
      update: {
        isActive:   true,
        startDate:  body.startDate ?? new Date(),
        endDate:    body.endDate,
        monthlyFee: body.monthlyFee,
      },
    });

    await auditLog(territory.id, req.user!.userId, 'ownership_assigned', {
      userId: body.userId, ownershipId: ownership.id,
    });

    return sendSuccess(res, ownership, 'Territory assigned to user', 201);
  } catch (e) { next(e); }
};

// ─── Remove user from territory ───────────────────────────────────────

export const removeTerritoryOwner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);

    await prisma.territoryOwnership.updateMany({
      where: { territoryId: req.params.id, userId },
      data:  { isActive: false, endDate: new Date() },
    });

    await auditLog(req.params.id, req.user!.userId, 'ownership_removed', { userId });
    return sendSuccess(res, null, 'Owner removed from territory');
  } catch (e) { next(e); }
};

// ─── Purchase territory (self-service) ───────────────────────────────

export const purchaseTerritory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      paymentRef:          z.string().optional(), // Stripe payment intent ID
      leadNotifyEmail:     z.boolean().default(true),
      leadNotifySms:       z.boolean().default(false),
      leadNotifyDashboard: z.boolean().default(true),
      webhookUrl:          z.string().url().optional(),
    }).parse(req.body);

    const territory = await prisma.territory.findUnique({
      where: { id: req.params.id },
      include: { ownerships: { where: { isActive: true } } },
    });
    if (!territory) return sendError(res, 'Territory not found', 404);
    if (!territory.isActive || territory.status !== 'ACTIVE') {
      return sendError(res, 'Territory is not available for purchase.', 400);
    }
    if (territory.type === 'EXCLUSIVE' && territory.ownerships.length >= 1) {
      return sendError(res, 'This exclusive territory has already been purchased.', 409);
    }
    if (territory.ownerships.length >= territory.maxOwners) {
      return sendError(res, 'Territory is at full capacity.', 409);
    }

    const existing = territory.ownerships.find(o => o.userId === req.user!.userId);
    if (existing) return sendError(res, 'You already own this territory.', 400);

    // In production: validate paymentRef with Stripe before proceeding
    const ownership = await prisma.territoryOwnership.create({
      data: {
        territoryId: territory.id,
        userId:      req.user!.userId,
        startDate:   new Date(),
        endDate:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        monthlyFee:  territory.monthlyPrice,
        paymentRef:  body.paymentRef,
        isActive:    true,
        autoRenew:   true,
        leadNotifyEmail:     body.leadNotifyEmail,
        leadNotifySms:       body.leadNotifySms,
        leadNotifyDashboard: body.leadNotifyDashboard,
        webhookUrl:  body.webhookUrl,
      },
    });

    await auditLog(territory.id, req.user!.userId, 'territory_purchased', {
      ownershipId: ownership.id, paymentRef: body.paymentRef,
    });

    return sendSuccess(res, { territory, ownership }, 'Territory purchased successfully', 201);
  } catch (e) { next(e); }
};

// ─── Get available territories for marketplace ────────────────────────

export const getAvailableTerritories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stateCode = req.query.stateCode as string;
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    const where: any = {
      isActive: true,
      status:   'ACTIVE',
      ownerships: { none: { isActive: true } },
    };
    if (stateCode) where.stateCode = stateCode.toUpperCase();

    const [rows, total] = await Promise.all([
      prisma.territory.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: [{ priority: 'desc' }, { leadsPerMonth: 'desc' }],
      }),
      prisma.territory.count({ where }),
    ]);

    return sendPaginated(res, rows, total, page, limit);
  } catch (e) { next(e); }
};

// ─── My territories (for logged-in user) ────────────────────────────

export const getMyTerritories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerships = await prisma.territoryOwnership.findMany({
      where: { userId: req.user!.userId, isActive: true },
      include: {
        territory: {
          include: {
            _count: { select: { assignments: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    return sendSuccess(res, ownerships);
  } catch (e) { next(e); }
};

// ─── Bulk seed territories from locations table ───────────────────────

export const seedTerritoriesFromLocations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { stateCode, monthlyPrice, type } = z.object({
      stateCode:    z.string().length(2).optional(),
      monthlyPrice: z.coerce.number().positive().optional(),
      type:         z.enum(['EXCLUSIVE','SHARED','MARKETPLACE']).default('MARKETPLACE'),
    }).parse(req.body);

    const where: any = { isActive: true };
    if (stateCode) where.stateCode = stateCode.toUpperCase();

    const locations = await prisma.location.findMany({ where });
    let created = 0, skipped = 0;

    for (const loc of locations) {
      const existing = await prisma.territory.findFirst({
        where: { zipCode: loc.zipCode, stateCode: loc.stateCode },
      });
      if (existing) { skipped++; continue; }

      await prisma.territory.create({
        data: {
          zipCode:     loc.zipCode,
          city:        loc.city,
          county:      loc.county,
          stateCode:   loc.stateCode,
          displayName: `${loc.city}, ${loc.stateCode} ${loc.zipCode}`,
          type:        type as any,
          status:      'ACTIVE',
          isActive:    true,
          monthlyPrice:monthlyPrice,
          leadsPerMonth:Math.max(1, Math.round((loc.population ?? 50000) / 10000)),
          priority:    loc.priority,
        },
      });
      created++;
    }

    return sendSuccess(res, { created, skipped, total: locations.length },
      `Seeded ${created} territories from locations`);
  } catch (e) { next(e); }
};
