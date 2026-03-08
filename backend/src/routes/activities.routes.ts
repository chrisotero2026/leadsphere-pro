import { Router } from 'express';
import { getActivities, createActivity, deleteActivity } from '../controllers/activities.controller';
import { authenticate } from '../middleware/auth.middleware';

export const activitiesRouter = Router();
activitiesRouter.use(authenticate);
activitiesRouter.get('/', getActivities);
activitiesRouter.post('/', createActivity);
activitiesRouter.delete('/:id', deleteActivity);
