/**
 * locations.controller.ts
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest }  from '../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';

const prisma = new PrismaClient();

const locSchema = z.object({
  zipCode:        z.string().min(5).max(10),
  city:           z.string().min(1),
  county:         z.string().optional(),
  state:          z.string().min(1),
  stateCode:      z.string().length(2),
  latitude:       z.coerce.number().optional(),
  longitude:      z.coerce.number().optional(),
  population:     z.coerce.number().optional(),
  medianIncome:   z.coerce.number().optional(),
  medianHomeValue:z.coerce.number().optional(),
  isActive:       z.boolean().default(true),
  priority:       z.coerce.number().default(0),
});

export const getLocations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const state  = req.query.stateCode as string;
    const active = req.query.isActive  as string;
    const search = req.query.search    as string;

    const where: any = {};
    if (state)         where.stateCode = state.toUpperCase();
    if (active === 'true')  where.isActive = true;
    if (active === 'false') where.isActive = false;
    if (search) where.OR = [
      { city:    { contains: search, mode: 'insensitive' } },
      { zipCode: { contains: search } },
    ];

    const [rows, total] = await Promise.all([
      prisma.location.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: [{ priority: 'desc' }, { city: 'asc' }],
        include: { _count: { select: { pages: true } } },
      }),
      prisma.location.count({ where }),
    ]);
    return sendPaginated(res, rows, total, page, limit);
  } catch (e) { next(e); }
};

export const createLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = locSchema.parse(req.body);
    const loc  = await prisma.location.create({ data: data as any });
    return sendSuccess(res, loc, 'Location created', 201);
  } catch (e) { next(e); }
};

export const updateLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = locSchema.partial().parse(req.body);
    const loc  = await prisma.location.update({ where: { id: req.params.id }, data: data as any });
    return sendSuccess(res, loc, 'Location updated');
  } catch (e) { next(e); }
};

export const deleteLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pcount = await prisma.seoPage.count({ where: { locationId: req.params.id } });
    if (pcount > 0)
      return sendError(res, `Cannot delete: ${pcount} pages reference this location`, 400);
    await prisma.location.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Location deleted');
  } catch (e) { next(e); }
};

export const bulkImport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { locations } = z.object({
      locations: z.array(locSchema).min(1).max(2000),
    }).parse(req.body);

    let created = 0, updated = 0;
    for (const loc of locations) {
      const exists = await prisma.location.findUnique({ where: { zipCode: loc.zipCode } });
      if (exists) {
        await prisma.location.update({ where: { id: exists.id }, data: loc as any });
        updated++;
      } else {
        await prisma.location.create({ data: loc as any });
        created++;
      }
    }
    return sendSuccess(res, { created, updated }, `Imported ${locations.length} locations`);
  } catch (e) { next(e); }
};

// ─── Seed VA / MD / DC locations ─────────────────────────────────

const VMDC_LOCS = [
  // ── Virginia ──────────────────────────────────────────────────
  { zipCode:'22201', city:'Arlington',    county:'Arlington County',       state:'Virginia',              stateCode:'VA', population:237000, medianHomeValue:680000, medianIncome:115000, priority:100 },
  { zipCode:'22203', city:'Arlington',    county:'Arlington County',       state:'Virginia',              stateCode:'VA', population:45000,  medianHomeValue:650000, priority:95 },
  { zipCode:'22301', city:'Alexandria',   county:'City of Alexandria',     state:'Virginia',              stateCode:'VA', population:160000, medianHomeValue:590000, medianIncome:95000,  priority:95 },
  { zipCode:'22302', city:'Alexandria',   county:'City of Alexandria',     state:'Virginia',              stateCode:'VA', population:38000,  medianHomeValue:575000, priority:90 },
  { zipCode:'22304', city:'Alexandria',   county:'City of Alexandria',     state:'Virginia',              stateCode:'VA', population:55000,  medianHomeValue:480000, priority:85 },
  { zipCode:'22101', city:'McLean',       county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:48000,  medianHomeValue:1100000,medianIncome:195000, priority:90 },
  { zipCode:'22030', city:'Fairfax',      county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:25000,  medianHomeValue:520000, priority:85 },
  { zipCode:'22031', city:'Fairfax',      county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:28000,  medianHomeValue:545000, priority:82 },
  { zipCode:'22003', city:'Annandale',    county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:42000,  medianHomeValue:480000, priority:80 },
  { zipCode:'22015', city:'Burke',        county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:58000,  medianHomeValue:530000, priority:75 },
  { zipCode:'22150', city:'Springfield',  county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:32000,  medianHomeValue:465000, priority:80 },
  { zipCode:'20190', city:'Reston',       county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:62000,  medianHomeValue:540000, medianIncome:98000,  priority:85 },
  { zipCode:'20191', city:'Reston',       county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:35000,  medianHomeValue:510000, priority:80 },
  { zipCode:'20170', city:'Herndon',      county:'Fairfax County',         state:'Virginia',              stateCode:'VA', population:25000,  medianHomeValue:485000, priority:78 },
  { zipCode:'20148', city:'Ashburn',      county:'Loudoun County',         state:'Virginia',              stateCode:'VA', population:80000,  medianHomeValue:565000, priority:82 },
  { zipCode:'20176', city:'Leesburg',     county:'Loudoun County',         state:'Virginia',              stateCode:'VA', population:58000,  medianHomeValue:520000, priority:78 },
  { zipCode:'20165', city:'Sterling',     county:'Loudoun County',         state:'Virginia',              stateCode:'VA', population:48000,  medianHomeValue:475000, priority:75 },
  { zipCode:'20109', city:'Manassas',     county:'Prince William County',  state:'Virginia',              stateCode:'VA', population:45000,  medianHomeValue:370000, priority:75 },
  { zipCode:'22191', city:'Woodbridge',   county:'Prince William County',  state:'Virginia',              stateCode:'VA', population:52000,  medianHomeValue:365000, priority:75 },
  { zipCode:'22193', city:'Woodbridge',   county:'Prince William County',  state:'Virginia',              stateCode:'VA', population:48000,  medianHomeValue:378000, priority:74 },
  { zipCode:'22554', city:'Stafford',     county:'Stafford County',        state:'Virginia',              stateCode:'VA', population:52000,  medianHomeValue:385000, priority:72 },
  { zipCode:'22401', city:'Fredericksburg',county:'City of Fredericksburg',state:'Virginia',              stateCode:'VA', population:29000,  medianHomeValue:295000, priority:70 },
  { zipCode:'22601', city:'Winchester',   county:'City of Winchester',     state:'Virginia',              stateCode:'VA', population:28000,  medianHomeValue:265000, priority:65 },
  // ── Maryland ───────────────────────────────────────────────────
  { zipCode:'20814', city:'Bethesda',     county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:62000,  medianHomeValue:920000, medianIncome:185000, priority:95 },
  { zipCode:'20815', city:'Bethesda',     county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:38000,  medianHomeValue:980000, priority:90 },
  { zipCode:'20850', city:'Rockville',    county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:68000,  medianHomeValue:580000, medianIncome:98000,  priority:88 },
  { zipCode:'20852', city:'Rockville',    county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:35000,  medianHomeValue:610000, priority:84 },
  { zipCode:'20901', city:'Silver Spring',county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:85000,  medianHomeValue:480000, priority:88 },
  { zipCode:'20902', city:'Silver Spring',county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:72000,  medianHomeValue:455000, priority:85 },
  { zipCode:'20906', city:'Silver Spring',county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:80000,  medianHomeValue:430000, priority:82 },
  { zipCode:'20878', city:'Gaithersburg', county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:68000,  medianHomeValue:490000, priority:80 },
  { zipCode:'20874', city:'Germantown',   county:'Montgomery County',      state:'Maryland',              stateCode:'MD', population:92000,  medianHomeValue:400000, priority:80 },
  { zipCode:'20740', city:'College Park', county:"Prince George's County", state:'Maryland',              stateCode:'MD', population:32000,  medianHomeValue:350000, priority:70 },
  { zipCode:'20770', city:'Greenbelt',    county:"Prince George's County", state:'Maryland',              stateCode:'MD', population:22000,  medianHomeValue:305000, priority:68 },
  { zipCode:'20785', city:'Hyattsville',  county:"Prince George's County", state:'Maryland',              stateCode:'MD', population:40000,  medianHomeValue:285000, priority:70 },
  { zipCode:'20746', city:'Suitland',     county:"Prince George's County", state:'Maryland',              stateCode:'MD', population:28000,  medianHomeValue:260000, priority:65 },
  // ── DC ─────────────────────────────────────────────────────────
  { zipCode:'20001', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:48000,  medianHomeValue:680000, medianIncome:78000,  priority:98 },
  { zipCode:'20002', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:52000,  medianHomeValue:720000, priority:95 },
  { zipCode:'20003', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:42000,  medianHomeValue:850000, priority:95 },
  { zipCode:'20005', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:28000,  medianHomeValue:790000, priority:92 },
  { zipCode:'20007', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:38000,  medianHomeValue:980000, priority:95 },
  { zipCode:'20008', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:35000,  medianHomeValue:1050000,priority:93 },
  { zipCode:'20009', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:52000,  medianHomeValue:790000, priority:92 },
  { zipCode:'20010', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:48000,  medianHomeValue:650000, priority:88 },
  { zipCode:'20011', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:62000,  medianHomeValue:560000, priority:88 },
  { zipCode:'20015', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:32000,  medianHomeValue:920000, priority:90 },
  { zipCode:'20016', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:42000,  medianHomeValue:980000, priority:92 },
  { zipCode:'20019', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:52000,  medianHomeValue:380000, priority:78 },
  { zipCode:'20020', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:45000,  medianHomeValue:360000, priority:76 },
  { zipCode:'20032', city:'Washington',   county:'District of Columbia',   state:'District of Columbia',  stateCode:'DC', population:38000,  medianHomeValue:340000, priority:75 },
];

export const seedVmdcLocations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let created = 0, skipped = 0;
    for (const loc of VMDC_LOCS) {
      const exists = await prisma.location.findUnique({ where: { zipCode: loc.zipCode } });
      if (exists) { skipped++; continue; }
      await prisma.location.create({ data: loc as any });
      created++;
    }
    return sendSuccess(res, { created, skipped, total: VMDC_LOCS.length },
      `Seeded ${created} VA/MD/DC locations`);
  } catch (e) { next(e); }
};
