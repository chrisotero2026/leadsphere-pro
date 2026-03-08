/**
 * notifications.controller.ts
 * Simplified notification endpoints
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

// ── Get notifications ──────────────────────────────────────────────

export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { unreadOnly } = req.query;
    const where: any = {};

    const notifications = await prisma.aiInsight.findMany({
      where: {
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return sendSuccess(res, notifications);
  } catch (error) {
    next(error);
  }
};

// ── Mark notification as read ──────────────────────────────────────

export const markNotificationRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const notification = await prisma.aiInsight.update({
      where: { id },
      data: { isRead: true },
    });

    return sendSuccess(res, notification, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

// ── Mark all as read ───────────────────────────────────────────────

export const markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.aiInsight.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    return sendSuccess(res, result, `Marked ${result.count} notifications as read`);
  } catch (error) {
    next(error);
  }
};

// ── Delete notification ────────────────────────────────────────────

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.aiInsight.delete({ where: { id } });
    return sendSuccess(res, null, 'Notification deleted');
  } catch (error) {
    next(error);
  }
};

// ── Get unread count ───────────────────────────────────────────────

export const getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.aiInsight.count({
      where: { isRead: false },
    });

    return sendSuccess(res, { unreadCount: count });
  } catch (error) {
    next(error);
  }
};

// ── Create notification ────────────────────────────────────────────

export const createNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, body, severity, entityType, entityId } = z.object({
      title: z.string().min(1),
      body: z.string().min(1),
      severity: z.enum(['INFO', 'WARNING', 'URGENT']).optional(),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
    }).parse(req.body);

    const notification = await prisma.aiInsight.create({
      data: {
        title,
        body,
        type: 'SYSTEM_ALERT',
        severity: severity || 'INFO',
        entityType,
        entityId,
      },
    });

    return sendSuccess(res, notification, 'Notification created', 201);
  } catch (error) {
    next(error);
  }
};
