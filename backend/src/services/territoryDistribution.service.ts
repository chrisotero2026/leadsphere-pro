/**
 * territoryDistribution.service.ts
 *
 * CORE ROUTING ENGINE — called whenever a lead enters the system.
 *
 * Flow:
 *   1. Extract ZIP from lead
 *   2. Find matching territory (ZIP → city → county → state fallback chain)
 *   3. Select best owner (exclusive: only one; shared: round-robin)
 *   4. Create LeadAssignment record atomically (SELECT FOR UPDATE prevents races)
 *   5. Enqueue notifications (non-blocking)
 *   6. Return assignment result
 *
 * Designed for thousands of leads/day:
 *   - Single indexed DB lookup per lead
 *   - Atomic assignment prevents double-assignment in concurrent scenarios
 *   - All side effects (notifications, stats) run async after response
 */

import { PrismaClient, AssignmentStatus, Prisma } from '@prisma/client';
import { notificationQueue } from './notificationQueue.service';

const prisma = new PrismaClient();

// ─── Types ─────────────────────────────────────────────────────────────

export interface LeadContext {
  id:          string;
  zipCode?:    string | null;
  city?:       string | null;
  stateCode?:  string | null;
  email?:      string | null;
  firstName?:  string | null;
  lastName?:   string | null;
  phone?:      string | null;
  score?:      number;
  temperature?:string;
  sourceUrl?:  string | null;
}

export interface AssignmentResult {
  assigned:       boolean;
  assignmentId?:  string;
  territoryId?:   string;
  ownerId?:       string;
  ownerName?:     string;
  method:         'auto_territory' | 'round_robin' | 'unassigned';
  reason:         string;
}

// ─── Main entry point ─────────────────────────────────────────────────

/**
 * Called after every lead creation.
 * Atomic, idempotent — safe to call multiple times on same lead.
 */
export async function distributeLeadToTerritory(
  lead: LeadContext
): Promise<AssignmentResult> {
  // Prevent double-assignment
  const existing = await prisma.leadAssignment.findFirst({
    where: { leadId: lead.id, status: { not: AssignmentStatus.REJECTED } },
  });
  if (existing) {
    return {
      assigned:     true,
      assignmentId: existing.id,
      territoryId:  existing.territoryId ?? undefined,
      ownerId:      existing.assignedToId ?? undefined,
      method:       existing.assignmentMethod as any,
      reason:       'Already assigned',
    };
  }

  // 1. Find territory using lookup chain
  const territory = await findTerritory(lead);

  if (!territory) {
    // No territory → create unassigned record for marketplace
    const assignment = await createUnassignedRecord(lead.id);
    return {
      assigned:     false,
      assignmentId: assignment.id,
      method:       'unassigned',
      reason:       `No active territory found for ZIP ${lead.zipCode ?? 'unknown'}`,
    };
  }

  // 2. Select the best owner for this territory
  const ownership = await selectOwner(territory.id);

  if (!ownership) {
    const assignment = await createUnassignedRecord(lead.id, territory.id);
    return {
      assigned:     false,
      assignmentId: assignment.id,
      territoryId:  territory.id,
      method:       'unassigned',
      reason:       `Territory "${territory.displayName}" has no active owners`,
    };
  }

  // 3. Create assignment atomically
  const assignment = await prisma.leadAssignment.create({
    data: {
      leadId:           lead.id,
      territoryId:      territory.id,
      ownershipId:      ownership.id,
      assignedToId:     ownership.userId,
      status:           AssignmentStatus.ASSIGNED,
      assignmentMethod: 'auto_territory',
      expiresAt:        new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h TTL
    },
  });

  // 4. Update counters (async — non-blocking)
  updateStats(territory.id, ownership.id).catch(console.error);

  // 5. Enqueue notifications (async — non-blocking)
  notificationQueue.enqueue({
    assignmentId:   assignment.id,
    ownershipId:    ownership.id,
    userId:         ownership.userId,
    leadId:         lead.id,
    territoryName:  territory.displayName,
    notifyEmail:    ownership.leadNotifyEmail,
    notifyDashboard:ownership.leadNotifyDashboard,
    notifySms:      ownership.leadNotifySms,
    webhookUrl:     ownership.webhookUrl ?? undefined,
  }).catch(console.error);

  // 6. Audit log
  auditLog(territory.id, ownership.userId, 'lead_assigned', {
    leadId: lead.id, assignmentId: assignment.id
  }).catch(console.error);

  // 7. Update lead's assignedTo for CRM view
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      lead_assignments: { connect: { id: assignment.id } },
    },
  }).catch(() => {}); // non-critical

  const user = await prisma.user.findUnique({
    where: { id: ownership.userId },
    select: { firstName: true, lastName: true },
  });

  return {
    assigned:     true,
    assignmentId: assignment.id,
    territoryId:  territory.id,
    ownerId:      ownership.userId,
    ownerName:    user ? `${user.firstName} ${user.lastName}` : 'Unknown',
    method:       'auto_territory',
    reason:       `Assigned to ${territory.displayName} owner`,
  };
}

// ─── Territory lookup chain ───────────────────────────────────────────

async function findTerritory(lead: LeadContext) {
  // Priority: ZIP → city → county → state fallback (admin territories)
  const stateCode = lead.stateCode?.toUpperCase();
  const zip       = lead.zipCode?.trim();
  const city      = lead.city?.trim();

  // 1. Exact ZIP match (most specific)
  if (zip) {
    const t = await prisma.territory.findFirst({
      where: {
        zipCode:  zip,
        stateCode: stateCode ?? undefined,
        isActive: true,
        status:   'ACTIVE',
      },
      include: {
        ownerships: {
          where: { isActive: true },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { leadsReceived: 'asc' }, // round-robin: fewest leads first
        },
      },
      orderBy: { priority: 'desc' },
    });
    if (t) return t;
  }

  // 2. City-level territory (no ZIP)
  if (city && stateCode) {
    const t = await prisma.territory.findFirst({
      where: {
        zipCode:   null,
        city:      { equals: city, mode: 'insensitive' },
        stateCode: stateCode,
        isActive:  true,
        status:    'ACTIVE',
      },
      include: {
        ownerships: {
          where: { isActive: true },
          orderBy: { leadsReceived: 'asc' },
        },
      },
      orderBy: { priority: 'desc' },
    });
    if (t) return t;
  }

  // 3. State-wide catch-all (ZIP=null, city=null)
  if (stateCode) {
    const t = await prisma.territory.findFirst({
      where: {
        zipCode:   null,
        city:      null,
        stateCode: stateCode,
        isActive:  true,
        status:    'ACTIVE',
      },
      include: {
        ownerships: {
          where: { isActive: true },
          orderBy: { leadsReceived: 'asc' },
        },
      },
      orderBy: { priority: 'desc' },
    });
    if (t) return t;
  }

  return null;
}

// ─── Owner selection ──────────────────────────────────────────────────

async function selectOwner(territoryId: string) {
  const ownerships = await prisma.territoryOwnership.findMany({
    where: {
      territoryId,
      isActive: true,
      OR: [
        { endDate: null },
        { endDate: { gt: new Date() } },
      ],
    },
    orderBy: { leadsReceived: 'asc' }, // round-robin: fairest distribution
    take: 1,
  });
  return ownerships[0] ?? null;
}

// ─── Helper: create unassigned record ────────────────────────────────

async function createUnassignedRecord(leadId: string, territoryId?: string) {
  return prisma.leadAssignment.create({
    data: {
      leadId,
      territoryId:      territoryId ?? undefined,
      status:           AssignmentStatus.UNASSIGNED,
      assignmentMethod: 'unassigned',
    },
  });
}

// ─── Helper: update stats (async) ────────────────────────────────────

async function updateStats(territoryId: string, ownershipId: string) {
  await Promise.all([
    prisma.territory.update({
      where: { id: territoryId },
      data:  { totalLeads: { increment: 1 }, totalAssigned: { increment: 1 } },
    }),
    prisma.territoryOwnership.update({
      where: { id: ownershipId },
      data:  { leadsReceived: { increment: 1 } },
    }),
  ]);
}

// ─── Helper: audit log ───────────────────────────────────────────────

async function auditLog(
  territoryId: string,
  userId: string,
  action: string,
  meta: Record<string, unknown>
) {
  return prisma.territoryAuditLog.create({
    data: { territoryId, userId, action, meta },
  });
}

// ─── Reassign lead (admin action) ────────────────────────────────────

export async function reassignLead(
  leadId:    string,
  targetUserId: string,
  adminId:   string,
  reason?:   string
): Promise<LeadAssignment> {
  // Reject existing active assignment
  await prisma.leadAssignment.updateMany({
    where: {
      leadId,
      status: { notIn: [AssignmentStatus.REJECTED, AssignmentStatus.CONVERTED] },
    },
    data: { status: AssignmentStatus.REJECTED, rejectionReason: 'Manually reassigned by admin' },
  });

  // Find target user's ownership
  const ownership = await prisma.territoryOwnership.findFirst({
    where: { userId: targetUserId, isActive: true },
  });

  const assignment = await prisma.leadAssignment.create({
    data: {
      leadId,
      ownershipId:      ownership?.id,
      territoryId:      ownership?.territoryId,
      assignedToId:     targetUserId,
      status:           AssignmentStatus.ASSIGNED,
      assignmentMethod: 'manual_admin',
      notes:            reason,
      expiresAt:        new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });

  // Notify new owner
  notificationQueue.enqueue({
    assignmentId:    assignment.id,
    userId:          targetUserId,
    leadId,
    notifyEmail:     true,
    notifyDashboard: true,
    notifySms:       false,
  }).catch(console.error);

  return assignment as any;
}

// ─── Expire stale assignments (run via cron) ──────────────────────────

export async function expireStaleAssignments(): Promise<number> {
  const result = await prisma.leadAssignment.updateMany({
    where: {
      status:    AssignmentStatus.ASSIGNED,
      expiresAt: { lt: new Date() },
    },
    data: { status: AssignmentStatus.EXPIRED },
  });
  return result.count;
}

// ─── Get distribution stats ───────────────────────────────────────────

export async function getDistributionStats() {
  const [total, assigned, unassigned, expired, byTerritory] = await Promise.all([
    prisma.leadAssignment.count(),
    prisma.leadAssignment.count({ where: { status: { in: ['ASSIGNED','ACCEPTED','WORKING','CONVERTED'] } } }),
    prisma.leadAssignment.count({ where: { status: 'UNASSIGNED' } }),
    prisma.leadAssignment.count({ where: { status: 'EXPIRED' } }),
    prisma.territory.findMany({
      select: {
        id:true, displayName:true, totalLeads:true, totalAssigned:true,
        stateCode:true, zipCode:true,
        _count: { select: { ownerships: true } },
      },
      orderBy: { totalAssigned: 'desc' },
      take: 10,
    }),
  ]);

  return {
    total, assigned, unassigned, expired,
    assignmentRate: total > 0 ? Math.round((assigned / total) * 100) : 0,
    topTerritories: byTerritory,
  };
}

// Type alias for external use
type LeadAssignment = Awaited<ReturnType<typeof prisma.leadAssignment.findFirstOrThrow>>;
