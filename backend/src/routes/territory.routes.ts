/**
 * territory.routes.ts
 *
 * Mount in src/index.ts:
 *   import { territoryRouter } from './routes/territory.routes';
 *   app.use('/api/v1/territories', territoryRouter);
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';

import {
  getTerritories, getTerritoryById, createTerritory, updateTerritory, deleteTerritory,
  assignTerritoryToUser, removeTerritoryOwner, purchaseTerritory,
  getAvailableTerritories, getMyTerritories, seedTerritoriesFromLocations,
} from '../controllers/territories.controller';

import {
  getAssignments, getAssignmentById, acceptAssignment, rejectAssignment,
  markWorking, markConverted, redistributeLead, triggerDistribution,
  getDistributionStatsHandler, getUnassignedLeads,
} from '../controllers/assignments.controller';

import {
  getMyNotifications, markRead, markAllRead,
  getUnreadCount, updateNotificationPrefs,
} from '../controllers/notifications.controller';

export const territoryRouter = Router();

territoryRouter.use(authenticate);

// ── Territories ───────────────────────────────────────────────────────
territoryRouter.get( '/',                         getTerritories);
territoryRouter.get( '/available',                getAvailableTerritories);
territoryRouter.get( '/my',                       getMyTerritories);
territoryRouter.post('/seed-from-locations',      authorize('admin'), seedTerritoriesFromLocations);
territoryRouter.get( '/:id',                      getTerritoryById);
territoryRouter.post('/',                         authorize('admin','manager'), createTerritory);
territoryRouter.put( '/:id',                      authorize('admin','manager'), updateTerritory);
territoryRouter.delete('/:id',                    authorize('admin'), deleteTerritory);
territoryRouter.post('/:id/assign-user',          authorize('admin','manager'), assignTerritoryToUser);
territoryRouter.delete('/:id/remove-owner',       authorize('admin','manager'), removeTerritoryOwner);
territoryRouter.post('/:id/purchase',             purchaseTerritory); // any authenticated user

// ── Assignments ───────────────────────────────────────────────────────
territoryRouter.get( '/assignments',              getAssignments);
territoryRouter.get( '/assignments/stats',        authorize('admin','manager'), getDistributionStatsHandler);
territoryRouter.get( '/assignments/unassigned',   authorize('admin','manager'), getUnassignedLeads);
territoryRouter.get( '/assignments/:id',          getAssignmentById);
territoryRouter.post('/assignments/:id/accept',   acceptAssignment);
territoryRouter.post('/assignments/:id/reject',   rejectAssignment);
territoryRouter.post('/assignments/:id/working',  markWorking);
territoryRouter.post('/assignments/:id/convert',  markConverted);
territoryRouter.post('/assignments/redistribute', authorize('admin','manager'), redistributeLead);
territoryRouter.post('/distribute/:leadId',       authorize('admin','manager'), triggerDistribution);

// ── Notifications ─────────────────────────────────────────────────────
territoryRouter.get( '/notifications',            getMyNotifications);
territoryRouter.get( '/notifications/unread-count', getUnreadCount);
territoryRouter.post('/notifications/mark-all-read', markAllRead);
territoryRouter.post('/notifications/:id/read',   markRead);
territoryRouter.put( '/notifications/preferences', updateNotificationPrefs);
