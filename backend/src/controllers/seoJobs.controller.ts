/**
 * seoJobs.controller.ts
 */

import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest }  from '../middleware/auth.middleware';
import { sendSuccess, sendPaginated } from '../utils/response';

const prisma = new PrismaClient();

export const getJobs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 15);

    const [rows, total] = await Promise.all([
      prisma.seoGenerationJob.findMany({
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.seoGenerationJob.count(),
    ]);

    // Enrich with template names
    const tplIds = [...new Set(rows.map(r => r.templateId))];
    const tpls   = await prisma.seoTemplate.findMany({
      where:  { id: { in: tplIds } },
      select: { id: true, name: true, serviceType: true },
    });
    const tplMap = new Map(tpls.map(t => [t.id, t]));

    const enriched = rows.map(job => ({
      ...job,
      template:    tplMap.get(job.templateId) ?? null,
      progressPct: job.totalPages > 0
        ? Math.round(((job.generatedPages + job.failedPages) / job.totalPages) * 100)
        : 0,
    }));

    return sendPaginated(res, enriched, total, page, limit);
  } catch (e) { next(e); }
};
