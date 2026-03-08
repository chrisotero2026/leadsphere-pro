import { Router } from 'express';
import {
  getLeads, getLeadById, createLead, updateLead,
  deleteLead, assignLead, unassignLead, bulkUpdateStatus
} from '../controllers/leads.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const leadsRouter = Router();

leadsRouter.use(authenticate);

leadsRouter.get('/', getLeads);
leadsRouter.post('/', createLead);
leadsRouter.put('/bulk-status', authorize('admin', 'manager'), bulkUpdateStatus);
leadsRouter.get('/:id', getLeadById);
leadsRouter.put('/:id', updateLead);
leadsRouter.delete('/:id', authorize('admin', 'manager'), deleteLead);
leadsRouter.post('/:id/assign', authorize('admin', 'manager'), assignLead);
leadsRouter.delete('/:id/assign/:userId', authorize('admin', 'manager'), unassignLead);
