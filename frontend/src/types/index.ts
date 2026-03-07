export type Role = {
  id: string;
  name: 'admin' | 'manager' | 'agent' | 'viewer';
  description?: string;
  permissions: Record<string, boolean>;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  roleId: string;
  role: Role;
  lastLoginAt?: string;
  createdAt: string;
  _count?: { assignedLeads: number; createdLeads: number; activities: number };
};

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';
export type LeadTemperature = 'HOT' | 'WARM' | 'COLD';
export type PropertyType = 'SINGLE_FAMILY' | 'MULTI_FAMILY' | 'CONDO' | 'TOWNHOUSE' | 'LAND' | 'COMMERCIAL';
export type Urgency = 'IMMEDIATE' | 'THREE_MONTHS' | 'SIX_MONTHS' | 'EXPLORING';
export type ActivityType = 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING' | 'SMS' | 'STATUS_CHANGE';

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  propertyType?: PropertyType;
  estimatedValue?: number;
  urgency?: Urgency;
  score: number;
  temperature: LeadTemperature;
  status: LeadStatus;
  source?: string;
  notes?: string;
  createdById: string;
  createdBy?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;
  assignments?: Array<{ user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'avatar'> }>;
  activities?: CrmActivity[];
  tags?: Array<{ tag: { id: string; name: string; color: string } }>;
  createdAt: string;
  updatedAt: string;
  _count?: { activities: number };
};

export type CrmActivity = {
  id: string;
  leadId: string;
  lead?: Pick<Lead, 'id' | 'firstName' | 'lastName'>;
  userId: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatar'>;
  type: ActivityType;
  subject?: string;
  body: string;
  outcome?: string;
  scheduledAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type DashboardStats = {
  overview: {
    totalLeads: number;
    newLeadsThisMonth: number;
    monthlyGrowth: number;
    avgScore: number;
    conversionRate: number;
  };
  pipeline: Array<{ status: LeadStatus; count: number }>;
  temperature: Array<{ temperature: LeadTemperature; count: number }>;
  topAgents: Array<{ id: string; name: string; role: string; assignedLeads: number; activities: number }>;
  recentActivity: CrmActivity[];
};

export type PaginatedResponse<T> = {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
};