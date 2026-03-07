'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi, activitiesApi } from '@/lib/api';
import {
  STATUS_CONFIG, TEMPERATURE_CONFIG, PROPERTY_TYPE_LABELS,
  URGENCY_LABELS, ACTIVITY_CONFIG, formatCurrency, formatDate,
  formatRelativeTime, getInitials
} from '@/lib/utils';
import { Lead, ActivityType } from '@/types';
import { LeadFormModal } from '@/components/crm/LeadFormModal';
import {
  ArrowLeft, Edit2, Phone, Mail, MapPin, Home, DollarSign,
  Clock, User, Plus, Loader2, ChevronDown
} from 'lucide-react';

const ACTIVITY_TYPES: ActivityType[] = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'SMS'];

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>('NOTE');
  const [activityBody, setActivityBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getById(id).then((r) => r.data.data),
  });

  const logActivity = useMutation({
    mutationFn: () => activitiesApi.create({ leadId: id, type: activityType, body: activityBody }),
    onSuccess: () => {
      setActivityBody('');
      qc.invalidateQueries({ queryKey: ['lead', id] });
    },
  });

  const lead: Lead | undefined = data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
      </div>
    );
  }

  if (!lead) return <div className="text-gray-500">Lead not found.</div>;

  const statusCfg = STATUS_CONFIG[lead.status];
  const tempCfg = TEMPERATURE_CONFIG[lead.temperature];

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center font-bold text-brand-700">
            {getInitials(lead.firstName, lead.lastName)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lead.firstName} {lead.lastName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`badge ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
              <span className="text-sm">{tempCfg.icon} {tempCfg.label}</span>
              <span className="text-xs text-gray-400">Score: {lead.score}/100</span>
            </div>
          </div>
        </div>
        <button onClick={() => setShowEdit(true)} className="btn-secondary">
          <Edit2 className="w-4 h-4" /> Edit Lead
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Lead info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact card */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Contact Information</h2>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6">
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={lead.email} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={lead.phone} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Location"
                value={[lead.address, lead.city, lead.state, lead.zipCode].filter(Boolean).join(', ')} />
              <InfoRow icon={<Home className="w-4 h-4" />} label="Property"
                value={lead.propertyType ? PROPERTY_TYPE_LABELS[lead.propertyType] : undefined} />
              <InfoRow icon={<DollarSign className="w-4 h-4" />} label="Est. Value" value={formatCurrency(lead.estimatedValue)} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Urgency"
                value={lead.urgency ? URGENCY_LABELS[lead.urgency] : undefined} />
              <InfoRow icon={<User className="w-4 h-4" />} label="Source" value={lead.source} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Created" value={formatDate(lead.createdAt)} />
            </div>
            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
                <p className="text-sm text-gray-700">{lead.notes}</p>
              </div>
            )}
          </div>

          {/* Score bar */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Lead Score</h2>
              <span className={`text-2xl font-bold ${lead.score >= 70 ? 'text-green-600' : lead.score >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                {lead.score}<span className="text-sm text-gray-400 font-normal">/100</span>
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${lead.score >= 70 ? 'bg-green-500' : lead.score >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                style={{ width: `${lead.score}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Cold</span><span>Warm</span><span>Hot</span>
            </div>
          </div>

          {/* Log Activity */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Log Activity</h2>
            <div className="flex gap-2 mb-3 flex-wrap">
              {ACTIVITY_TYPES.map((type) => {
                const cfg = ACTIVITY_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => setActivityType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${
                      activityType === type
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                    }`}
                  >
                    <span>{cfg.icon}</span>{cfg.label}
                  </button>
                );
              })}
            </div>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder={`Add a ${ACTIVITY_CONFIG[activityType].label.toLowerCase()}...`}
              value={activityBody}
              onChange={(e) => setActivityBody(e.target.value)}
            />
            <button
              onClick={() => activityBody.trim() && logActivity.mutate()}
              disabled={!activityBody.trim() || logActivity.isPending}
              className="btn-primary mt-2"
            >
              {logActivity.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Log Activity</>}
            </button>
          </div>

          {/* Activity timeline */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Activity Timeline</h2>
            <div className="space-y-4">
              {lead.activities?.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No activities yet. Log the first one!</p>
              )}
              {lead.activities?.map((activity, i) => {
                const cfg = ACTIVITY_CONFIG[activity.type];
                return (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm flex-shrink-0">
                        {cfg.icon}
                      </div>
                      {i < (lead.activities?.length || 0) - 1 && (
                        <div className="w-px flex-1 bg-gray-100 my-1" />
                      )}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(activity.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{activity.body}</p>
                      {activity.user && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          by {activity.user.firstName} {activity.user.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Assigned agents */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Assigned To</h2>
            {lead.assignments && lead.assignments.length > 0 ? (
              <div className="space-y-2">
                {lead.assignments.map((a) => (
                  <div key={a.user.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-700">
                      {getInitials(a.user.firstName, a.user.lastName)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{a.user.firstName} {a.user.lastName}</div>
                      <div className="text-xs text-gray-400">{a.user.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Not assigned yet.</p>
            )}
          </div>

          {/* Created by */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Created By</h2>
            {lead.createdBy && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                  {getInitials(lead.createdBy.firstName, lead.createdBy.lastName)}
                </div>
                <span className="text-sm text-gray-700">{lead.createdBy.firstName} {lead.createdBy.lastName}</span>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">{formatDate(lead.createdAt)}</p>
          </div>

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Tags</h2>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <LeadFormModal
          lead={lead}
          onClose={() => setShowEdit(false)}
          onSuccess={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['lead', id] }); }}
        />
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <div className="text-xs text-gray-400">{label}</div>
        <div className="text-sm text-gray-800 font-medium">{value}</div>
      </div>
    </div>
  );
}
