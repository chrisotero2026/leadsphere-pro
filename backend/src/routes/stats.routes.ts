import { Router } from 'express';
import { getDashboardStats } from '../controllers/stats.controller';
import { authenticate } from '../middleware/auth.middleware';

export const statsRouter = Router();
statsRouter.use(authenticate);
statsRouter.get('/dashboard', getDashboardStats);
