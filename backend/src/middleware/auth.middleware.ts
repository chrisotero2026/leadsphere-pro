import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { sendError } from '../utils/response';
import { prisma } from '../config/prisma';

export interface AuthRequest extends Request {
  user?: JwtPayload & { permissions: Record<string, boolean> };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No authorization token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return sendError(res, 'User not found or inactive', 401);
    }

    req.user = {
      ...decoded,
      permissions: (user.role.permissions as Record<string, boolean>) || {},
    };

    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired token', 401);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Not authenticated', 401);
    }

    if (!roles.includes(req.user.roleName)) {
      return sendError(res, 'Insufficient permissions', 403);
    }

    next();
  };
};
