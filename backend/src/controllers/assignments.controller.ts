/**
 * assignments.controller.ts
 * Simplified lead assignment endpoints
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

const createAssignmentSchema = z.object({
  leadId: z.string().uuid(),
  userId: z.string().uuid(),
  notes: z.string().optional(),
});

const updateAssignmentSchema = z.object({
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ── Get all assignments ────────────────────────────────────────────

export const getAssignments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { leadId, userId } = req.query;
    const where: any = {};
    if (leadId) where.leadId = leadId;
    if (userId) where.userId = userId;

    const assignments = await prisma.leadAssignment.findMany({
      where,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return sendSuccess(res, assignments);
  } catch (error) {
    next(error);
  }
};

// ── Get single assignment ──────────────────────────────────────────

export const getAssignment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assignment = await prisma.leadAssignment.findUnique({
      where: { id: req.params.id },
      include: {
        lead: true,
        user: true,
      },
    });

    if (!assignment) return sendError(res, 'Assignment not found', 404);
    return sendSuccess(res, assignment);
  } catch (error) {
    next(error);
  }
};

// ── Create assignment ──────────────────────────────────────────────

export const createAssignment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createAssignmentSchema.parse(req.body);

    // Check if lead exists
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) return sendError(res, 'Lead not found', 404);

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) return sendError(res, 'User not found', 404);

    // Check if assignment already exists
    const existing = await prisma.leadAssignment.findUnique({
      where: { leadId_userId: { leadId: data.leadId, userId: data.userId } },
    });

    if (existing) {
      return sendError(res, 'Lead already assigned to this user', 409);
    }

    const assignment = await prisma.leadAssignment.create({
      data: {
        leadId: data.leadId,
        userId: data.userId,
        notes: data.notes,
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return sendSuccess(res, assignment, 'Assignment created', 201);
  } catch (error) {
    next(error);
  }
};

// ── Update assignment ──────────────────────────────────────────────

export const updateAssignment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateAssignmentSchema.parse(req.body);

    const assignment = await prisma.leadAssignment.update({
      where: { id: req.params.id },
      data,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return sendSuccess(res, assignment, 'Assignment updated');
  } catch (error) {
    next(error);
  }
};

// ── Delete assignment ──────────────────────────────────────────────

export const deleteAssignment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assignment = await prisma.leadAssignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) return sendError(res, 'Assignment not found', 404);

    await prisma.leadAssignment.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Assignment deleted');
  } catch (error) {
    next(error);
  }
};

// ── Get assignments for current user ───────────────────────────────

export const getMyAssignments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assignments = await prisma.leadAssignment.findMany({
      where: { userId: req.user!.userId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, email: true, score: true, temperature: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return sendSuccess(res, assignments);
  } catch (error) {
    next(error);
  }
};

// ── Bulk assign leads ──────────────────────────────────────────────

export const bulkAssignLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { leadIds, userId } = z.object({
      leadIds: z.array(z.string().uuid()),
      userId: z.string().uuid(),
    }).parse(req.body);

    const results = [];
    for (const leadId of leadIds) {
      try {
        const assignment = await prisma.leadAssignment.upsert({
          where: { leadId_userId: { leadId, userId } },
          create: { leadId, userId },
          update: { isActive: true },
        });
        results.push({ leadId, success: true, assignment });
      } catch (err) {
        results.push({ leadId, success: false, error: String(err) });
      }
    }

    return sendSuccess(res, results, `Assigned ${results.filter(r => r.success).length}/${leadIds.length} leads`);
  } catch (error) {
    next(error);
  }
};
