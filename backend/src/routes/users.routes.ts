import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser, getRoles } from '../controllers/users.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get('/roles', getRoles);
usersRouter.get('/', authorize('admin', 'manager'), getUsers);
usersRouter.post('/', authorize('admin'), createUser);
usersRouter.get('/:id', getUserById);
usersRouter.put('/:id', updateUser);
usersRouter.delete('/:id', authorize('admin'), deleteUser);
