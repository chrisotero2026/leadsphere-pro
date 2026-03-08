/**
 * audit.ts — Utility for territory audit logging
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function auditLog(
  territoryId: string,
  userId:      string,
  action:      string,
  meta:        Record<string, unknown> = {}
) {
  return prisma.territoryAuditLog.create({
    data: { territoryId, userId, action, meta },
  }).catch(err => console.error('[AuditLog]', err));
}
