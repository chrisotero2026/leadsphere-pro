/**
 * marketplace.controller.ts
 * Simplified marketplace endpoints
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

const createListingSchema = z.object({
  type: z.enum(['TERRITORY', 'LEAD_PACKAGE', 'CUSTOM']),
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  isRecurring: z.boolean().optional(),
  highlights: z.array(z.string()).optional(),
});

// ── Get all listings ────────────────────────────────────────────────

export const getListings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, status } = req.query;
    const where: any = { status: 'ACTIVE' };
    if (type) where.type = type;
    if (status) where.status = status;

    const listings = await prisma.marketplaceListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sendSuccess(res, listings);
  } catch (error) {
    next(error);
  }
};

// ── Get single listing ──────────────────────────────────────────────

export const getListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) return sendError(res, 'Listing not found', 404);
    return sendSuccess(res, listing);
  } catch (error) {
    next(error);
  }
};

// ── Create listing ──────────────────────────────────────────────────

export const createListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createListingSchema.parse(req.body);

    const listing = await prisma.marketplaceListing.create({
      data: {
        ...data,
        sellerId: req.user!.userId,
        status: 'ACTIVE',
      } as any,
    });

    return sendSuccess(res, listing, 'Listing created', 201);
  } catch (error) {
    next(error);
  }
};

// ── Update listing ──────────────────────────────────────────────────

export const updateListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) return sendError(res, 'Listing not found', 404);
    if (listing.sellerId !== req.user!.userId) {
      return sendError(res, 'Not authorized', 403);
    }

    const updated = await prisma.marketplaceListing.update({
      where: { id: req.params.id },
      data: req.body,
    });

    return sendSuccess(res, updated, 'Listing updated');
  } catch (error) {
    next(error);
  }
};

// ── Delete listing ──────────────────────────────────────────────────

export const deleteListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) return sendError(res, 'Listing not found', 404);
    if (listing.sellerId !== req.user!.userId) {
      return sendError(res, 'Not authorized', 403);
    }

    await prisma.marketplaceListing.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'Listing deleted');
  } catch (error) {
    next(error);
  }
};

// ── Get my listings ────────────────────────────────────────────────

export const getMyListings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listings = await prisma.marketplaceListing.findMany({
      where: { sellerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, listings);
  } catch (error) {
    next(error);
  }
};

// ── Purchase listing ────────────────────────────────────────────────

export const purchaseListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { listingId } = z.object({
      listingId: z.string().uuid(),
    }).parse(req.body);

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) return sendError(res, 'Listing not found', 404);

    // Marketplace purchases not yet implemented
    const purchase: any = {
      id: 'mock-purchase',
      listingId,
      buyerId: req.user!.userId,
      amount: listing.price,
      status: 'completed',
    };

    return sendSuccess(res, purchase, 'Purchase completed', 201);
  } catch (error) {
    next(error);
  }
};

// ── Get my purchases ────────────────────────────────────────────────

export const getMyPurchases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Marketplace purchases not yet implemented
    const purchases: any[] = [];

    return sendSuccess(res, purchases);
  } catch (error) {
    next(error);
  }
};
