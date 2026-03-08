/**
 * seoPages.controller.ts
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, PageStatus } from '@prisma/client';
import { AuthRequest }  from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import {
  startBulkGenerate, publishPage, unpublishPage,
  trackView, getSitemapRows,
} from '../services/seoGenerator.service';

const prisma = new PrismaClient();

// ─── List pages ───────────────────────────────────────────────────

export const getPages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit   = Math.min(100, parseInt(req.query.limit as string) || 25);
    const status  = req.query.status    as PageStatus;
    const search  = req.query.search    as string;
    const tplId   = req.query.templateId as string;
    const state   = req.query.stateCode  as string;
    const sortBy  = (req.query.sortBy   as string) || 'createdAt';
    const sortDir = (req.query.sortDir  as string) === 'asc' ? 'asc' : 'desc';

    const where: any = {};
    if (status)  where.status     = status;
    if (tplId)   where.templateId = tplId;
    if (state)   where.location   = { stateCode: state.toUpperCase() };
    if (search)  where.OR = [
      { title:    { contains: search, mode: 'insensitive' } },
      { fullPath: { contains: search, mode: 'insensitive' } },
      { location: { city:    { contains: search, mode: 'insensitive' } } },
      { location: { zipCode: { contains: search } } },
    ];

    const [rows, total] = await Promise.all([
      prisma.seoPage.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { [sortBy]: sortDir },
        include: {
          template: { select: { name: true, serviceType: true } },
          location: { select: { city: true, stateCode: true, zipCode: true } },
        },
      }),
      prisma.seoPage.count({ where }),
    ]);
    return sendPaginated(res, rows, total, page, limit);
  } catch (e) { next(e); }
};

// ─── Single page by ID ────────────────────────────────────────────

export const getPageById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await prisma.seoPage.findUnique({
      where: { id: req.params.id },
      include: {
        template: true,
        location: true,
      },
    });
    if (!p) return sendError(res, 'Page not found', 404);
    return sendSuccess(res, p);
  } catch (e) { next(e); }
};

// ─── Public page fetch (by path) ──────────────────────────────────

export const getPublicPage = async (req: any, res: Response, next: NextFunction) => {
  try {
    const fullPath = '/' + (req.params[0] ?? '');
    const p = await prisma.seoPage.findUnique({
      where: { fullPath },
      include: { location: { select: { city: true, stateCode: true, zipCode: true, state: true } } },
    });
    if (!p || p.status !== PageStatus.PUBLISHED)
      return sendError(res, 'Page not found', 404);

    trackView(p.id); // fire-and-forget
    return sendSuccess(res, p);
  } catch (e) { next(e); }
};

// ─── Bulk generate ────────────────────────────────────────────────

export const generatePages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      templateId:  z.string().uuid(),
      locationIds: z.array(z.string().uuid()).optional(),
      stateCode:   z.string().length(2).optional(),
      useAi:       z.boolean().default(false),
      overwrite:   z.boolean().default(false),
      publishNow:  z.boolean().default(false),
    }).parse(req.body);

    const result = await startBulkGenerate({ ...body, triggeredBy: req.user!.userId });
    return sendSuccess(res, result, result.message, 202);
  } catch (e) { next(e); }
};

// ─── Publish / unpublish single page ─────────────────────────────

export const publishHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await publishPage(req.params.id);
    return sendSuccess(res, p, 'Page published');
  } catch (e) { next(e); }
};

export const unpublishHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const p = await unpublishPage(req.params.id);
    return sendSuccess(res, p, 'Page unpublished');
  } catch (e) { next(e); }
};

// ─── Bulk status update ───────────────────────────────────────────

export const bulkAction = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids, action } = z.object({
      ids:    z.array(z.string().uuid()).min(1).max(500),
      action: z.enum(['publish', 'unpublish', 'archive']),
    }).parse(req.body);

    const statusMap = {
      publish:   PageStatus.PUBLISHED,
      unpublish: PageStatus.DRAFT,
      archive:   PageStatus.ARCHIVED,
    };

    const result = await prisma.seoPage.updateMany({
      where: { id: { in: ids } },
      data: {
        status:      statusMap[action],
        publishedAt: action === 'publish' ? new Date() : undefined,
      },
    });
    return sendSuccess(res, { updated: result.count }, `${result.count} pages updated`);
  } catch (e) { next(e); }
};

// ─── Delete single page ───────────────────────────────────────────

export const deletePage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.seoPage.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Page deleted');
  } catch (e) { next(e); }
};

// ─── Dashboard stats ──────────────────────────────────────────────

export const getSeoStats = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [total, published, draft, archived, topPages, byState] = await Promise.all([
      prisma.seoPage.count(),
      prisma.seoPage.count({ where: { status: 'PUBLISHED' } }),
      prisma.seoPage.count({ where: { status: 'DRAFT' } }),
      prisma.seoPage.count({ where: { status: 'ARCHIVED' } }),
      prisma.seoPage.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { views: 'desc' },
        take: 10,
        include: { location: { select: { city: true, stateCode: true, zipCode: true } } },
      }),
      // Group by stateCode via location join  ← Prisma doesn't support this directly,
      // so we use a lightweight raw approximation
      prisma.seoPage.groupBy({
        by: ['locationId'],
        _count: { locationId: true },
      }),
    ]);

    return sendSuccess(res, {
      overview: { total, published, draft, archived },
      topPages,
    });
  } catch (e) { next(e); }
};

// ─── Sitemap XML ──────────────────────────────────────────────────

export const sitemapXml = async (req: any, res: Response, next: NextFunction) => {
  try {
    const page    = parseInt(req.query.page as string) || 1;
    const siteUrl = process.env.SITE_URL ?? 'https://leadsphere.com';
    const rows    = await getSitemapRows(page, 1000);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map(r => `  <url>
    <loc>${siteUrl}${r.fullPath}</loc>
    <lastmod>${r.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${r.views > 100 ? '0.9' : r.views > 10 ? '0.7' : '0.5'}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (e) { next(e); }
};

// ─── Public lead capture from landing page ────────────────────────

export const captureLeadFromPage = async (req: any, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      pageId:        z.string().uuid(),
      firstName:     z.string().min(1),
      lastName:      z.string().min(1),
      email:         z.string().email(),
      phone:         z.string().optional(),
      address:       z.string().optional(),
      city:          z.string().optional(),
      state:         z.string().optional(),
      zipCode:       z.string().optional(),
      propertyType:  z.enum(['SINGLE_FAMILY','MULTI_FAMILY','CONDO','TOWNHOUSE','LAND','COMMERCIAL']).optional(),
      estimatedValue:z.coerce.number().positive().optional(),
      urgency:       z.enum(['IMMEDIATE','THREE_MONTHS','SIX_MONTHS','EXPLORING']).optional(),
    }).parse(req.body);

    const { pageId, ...leadData } = body;

    const page = await prisma.seoPage.findUnique({
      where: { id: pageId },
      include: { location: { select: { stateCode: true, zipCode: true, city: true } } },
    });
    if (!page) return sendError(res, 'Page not found', 404);

    // Deduplicate by email
    const existing = await prisma.lead.findFirst({ where: { email: leadData.email } });

    // Score
    let score = 25;
    if (leadData.phone)         score += 15;
    if (leadData.estimatedValue) score += 10;
    if (leadData.address)        score += 10;
    if (leadData.urgency === 'IMMEDIATE')    score += 30;
    else if (leadData.urgency === 'THREE_MONTHS') score += 15;
    score = Math.min(score, 100);

    // Need a system user to set as createdById
    const sysUser = await prisma.user.findFirst({
      where: { role: { name: 'admin' } },
    });
    if (!sysUser) return sendError(res, 'System not configured — seed the database first', 500);

    let lead;
    if (existing) {
      lead = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          ...leadData,
          score: Math.max(existing.score, score),
          sourceUrl: `${process.env.SITE_URL ?? ''}${page.fullPath}`,
        },
      });
    } else {
      lead = await prisma.lead.create({
        data: {
          ...leadData,
          city:      leadData.city      ?? page.location.city,
          state:     leadData.state     ?? page.location.stateCode,
          zipCode:   leadData.zipCode   ?? page.location.zipCode,
          score,
          temperature: score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD',
          status:    'NEW',
          source:    'seo_landing_page',
          sourceUrl: `${process.env.SITE_URL ?? ''}${page.fullPath}`,
          createdById: sysUser.id,
        } as any,
      });
    }

    // Bump lead counter on page
    await prisma.seoPage.update({
      where: { id: pageId },
      data:  { leads: { increment: existing ? 0 : 1 } },
    }).catch(() => {});

    return sendSuccess(res, { leadId: lead.id, isNew: !existing }, 'Lead captured successfully', 201);
  } catch (e) { next(e); }
};
