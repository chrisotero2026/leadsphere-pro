import { Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalLeads,
      newLeadsThisMonth,
      newLeadsLastMonth,
      leadsByStatus,
      leadsByTemperature,
      topAgents,
      recentActivity,
      conversionRate,
    ] = await Promise.all([
      prisma.lead.count(),

      prisma.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.lead.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),

      prisma.lead.groupBy({
        by: ['status'],
        _count: { status: true },
        orderBy: { _count: { status: 'desc' } },
      }),

      prisma.lead.groupBy({
        by: ['temperature'],
        _count: { temperature: true },
      }),

      prisma.user.findMany({
        take: 5,
        include: {
          _count: { select: { assignedLeads: true, activities: true } },
          role: { select: { name: true } },
        },
        orderBy: { assignedLeads: { _count: 'desc' } },
        where: { status: 'ACTIVE' },
      }),

      prisma.crmActivity.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, avatar: true } },
          lead: { select: { firstName: true, lastName: true } },
        },
      }),

      prisma.lead.count({ where: { status: { in: ['CLOSED_WON'] } } }),
    ]);

    const avgScore = await prisma.lead.aggregate({ _avg: { score: true } });

    const monthlyGrowth = newLeadsLastMonth > 0
      ? Math.round(((newLeadsThisMonth - newLeadsLastMonth) / newLeadsLastMonth) * 100)
      : 100;

    return sendSuccess(res, {
      overview: {
        totalLeads,
        newLeadsThisMonth,
        monthlyGrowth,
        avgScore: Math.round(avgScore._avg.score || 0),
        conversionRate: totalLeads > 0 ? Math.round((conversionRate / totalLeads) * 100) : 0,
      },
      pipeline: leadsByStatus.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      temperature: leadsByTemperature.map((t) => ({
        temperature: t.temperature,
        count: t._count.temperature,
      })),
      topAgents: topAgents.map((a) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        role: a.role.name,
        assignedLeads: a._count.assignedLeads,
        activities: a._count.activities,
      })),
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};
