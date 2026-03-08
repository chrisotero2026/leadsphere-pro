/**
 * seo.routes.ts
 *
 * Mount in src/index.ts:
 *   import { seoRouter } from './routes/seo.routes';
 *   app.use('/api/v1/seo', seoRouter);
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';

import {
  getTemplates, getTemplateById, createTemplate, updateTemplate,
  deleteTemplate, seedDefaultTemplates, previewTemplate,
} from '../controllers/seoTemplates.controller';

import {
  getPages, getPageById, getPublicPage, generatePages,
  publishHandler, unpublishHandler, bulkAction, deletePage,
  getSeoStats, sitemapXml, captureLeadFromPage,
} from '../controllers/seoPages.controller';

import {
  getLocations, createLocation, updateLocation, deleteLocation,
  bulkImport, seedVmdcLocations,
} from '../controllers/locations.controller';

import { getJobs } from '../controllers/seoJobs.controller';

export const seoRouter = Router();

// ── Public ────────────────────────────────────────────────────────
seoRouter.get('/sitemap.xml',        sitemapXml);
seoRouter.get('/public/page/*',      getPublicPage);
seoRouter.post('/public/lead',       captureLeadFromPage);

// ── Authenticated ─────────────────────────────────────────────────
seoRouter.use(authenticate);

// Stats
seoRouter.get('/stats', getSeoStats);

// Templates
seoRouter.get( '/templates',                 getTemplates);
seoRouter.post('/templates/seed-defaults',   authorize('admin'), seedDefaultTemplates);
seoRouter.post('/templates/preview',         previewTemplate);
seoRouter.get( '/templates/:id',             getTemplateById);
seoRouter.post('/templates',                 authorize('admin','manager'), createTemplate);
seoRouter.put( '/templates/:id',             authorize('admin','manager'), updateTemplate);
seoRouter.delete('/templates/:id',           authorize('admin'),           deleteTemplate);

// Pages
seoRouter.get( '/pages',                     getPages);
seoRouter.post('/pages/generate',            authorize('admin','manager'), generatePages);
seoRouter.post('/pages/bulk-action',         authorize('admin','manager'), bulkAction);
seoRouter.get( '/pages/:id',                 getPageById);
seoRouter.post('/pages/:id/publish',         authorize('admin','manager'), publishHandler);
seoRouter.post('/pages/:id/unpublish',       authorize('admin','manager'), unpublishHandler);
seoRouter.delete('/pages/:id',               authorize('admin'),           deletePage);

// Locations
seoRouter.get( '/locations',                 getLocations);
seoRouter.post('/locations/seed-vmdc',       authorize('admin'), seedVmdcLocations);
seoRouter.post('/locations/bulk-import',     authorize('admin'), bulkImport);
seoRouter.post('/locations',                 authorize('admin','manager'), createLocation);
seoRouter.put( '/locations/:id',             authorize('admin','manager'), updateLocation);
seoRouter.delete('/locations/:id',           authorize('admin'),           deleteLocation);

// Jobs
seoRouter.get('/jobs', authorize('admin','manager'), getJobs);
