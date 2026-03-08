/**
 * seoGenerator.service.ts
 *
 * Orchestrates bulk page generation.
 * Runs async so the API returns immediately with a job ID.
 * In production, replace the inline runner with BullMQ.
 */

import { PrismaClient, PageStatus, JobStatus } from '@prisma/client';
import { buildVars, buildPath, renderPage, RenderedPage } from './templateEngine.service';
import { generateAiEnhancement, isAiAvailable }           from './aiContent.service';

const prisma = new PrismaClient();

// ─── Options ─────────────────────────────────────────────────────

export interface BulkGenerateOptions {
  templateId:         string;
  locationIds?:       string[];   // empty = all active locations
  stateCode?:         string;     // optional state filter
  useAi?:             boolean;
  overwrite?:         boolean;
  publishNow?:        boolean;
  triggeredBy:        string;     // userId
}

export interface BulkGenerateResult {
  jobId:       string;
  queued:      number;
  message:     string;
}

// ─── Public entry point ───────────────────────────────────────────

export async function startBulkGenerate(opts: BulkGenerateOptions): Promise<BulkGenerateResult> {
  const template = await prisma.seoTemplate.findUnique({ where: { id: opts.templateId } });
  if (!template) throw new Error('Template not found');

  // Build location query
  const where: Record<string, unknown> = { isActive: true };
  if (opts.locationIds?.length) where.id = { in: opts.locationIds };
  if (opts.stateCode)           where.stateCode = opts.stateCode.toUpperCase();

  const locations = await prisma.location.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { city: 'asc' }],
  });

  if (!locations.length) throw new Error('No active locations match the given criteria');

  // Create job record
  const job = await prisma.seoGenerationJob.create({
    data: {
      templateId:  opts.templateId,
      status:      JobStatus.RUNNING,
      totalPages:  locations.length,
      triggeredBy: opts.triggeredBy,
      useAi:       !!(opts.useAi && isAiAvailable()),
      startedAt:   new Date(),
    },
  });

  // Fire and forget — attach error handler so unhandled rejection is caught
  runGeneration(job.id, template as any, locations, opts).catch(async err => {
    console.error(`[SEO Job ${job.id}] Unhandled error:`, err);
    await prisma.seoGenerationJob.update({
      where: { id: job.id },
      data: { status: JobStatus.FAILED, completedAt: new Date() },
    }).catch(() => {});
  });

  return { jobId: job.id, queued: locations.length, message: `Generation started for ${locations.length} pages` };
}

// ─── Internal runner ──────────────────────────────────────────────

async function runGeneration(
  jobId:     string,
  template:  any,
  locations: any[],
  opts:      BulkGenerateOptions
): Promise<void> {
  let generated = 0;
  let failed    = 0;
  const errors: Array<{ loc: string; err: string }> = [];

  for (const loc of locations) {
    try {
      const vars     = buildVars(loc, template.serviceType);
      const fullPath = buildPath(loc, template.serviceType);

      // Skip if exists and overwrite not requested
      const existing = await prisma.seoPage.findUnique({ where: { fullPath } });
      if (existing && !opts.overwrite) { generated++; continue; }

      // Render from template
      let rendered: RenderedPage = renderPage(template, vars);

      // Optionally enhance with AI
      let aiGenerated = false;
      if (opts.useAi && isAiAvailable() && template.aiEnabled) {
        try {
          const ai = await generateAiEnhancement(vars, template.aiPromptAdditions ?? undefined);
          aiGenerated    = true;
          rendered = {
            ...rendered,
            heroHeadline:    ai.heroHeadline,
            heroSubheadline: ai.heroSubheadline,
            // Prepend AI local paragraph before rest of body
            bodyHtml: `<section class="local-insight"><p>${ai.localParagraph}</p><p><em>${ai.uniqueAngle}</em></p></section>\n${rendered.bodyHtml}`,
            faqJson:  [...rendered.faqJson, ...ai.faqItems],
          };
        } catch (aiErr: any) {
          console.warn(`[SEO Job ${jobId}] AI failed for ${fullPath}:`, aiErr.message);
        }
      }

      const pageData = {
        templateId:     opts.templateId,
        locationId:     loc.id,
        fullPath,
        title:          rendered.title,
        metaDescription:rendered.metaDescription,
        h1:             rendered.h1,
        heroHeadline:   rendered.heroHeadline,
        heroSubheadline:rendered.heroSubheadline,
        bodyHtml:       rendered.bodyHtml,
        faqJson:        rendered.faqJson as any,
        schemaJson:     rendered.schemaJson as any,
        ctaText:        rendered.ctaText,
        ctaSubtext:     rendered.ctaSubtext,
        aiGenerated,
        aiGeneratedAt:  aiGenerated ? new Date() : null,
        status:         opts.publishNow ? PageStatus.PUBLISHED : PageStatus.DRAFT,
        publishedAt:    opts.publishNow ? new Date() : null,
      };

      if (existing) {
        await prisma.seoPage.update({ where: { id: existing.id }, data: pageData });
      } else {
        await prisma.seoPage.create({ data: pageData });
      }

      generated++;

      // Progress update every 20 pages
      if (generated % 20 === 0) {
        await prisma.seoGenerationJob.update({
          where: { id: jobId },
          data: { generatedPages: generated },
        }).catch(() => {});
      }

      // Small delay to avoid saturating the DB connection pool
      await sleep(30);

    } catch (err: any) {
      failed++;
      errors.push({ loc: `${loc.city} ${loc.zipCode}`, err: err.message });
    }
  }

  await prisma.seoGenerationJob.update({
    where: { id: jobId },
    data: {
      status:         failed === locations.length ? JobStatus.FAILED : JobStatus.COMPLETED,
      generatedPages: generated,
      failedPages:    failed,
      errorLog:       errors as any,
      completedAt:    new Date(),
    },
  });
}

// ─── Publish / unpublish ──────────────────────────────────────────

export async function publishPage(id: string) {
  return prisma.seoPage.update({
    where: { id },
    data: { status: PageStatus.PUBLISHED, publishedAt: new Date() },
  });
}

export async function unpublishPage(id: string) {
  return prisma.seoPage.update({
    where: { id },
    data: { status: PageStatus.DRAFT, publishedAt: null },
  });
}

// ─── View tracking (fire-and-forget) ─────────────────────────────

export async function trackView(id: string) {
  return prisma.seoPage.update({
    where: { id },
    data: { views: { increment: 1 } },
  }).catch(() => {});
}

// ─── Sitemap rows ─────────────────────────────────────────────────

export async function getSitemapRows(page = 1, limit = 1000) {
  return prisma.seoPage.findMany({
    where: { status: PageStatus.PUBLISHED },
    skip:  (page - 1) * limit,
    take:  limit,
    select: { fullPath: true, updatedAt: true, views: true },
    orderBy: { views: 'desc' },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
