import { Router } from 'express';
import { register, login, refreshToken, getMe, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/refresh', refreshToken);
authRouter.get('/me', authenticate, getMe);
authRouter.put('/change-password', authenticate, changePassword);
