import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zipCode: z.string().max(10).optional(),
  propertyType: z.enum(['SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'LAND', 'COMMERCIAL']).optional(),
  estimatedValue: z.number().positive().optional(),
  urgency: z.enum(['IMMEDIATE', 'THREE_MONTHS', 'SIX_MONTHS', 'EXPLORING']).optional(),
  score: z.number().min(0).max(100).optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  assignToUserId: z.string().uuid().optional(),
});

const updateLeadSchema = createLeadSchema.partial();

// ── Calculate score based on data completeness and urgency ────────
const calculateScore = (data: Partial<z.infer<typeof createLeadSchema>>): number => {
  let score = 0;
  if (data.email) score += 15;
  if (data.phone) score += 15;
  if (data.address) score += 10;
  if (data.zipCode) score += 10;
  if (data.propertyType) score += 10;
  if (data.estimatedValue) score += 10;
  if (data.urgency === 'IMMEDIATE') score += 30;
  else if (data.urgency === 'THREE_MONTHS') score += 20;
  else if (data.urgency === 'SIX_MONTHS') score += 10;
  return Math.min(score, 100);
};

const getTemperature = (score: number) => {
  if (score >= 70) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
};

export const getLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const status = req.query.status as string;
    const temperature = req.query.temperature as string;
    const search = req.query.search as string;
    const assignedTo = req.query.assignedTo as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (temperature) where.temperature = temperature;
    if (assignedTo) {
      where.assignments = { some: { userId: assignedTo, isActive: true } };
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { zipCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
          assignments: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
            },
          },
          tags: { include: { tag: true } },
          _count: { select: { activities: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return sendPaginated(res, leads, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const getLeadById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignments: {
          where: { isActive: true },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        tags: { include: { tag: true } },
      },
    });

    if (!lead) return sendError(res, 'Lead not found', 404);
    return sendSuccess(res, lead);
  } catch (error) {
    next(error);
  }
};

export const createLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createLeadSchema.parse(req.body);

    const score = data.score ?? calculateScore(data);
    const temperature = data.temperature ?? getTemperature(score);

    const lead = await prisma.lead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state || 'VA',
        zipCode: data.zipCode,
        propertyType: data.propertyType,
        estimatedValue: data.estimatedValue,
        urgency: data.urgency,
        score,
        temperature,
        status: data.status || 'NEW',
        source: data.source || 'manual',
        notes: data.notes,
        createdById: req.user!.userId,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignments: true,
      },
    });

    // Assign to user if specified
    if (data.assignToUserId) {
      await prisma.leadAssignment.create({
        data: { leadId: lead.id, userId: data.assignToUserId },
      });
    }

    // Log activity
    await prisma.crmActivity.create({
      data: {
        leadId: lead.id,
        userId: req.user!.userId,
        type: 'NOTE',
        body: `Lead created from source: ${data.source || 'manual'}`,
      },
    });

    return sendSuccess(res, lead, 'Lead created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateLeadSchema.parse(req.body);
    const leadId = req.params.id;

    const existing = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!existing) return sendError(res, 'Lead not found', 404);

    // Recalculate score if relevant fields changed
    const mergedData = { ...existing, ...data };
    const score = data.score ?? calculateScore(mergedData as z.infer<typeof createLeadSchema>);
    const temperature = data.temperature ?? getTemperature(score);

    // Detect status change for activity log
    const statusChanged = data.status && data.status !== existing.status;

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...data,
        score,
        temperature,
        estimatedValue: data.estimatedValue,
        assignToUserId: undefined,
      } as any,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignments: {
          where: { isActive: true },
          include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
        tags: { include: { tag: true } },
      },
    });

    if (statusChanged) {
      await prisma.crmActivity.create({
        data: {
          leadId,
          userId: req.user!.userId,
          type: 'STATUS_CHANGE',
          body: `Status changed from ${existing.status} to ${data.status}`,
        },
      });
    }

    return sendSuccess(res, lead, 'Lead updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Lead deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const assignLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);
    const leadId = req.params.id;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return sendError(res, 'Lead not found', 404);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, 'User not found', 404);

    const assignment = await prisma.leadAssignment.upsert({
      where: { leadId_userId: { leadId, userId } },
      create: { leadId, userId, isActive: true },
      update: { isActive: true },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    await prisma.crmActivity.create({
      data: {
        leadId,
        userId: req.user!.userId,
        type: 'NOTE',
        body: `Lead assigned to ${user.firstName} ${user.lastName}`,
      },
    });

    return sendSuccess(res, assignment, 'Lead assigned successfully');
  } catch (error) {
    next(error);
  }
};

export const unassignLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const leadId = req.params.id;

    await prisma.leadAssignment.updateMany({
      where: { leadId, userId },
      data: { isActive: false },
    });

    return sendSuccess(res, null, 'Lead unassigned successfully');
  } catch (error) {
    next(error);
  }
};

export const bulkUpdateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids, status } = z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
      status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),
    }).parse(req.body);

    const result = await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    return sendSuccess(res, { updated: result.count }, `${result.count} leads updated`);
  } catch (error) {
    next(error);
  }
};
