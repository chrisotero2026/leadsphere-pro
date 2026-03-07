import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { LeadStatus, LeadTemperature, PropertyType, Urgency, ActivityType } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  NEW:          { label: 'New',         color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  CONTACTED:    { label: 'Contacted',   color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  QUALIFIED:    { label: 'Qualified',   color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  PROPOSAL:     { label: 'Proposal',    color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  NEGOTIATION:  { label: 'Negotiation', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  CLOSED_WON:   { label: 'Won ✓',       color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  CLOSED_LOST:  { label: 'Lost',        color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
};

export const TEMPERATURE_CONFIG: Record<LeadTemperature, { label: string; color: string; icon: string }> = {
  HOT:  { label: 'Hot',  color: 'text-red-500',    icon: '🔥' },
  WARM: { label: 'Warm', color: 'text-orange-500', icon: '☀️' },
  COLD: { label: 'Cold', color: 'text-blue-500',   icon: '❄️' },
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  SINGLE_FAMILY: 'Single Family',
  MULTI_FAMILY:  'Multi Family',
  CONDO:         'Condo',
  TOWNHOUSE:     'Townhouse',
  LAND:          'Land',
  COMMERCIAL:    'Commercial',
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  IMMEDIATE:    'Immediate',
  THREE_MONTHS: '1–3 Months',
  SIX_MONTHS:   '3–6 Months',
  EXPLORING:    'Just Exploring',
};

export const ACTIVITY_CONFIG: Record<ActivityType, { label: string; icon: string; color: string }> = {
  NOTE:          { label: 'Note',          icon: '📝', color: 'text-gray-600' },
  CALL:          { label: 'Call',          icon: '📞', color: 'text-blue-600' },
  EMAIL:         { label: 'Email',         icon: '✉️', color: 'text-purple-600' },
  MEETING:       { label: 'Meeting',       icon: '🤝', color: 'text-green-600' },
  SMS:           { label: 'SMS',           icon: '💬', color: 'text-indigo-600' },
  STATUS_CHANGE: { label: 'Status Change', icon: '🔄', color: 'text-orange-600' },
};

export const PIPELINE_STAGES: LeadStatus[] = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'
];

export const formatCurrency = (value?: number | null): string => {
  if (!value) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

export const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));
};

export const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

export const getScoreColor = (score: number): string => {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-500';
};

export const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
};