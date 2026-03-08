import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

const createActivitySchema = z.object({
  leadId: z.string().uuid(),
  type: z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'SMS', 'STATUS_CHANGE']),
  subject: z.string().optional(),
  body: z.string().min(1),
  outcome: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const getActivities = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const leadId = req.query.leadId as string;
    const where = leadId ? { leadId } : {};

    const activities = await prisma.crmActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return sendSuccess(res, activities);
  } catch (error) {
    next(error);
  }
};

export const createActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createActivitySchema.parse(req.body);

    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) return sendError(res, 'Lead not found', 404);

    const activity = await prisma.crmActivity.create({
      data: {
        leadId: data.leadId,
        userId: req.user!.userId,
        type: data.type,
        subject: data.subject,
        body: data.body,
        outcome: data.outcome,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    return sendSuccess(res, activity, 'Activity logged', 201);
  } catch (error) {
    next(error);
  }
};

export const deleteActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const activity = await prisma.crmActivity.findUnique({ where: { id: req.params.id } });
    if (!activity) return sendError(res, 'Activity not found', 404);

    if (activity.userId !== req.user!.userId && req.user!.roleName !== 'admin') {
      return sendError(res, 'Cannot delete others\' activities', 403);
    }

    await prisma.crmActivity.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Activity deleted');
  } catch (error) {
    next(error);
  }
};
