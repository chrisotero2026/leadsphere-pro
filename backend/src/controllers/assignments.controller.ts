/**
 * assignments.controller.ts
 * Lead assignment management — view, accept, reject, reassign
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, AssignmentStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import {
  distributeLeadToTerritory,
  reassignLead,
  getDistributionStats,
} from '../services/territoryDistribution.service';

const prisma = new PrismaClient();

// ─── List assignments ─────────────────────────────────────────────────

export const getAssignments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 25);
    const status = req.query.status    as string;
    const userId = req.query.userId    as string;
    const isAdmin = ['admin','manager'].includes(req.user!.role ?? '');

    const where: any = {};
    if (status) where.status = status;
    // Non-admins can only see their own assignments
    if (!isAdmin) {
      where.assignedToId = req.user!.userId;
    } else if (userId) {
      where.assignedToId = userId;
    }

    const [rows, total] = await Promise.all([
      prisma.leadAssignment.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { assignedAt: 'desc' },
        include: {
          lead: {
            select: {
              firstName: true, lastName: true, email: true, phone: true,
              city: true, stateCode: true, zipCode: true,
              score: true, temperature: true, urgency: true,
              propertyType: true, estimatedValue: true, createdAt: true,
            },
          },
          territory: { select: { displayName: true, zipCode: true, stateCode: true } },
          assignedTo: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.leadAssignment.count({ where }),
    ]);

    return sendPaginated(res, rows, total, page, limit);
  } catch (e) { next(e); }
};

// ─── Get single assignment ────────────────────────────────────────────

export const getAssignmentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const a = await prisma.leadAssignment.findUnique({
      where: { id: req.params.id },
      include: {
        lead:      true,
        territory: true,
        ownership: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        assignedTo:{ select: { firstName: true, lastName: true, email: true } },
        notifications: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!a) return sendError(res, 'Assignment not found', 404);

    // Owners can only see their own
    if (!['admin','manager'].includes(req.user!.role ?? '') && a.assignedToId !== req.user!.userId) {
      return sendError(res, 'Not authorized', 403);
    }

    return sendSuccess(res, a);
  } catch (e) { next(e); }
};

// ─── Accept assignment ────────────────────────────────────────────────

export const acceptAssignment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const a = await prisma.leadAssignment.findUnique({ where: { id: req.params.id } });
    if (!a) return sendError(res, 'Assignment not found', 404);
    if (a.assignedToId !== req.user!.userId) return sendError(res, 'Not your assignment', 403);
    if (a.status !== AssignmentStatus.ASSIGNED) return sendError(res, 'Assignment already actioned', 400);

    const updated = await prisma.leadAssignment.update({
      where: { id: req.params.id },
      data: { status: AssignmentStatus.ACCEPTED, acceptedAt: new Date() },
    });
    return sendSuccess(res, updated, 'Assignment accepted');
  } catch (e) { next(e); }
};

// ─── Reject assignment ────────────────────────────────────────────────

export const rejectAssignment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const a = await prisma.leadAssignment.findUnique({ where: { id: req.params.id } });
    if (!a) return sendError(res, 'Assignment not found', 404);
    if (a.assignedToId !== req.user!.userId && !['admin'].includes(req.user!.role ?? '')) {
      return sendError(res, 'Not authorized', 403);
    }

    const updated = await prisma.leadAssignment.update({
      where: { id: req.params.id },
      data: {
        status:           AssignmentStatus.REJECTED,
        rejectedAt:       new Date(),
        rejectionReason:  reason,
      },
    });

    // Attempt to re-distribute to next owner
    if (a.leadId && a.territoryId) {
      const lead = await prisma.lead.findUnique({ where: { id: a.leadId } });
      if (lead) {
        distributeLeadToTerritory({
          id:        lead.id,
          zipCode:   lead.zipCode,
          city:      lead.city,
          stateCode: lead.state,
          email:     lead.email,
          firstName: lead.firstName,
          lastName:  lead.lastName,
          score:     lead.score,
        }).catch(console.error);
      }
    }

    return sendSuccess(res, updated, 'Assignment rejected');
  } catch (e) { next(e); }
};

// ─── Mark as working ─────────────────────────────────────────────────

export const markWorking = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const a = await prisma.leadAssignment.findUnique({ where: { id: req.params.id } });
    if (!a) return sendError(res, 'Assignment not found', 404);
    if (a.assignedToId !== req.user!.userId) return sendError(res, 'Not your assignment', 403);

    const updated = await prisma.leadAssignment.update({
      where: { id: req.params.id },
      data: { status: AssignmentStatus.WORKING },
    });
    return sendSuccess(res, updated, 'Lead marked as in-progress');
  } catch (e) { next(e); }
};

// ─── Mark as converted ────────────────────────────────────────────────

export const markConverted = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const a = await prisma.leadAssignment.findUnique({
      where: { id: req.params.id },
      include: { ownership: true },
    });
    if (!a) return sendError(res, 'Assignment not found', 404);

    const updated = await prisma.leadAssignment.update({
      where: { id: req.params.id },
      data: { status: AssignmentStatus.CONVERTED },
    });

    // Increment conversion stats
    if (a.ownershipId) {
      await prisma.territoryOwnership.update({
        where: { id: a.ownershipId },
        data:  { leadsConverted: { increment: 1 } },
      });
    }

    return sendSuccess(res, updated, 'Lead marked as converted 🎉');
  } catch (e) { next(e); }
};

// ─── Manually redistribute a lead ────────────────────────────────────

export const redistributeLead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { leadId, targetUserId, reason } = z.object({
      leadId:       z.string().uuid(),
      targetUserId: z.string().uuid(),
      reason:       z.string().optional(),
    }).parse(req.body);

    const result = await reassignLead(leadId, targetUserId, req.user!.userId, reason);
    return sendSuccess(res, result, 'Lead reassigned');
  } catch (e) { next(e); }
};

// ─── Trigger distribution on existing lead ────────────────────────────

export const triggerDistribution = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId } });
    if (!lead) return sendError(res, 'Lead not found', 404);

    const result = await distributeLeadToTerritory({
      id:        lead.id,
      zipCode:   lead.zipCode,
      city:      lead.city,
      stateCode: lead.state,
      email:     lead.email,
      firstName: lead.firstName,
      lastName:  lead.lastName,
      score:     lead.score,
    });

    return sendSuccess(res, result, result.assigned ? 'Lead distributed' : 'No territory found');
  } catch (e) { next(e); }
};

// ─── Distribution stats ───────────────────────────────────────────────

export const getDistributionStatsHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await getDistributionStats();
    return sendSuccess(res, stats);
  } catch (e) { next(e); }
};

// ─── Unassigned leads (marketplace) ─────────────────────────────────

export const getUnassignedLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    const [rows, total] = await Promise.all([
      prisma.leadAssignment.findMany({
        where: { status: AssignmentStatus.UNASSIGNED },
        skip:  (page - 1) * limit,
        take:  limit,
        orderBy: { assignedAt: 'desc' },
        include: {
          lead: {
            select: {
              firstName: true, lastName: true,
              city: true, stateCode: true, zipCode: true,
              score: true, temperature: true, urgency: true,
            },
          },
          territory: { select: { displayName: true } },
        },
      }),
      prisma.leadAssignment.count({ where: { status: 'UNASSIGNED' } }),
    ]);

    return sendPaginated(res, rows, total, page, limit);
  } catch (e) { next(e); }
};
