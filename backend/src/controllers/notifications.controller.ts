/**
 * notifications.controller.ts
 * Dashboard notification management for the bell icon
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient, NotificationChannel } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { sendSuccess, sendPaginated } from '../utils/response';

const prisma = new PrismaClient();

// ─── Get notifications for logged-in user ────────────────────────────

export const getMyNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit    = Math.min(50, parseInt(req.query.limit as string) || 20);
    const unreadOnly = req.query.unread === 'true';

    const where: any = {
      userId:  req.user!.userId,
      channel: NotificationChannel.DASHBOARD,
    };
    if (unreadOnly) where.readAt = null;

    const [rows, total, unreadCount] = await Promise.all([
      prisma.assignmentNotification.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignment: {
            include: {
              lead: {
                select: { firstName: true, lastName: true, score: true, temperature: true,
                  city: true, stateCode: true, zipCode: true, urgency: true },
              },
              territory: { select: { displayName: true } },
            },
          },
        },
      }),
      prisma.assignmentNotification.count({ where }),
      prisma.assignmentNotification.count({
        where: { userId: req.user!.userId, channel: NotificationChannel.DASHBOARD, readAt: null },
      }),
    ]);

    return sendSuccess(res, {
      notifications: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      unreadCount,
    });
  } catch (e) { next(e); }
};

// ─── Mark notification as read ────────────────────────────────────────

export const markRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.assignmentNotification.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data:  { readAt: new Date() },
    });
    return sendSuccess(res, null, 'Marked as read');
  } catch (e) { next(e); }
};

// ─── Mark all as read ────────────────────────────────────────────────

export const markAllRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.assignmentNotification.updateMany({
      where: {
        userId:  req.user!.userId,
        channel: NotificationChannel.DASHBOARD,
        readAt:  null,
      },
      data: { readAt: new Date() },
    });
    return sendSuccess(res, { updated: result.count }, `${result.count} notifications marked as read`);
  } catch (e) { next(e); }
};

// ─── Get unread count only (for polling) ─────────────────────────────

export const getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.assignmentNotification.count({
      where: {
        userId:  req.user!.userId,
        channel: NotificationChannel.DASHBOARD,
        readAt:  null,
      },
    });
    return sendSuccess(res, { unreadCount: count });
  } catch (e) { next(e); }
};

// ─── Update notification preferences ─────────────────────────────────

export const updateNotificationPrefs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ownershipId, ...prefs } = z.object({
      ownershipId:         z.string().uuid(),
      leadNotifyEmail:     z.boolean().optional(),
      leadNotifySms:       z.boolean().optional(),
      leadNotifyDashboard: z.boolean().optional(),
      webhookUrl:          z.string().url().optional().or(z.literal('')),
    }).parse(req.body);

    const ownership = await prisma.territoryOwnership.findFirst({
      where: { id: ownershipId, userId: req.user!.userId },
    });
    if (!ownership) {
      return sendSuccess(res, null, 'Ownership not found or not yours');
    }

    const updated = await prisma.territoryOwnership.update({
      where: { id: ownershipId },
      data:  { ...prefs, webhookUrl: prefs.webhookUrl || null },
    });

    return sendSuccess(res, updated, 'Notification preferences updated');
  } catch (e) { next(e); }
};
