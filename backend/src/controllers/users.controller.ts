import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  roleId: z.string().uuid().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
  roleId: z.string().uuid(),
});

export const getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { id: true, name: true } },
          _count: { select: { assignedLeads: true, createdLeads: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return sendPaginated(res, users, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, name: true, permissions: true } },
        assignedLeads: {
          where: { isActive: true },
          take: 10,
          include: { lead: { select: { id: true, firstName: true, lastName: true, status: true, score: true } } },
        },
        _count: { select: { assignedLeads: true, createdLeads: true, activities: true } },
      },
    });

    if (!user) return sendError(res, 'User not found', 404);
    return sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return sendError(res, 'Email already registered', 409);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        roleId: data.roleId,
        password: await bcrypt.hash(data.password, 12),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, status: true, createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    return sendSuccess(res, user, 'User created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const targetId = req.params.id;

    // Non-admins can only update their own profile
    if (req.user!.roleName !== 'admin' && req.user!.userId !== targetId) {
      return sendError(res, 'You can only update your own profile', 403);
    }

    // Only admins can change roles/status
    if (req.user!.roleName !== 'admin') {
      delete data.roleId;
      delete data.status;
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, avatar: true, status: true,
        role: { select: { id: true, name: true } },
      },
    });

    return sendSuccess(res, user, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.userId) {
      return sendError(res, 'Cannot delete your own account', 400);
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    });

    return sendSuccess(res, null, 'User deactivated successfully');
  } catch (error) {
    next(error);
  }
};

export const getRoles = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    return sendSuccess(res, roles);
  } catch (error) {
    next(error);
  }
};
