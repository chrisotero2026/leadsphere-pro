/**
 * seoTemplates.controller.ts
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest }  from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { DEFAULT_TEMPLATES } from '../services/defaultTemplates';
import { buildVars, renderPage } from '../services/templateEngine.service';

const prisma = new PrismaClient();

// ─── Validation ───────────────────────────────────────────────────

const templateBody = z.object({
  name:                   z.string().min(1).max(200),
  slug:                   z.string().regex(/^[a-z0-9-]+$/).min(2).max(80),
  serviceType:            z.enum(['SELL_HOUSE_FAST','CASH_OFFER','FORECLOSURE','PROBATE','DIVORCE_SALE','FIRST_TIME_BUYER','REFINANCE','INVESTMENT_PROPERTY']),
  description:            z.string().optional(),
  titleTemplate:          z.string().min(1),
  metaDescTemplate:       z.string().min(1).max(500),
  h1Template:             z.string().min(1),
  heroHeadlineTemplate:   z.string().min(1),
  heroSubheadlineTemplate:z.string().min(1),
  bodyTemplate:           z.string().min(1),
  faqTemplate:            z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  ctaText:                z.string().default('Get My Cash Offer'),
  ctaSubtext:             z.string().optional(),
  aiEnabled:              z.boolean().default(true),
  aiPromptAdditions:      z.string().optional(),
  isActive:               z.boolean().default(true),
});

// ─── Handlers ─────────────────────────────────────────────────────

export const getTemplates = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const search = req.query.search as string;

    const where: any = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [rows, total] = await Promise.all([
      prisma.seoTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { pages: true } } },
      }),
      prisma.seoTemplate.count({ where }),
    ]);
    return sendPaginated(res, rows, total, page, limit);
  } catch (e) { next(e); }
};

export const getTemplateById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const t = await prisma.seoTemplate.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { pages: true } } },
    });
    if (!t) return sendError(res, 'Template not found', 404);
    return sendSuccess(res, t);
  } catch (e) { next(e); }
};

export const createTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = templateBody.parse(req.body);
    const t = await prisma.seoTemplate.create({ data: data as any });
    return sendSuccess(res, t, 'Template created', 201);
  } catch (e) { next(e); }
};

export const updateTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = templateBody.partial().parse(req.body);
    const t = await prisma.seoTemplate.update({ where: { id: req.params.id }, data: data as any });
    return sendSuccess(res, t, 'Template updated');
  } catch (e) { next(e); }
};

export const deleteTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.seoPage.count({ where: { templateId: req.params.id } });
    if (count > 0)
      return sendError(res, `Cannot delete: ${count} pages reference this template. Archive it instead.`, 400);
    await prisma.seoTemplate.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Template deleted');
  } catch (e) { next(e); }
};

// Seed the 3 built-in default templates
export const seedDefaultTemplates = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const seeded: string[] = [];
    for (const [, tpl] of Object.entries(DEFAULT_TEMPLATES)) {
      const exists = await prisma.seoTemplate.findUnique({ where: { slug: tpl.slug } });
      if (!exists) {
        await prisma.seoTemplate.create({ data: tpl as any });
        seeded.push(tpl.name);
      }
    }
    return sendSuccess(res, { seeded }, `Seeded ${seeded.length} templates`);
  } catch (e) { next(e); }
};

// Live preview — render a template against a sample or specific ZIP
export const previewTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { templateId, zipCode } = z.object({
      templateId: z.string().uuid(),
      zipCode:    z.string().optional(),
    }).parse(req.body);

    const t = await prisma.seoTemplate.findUnique({ where: { id: templateId } });
    if (!t) return sendError(res, 'Template not found', 404);

    const loc = zipCode
      ? await prisma.location.findUnique({ where: { zipCode } })
      : await prisma.location.findFirst({ where: { isActive: true }, orderBy: { priority: 'desc' } });

    const mockLoc = loc ?? {
      city: 'Arlington', state: 'Virginia', stateCode: 'VA',
      zipCode: '22201', county: 'Arlington County',
      medianHomeValue: 680000, population: 237000,
    };

    const vars     = buildVars(mockLoc as any, t.serviceType);
    const rendered = renderPage(t as any, vars);
    return sendSuccess(res, { rendered, vars, usingLocation: mockLoc });
  } catch (e) { next(e); }
};
