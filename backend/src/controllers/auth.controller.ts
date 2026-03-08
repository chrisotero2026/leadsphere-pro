import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { signToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().optional(),
  roleId: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return sendError(res, 'Email already registered', 409);
    }

    // Default to "agent" role if not specified
    let roleId = data.roleId;
    if (!roleId) {
      const agentRole = await prisma.role.findUnique({ where: { name: 'agent' } });
      roleId = agentRole?.id;
      if (!roleId) return sendError(res, 'Default role not found. Run seed first.', 500);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        roleId,
      },
      include: { role: true },
    });

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    };

    const token = signToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    const { password: _, ...userWithoutPassword } = user;

    return sendSuccess(
      res,
      { user: userWithoutPassword, token, refreshToken },
      'Registration successful',
      201
    );
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { role: true },
    });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      return sendError(res, 'Invalid email or password', 401);
    }

    if (user.status !== 'ACTIVE') {
      return sendError(res, 'Account is inactive or suspended', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    };

    const token = signToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    const { password: _, ...userWithoutPassword } = user;

    return sendSuccess(res, { user: userWithoutPassword, token, refreshToken }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return sendError(res, 'Refresh token required', 400);

    const decoded = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return sendError(res, 'Invalid refresh token', 401);
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
    };

    return sendSuccess(res, {
      token: signToken(tokenPayload),
      refreshToken: signRefreshToken(tokenPayload),
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        role: true,
        _count: { select: { assignedLeads: true, createdLeads: true } },
      },
    });

    if (!user) return sendError(res, 'User not found', 404);

    const { password: _, ...userWithoutPassword } = user;
    return sendSuccess(res, userWithoutPassword);
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return sendError(res, 'User not found', 404);

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return sendError(res, 'Current password is incorrect', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 12) },
    });

    return sendSuccess(res, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};
