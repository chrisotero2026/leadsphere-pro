import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Roles ────────────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Full system access',
        permissions: { manage_users: true, manage_leads: true, view_reports: true, manage_settings: true },
      },
    }),
    prisma.role.upsert({
      where: { name: 'manager' },
      update: {},
      create: {
        name: 'manager',
        description: 'Manage team and leads',
        permissions: { manage_leads: true, assign_leads: true, view_reports: true, view_users: true },
      },
    }),
    prisma.role.upsert({
      where: { name: 'agent' },
      update: {},
      create: {
        name: 'agent',
        description: 'Work with assigned leads',
        permissions: { view_leads: true, edit_leads: true, log_activities: true },
      },
    }),
    prisma.role.upsert({
      where: { name: 'viewer' },
      update: {},
      create: {
        name: 'viewer',
        description: 'Read-only access',
        permissions: { view_leads: true },
      },
    }),
  ]);

  console.log('✅ Roles created:', roles.map((r) => r.name).join(', '));

  // ── Users ────────────────────────────────────────────────────
  const adminRole = roles.find((r) => r.name === 'admin')!;
  const managerRole = roles.find((r) => r.name === 'manager')!;
  const agentRole = roles.find((r) => r.name === 'agent')!;

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@leadsphere.com' },
      update: {},
      create: {
        email: 'admin@leadsphere.com',
        password: await bcrypt.hash('Admin123!', 12),
        firstName: 'Admin',
        lastName: 'User',
        roleId: adminRole.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'manager@leadsphere.com' },
      update: {},
      create: {
        email: 'manager@leadsphere.com',
        password: await bcrypt.hash('Manager123!', 12),
        firstName: 'Sarah',
        lastName: 'Johnson',
        phone: '+1-571-555-0100',
        roleId: managerRole.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent1@leadsphere.com' },
      update: {},
      create: {
        email: 'agent1@leadsphere.com',
        password: await bcrypt.hash('Agent123!', 12),
        firstName: 'Michael',
        lastName: 'Torres',
        phone: '+1-571-555-0101',
        roleId: agentRole.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'agent2@leadsphere.com' },
      update: {},
      create: {
        email: 'agent2@leadsphere.com',
        password: await bcrypt.hash('Agent123!', 12),
        firstName: 'Emily',
        lastName: 'Chen',
        phone: '+1-571-555-0102',
        roleId: agentRole.id,
      },
    }),
  ]);

  console.log('✅ Users created:', users.map((u) => u.email).join(', '));

  // ── Tags ─────────────────────────────────────────────────────
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { name: 'motivated-seller' }, update: {}, create: { name: 'motivated-seller', color: '#EF4444' } }),
    prisma.tag.upsert({ where: { name: 'foreclosure' }, update: {}, create: { name: 'foreclosure', color: '#F97316' } }),
    prisma.tag.upsert({ where: { name: 'absentee-owner' }, update: {}, create: { name: 'absentee-owner', color: '#8B5CF6' } }),
    prisma.tag.upsert({ where: { name: 'inherited-property' }, update: {}, create: { name: 'inherited-property', color: '#06B6D4' } }),
    prisma.tag.upsert({ where: { name: 'downsizing' }, update: {}, create: { name: 'downsizing', color: '#10B981' } }),
  ]);
  console.log('✅ Tags created');

  // ── Sample Leads ─────────────────────────────────────────────
  const agent1 = users.find((u) => u.email === 'agent1@leadsphere.com')!;
  const agent2 = users.find((u) => u.email === 'agent2@leadsphere.com')!;
  const admin = users.find((u) => u.email === 'admin@leadsphere.com')!;

  const sampleLeads = [
    { firstName: 'Robert', lastName: 'Williams', email: 'rwilliams@email.com', phone: '+1-703-555-0201', address: '1234 Oak Street', city: 'Arlington', state: 'VA', zipCode: '22201', propertyType: 'SINGLE_FAMILY' as const, estimatedValue: 650000, urgency: 'IMMEDIATE' as const, status: 'NEW' as const, score: 85, temperature: 'HOT' as const, source: 'landing_page' },
    { firstName: 'Jennifer', lastName: 'Martinez', email: 'jmartinez@email.com', phone: '+1-301-555-0202', address: '567 Maple Ave', city: 'Bethesda', state: 'MD', zipCode: '20814', propertyType: 'CONDO' as const, estimatedValue: 420000, urgency: 'THREE_MONTHS' as const, status: 'CONTACTED' as const, score: 65, temperature: 'WARM' as const, source: 'google_ads' },
    { firstName: 'David', lastName: 'Brown', email: 'dbrown@email.com', phone: '+1-202-555-0203', address: '890 Pennsylvania Ave', city: 'Washington', state: 'DC', zipCode: '20001', propertyType: 'TOWNHOUSE' as const, estimatedValue: 780000, urgency: 'SIX_MONTHS' as const, status: 'QUALIFIED' as const, score: 72, temperature: 'WARM' as const, source: 'referral' },
    { firstName: 'Amanda', lastName: 'Davis', email: 'adavis@email.com', phone: '+1-571-555-0204', address: '321 Pine Road', city: 'McLean', state: 'VA', zipCode: '22101', propertyType: 'SINGLE_FAMILY' as const, estimatedValue: 1200000, urgency: 'IMMEDIATE' as const, status: 'PROPOSAL' as const, score: 92, temperature: 'HOT' as const, source: 'landing_page' },
    { firstName: 'Thomas', lastName: 'Wilson', email: 'twilson@email.com', phone: '+1-301-555-0205', address: '654 Cedar Lane', city: 'Rockville', state: 'MD', zipCode: '20850', propertyType: 'MULTI_FAMILY' as const, estimatedValue: 890000, urgency: 'THREE_MONTHS' as const, status: 'NEW' as const, score: 55, temperature: 'WARM' as const, source: 'organic_seo' },
    { firstName: 'Lisa', lastName: 'Anderson', email: 'landerson@email.com', phone: '+1-703-555-0206', address: '987 Elm Street', city: 'Alexandria', state: 'VA', zipCode: '22301', propertyType: 'SINGLE_FAMILY' as const, estimatedValue: 545000, urgency: 'EXPLORING' as const, status: 'CLOSED_WON' as const, score: 78, temperature: 'HOT' as const, source: 'direct' },
    { firstName: 'Kevin', lastName: 'Taylor', email: 'ktaylor@email.com', phone: '+1-202-555-0207', address: '159 K Street NW', city: 'Washington', state: 'DC', zipCode: '20006', propertyType: 'CONDO' as const, estimatedValue: 320000, urgency: 'SIX_MONTHS' as const, status: 'CONTACTED' as const, score: 40, temperature: 'COLD' as const, source: 'facebook_ads' },
    { firstName: 'Patricia', lastName: 'Jackson', email: 'pjackson@email.com', phone: '+1-571-555-0208', address: '753 Birch Court', city: 'Reston', state: 'VA', zipCode: '20190', propertyType: 'TOWNHOUSE' as const, estimatedValue: 680000, urgency: 'IMMEDIATE' as const, status: 'NEGOTIATION' as const, score: 88, temperature: 'HOT' as const, source: 'landing_page' },
  ];

  for (const leadData of sampleLeads) {
    const lead = await prisma.lead.create({
      data: { ...leadData, createdById: admin.id },
    });

    // Randomly assign to agents
    const assignTo = Math.random() > 0.5 ? agent1 : agent2;
    await prisma.leadAssignment.create({
      data: { leadId: lead.id, userId: assignTo.id },
    });

    // Add sample activity
    await prisma.crmActivity.create({
      data: {
        leadId: lead.id,
        userId: admin.id,
        type: 'NOTE',
        body: `Initial lead capture. Score: ${leadData.score}. Source: ${leadData.source}`,
      },
    });
  }

  console.log('✅ Sample leads created');

  console.log(`
  ╔═══════════════════════════════════════════════╗
  ║   Seed completed successfully!                ║
  ║                                               ║
  ║   Login credentials:                          ║
  ║   admin@leadsphere.com    / Admin123!          ║
  ║   manager@leadsphere.com  / Manager123!        ║
  ║   agent1@leadsphere.com   / Agent123!          ║
  ╚═══════════════════════════════════════════════╝
  `);
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
