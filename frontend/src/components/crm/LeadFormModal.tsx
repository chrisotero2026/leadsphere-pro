'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { leadsApi, usersApi } from '@/lib/api';
import { Lead } from '@/types';
import { X, Loader2 } from 'lucide-react';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  propertyType: z.enum(['SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'LAND', 'COMMERCIAL']).optional(),
  estimatedValue: z.coerce.number().positive().optional().or(z.literal('')),
  urgency: z.enum(['IMMEDIATE', 'THREE_MONTHS', 'SIX_MONTHS', 'EXPLORING']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  assignToUserId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function LeadFormModal({ lead, onClose, onSuccess }: {
  lead: Lead | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!lead;

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.getAll({ limit: 100 }).then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '', lastName: '', email: '', status: 'NEW',
    },
  });

  useEffect(() => {
    if (lead) {
      reset({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone || '',
        address: lead.address || '',
        city: lead.city || '',
        state: lead.state || '',
        zipCode: lead.zipCode || '',
        propertyType: lead.propertyType || undefined,
        estimatedValue: lead.estimatedValue || '',
        urgency: lead.urgency || undefined,
        status: lead.status,
        temperature: lead.temperature || undefined,
        source: lead.source || '',
        notes: lead.notes || '',
        assignToUserId: lead.assignments?.[0]?.user?.id || '',
      });
    } else {
      reset({ firstName: '', lastName: '', email: '', status: 'NEW' });
    }
  }, [lead, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = { ...data, estimatedValue: data.estimatedValue || undefined };
      return isEdit ? leadsApi.update(lead!.id, payload) : leadsApi.create(payload);
    },
    onSuccess,
  });

  const onSubmit = (data: FormData) => mutation.mutateAsync(data);

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? `Edit Lead: ${lead?.firstName} ${lead?.lastName}` : 'Add New Lead'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Contact Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name *" error={errors.firstName?.message}>
                  <input className="input" placeholder="John" {...register('firstName')} />
                </Field>
                <Field label="Last Name *" error={errors.lastName?.message}>
                  <input className="input" placeholder="Smith" {...register('lastName')} />
                </Field>
                <Field label="Email *" error={errors.email?.message}>
                  <input className="input" type="email" placeholder="john@email.com" {...register('email')} />
                </Field>
                <Field label="Phone" error={errors.phone?.message}>
                  <input className="input" placeholder="+1-703-555-0100" {...register('phone')} />
                </Field>
              </div>
            </div>

            {/* Property Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Property Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Address" error={errors.address?.message}>
                  <input className="input" placeholder="123 Main St" {...register('address')} />
                </Field>
                <Field label="City" error={errors.city?.message}>
                  <input className="input" placeholder="Arlington" {...register('city')} />
                </Field>
                <Field label="State" error={errors.state?.message}>
                  <select className="input" {...register('state')}>
                    <option value="">Select state</option>
                    <option value="VA">Virginia (VA)</option>
                    <option value="MD">Maryland (MD)</option>
                    <option value="DC">Washington DC</option>
                  </select>
                </Field>
                <Field label="ZIP Code" error={errors.zipCode?.message}>
                  <input className="input" placeholder="22201" {...register('zipCode')} />
                </Field>
                <Field label="Property Type" error={errors.propertyType?.message}>
                  <select className="input" {...register('propertyType')}>
                    <option value="">Select type</option>
                    <option value="SINGLE_FAMILY">Single Family</option>
                    <option value="MULTI_FAMILY">Multi Family</option>
                    <option value="CONDO">Condo</option>
                    <option value="TOWNHOUSE">Townhouse</option>
                    <option value="LAND">Land</option>
                    <option value="COMMERCIAL">Commercial</option>
                  </select>
                </Field>
                <Field label="Estimated Value ($)" error={errors.estimatedValue?.message}>
                  <input className="input" type="number" placeholder="550000" {...register('estimatedValue')} />
                </Field>
              </div>
            </div>

            {/* Lead Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Lead Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Urgency" error={errors.urgency?.message}>
                  <select className="input" {...register('urgency')}>
                    <option value="">Select urgency</option>
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="THREE_MONTHS">1–3 Months</option>
                    <option value="SIX_MONTHS">3–6 Months</option>
                    <option value="EXPLORING">Just Exploring</option>
                  </select>
                </Field>
                <Field label="Status *" error={errors.status?.message}>
                  <select className="input" {...register('status')}>
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="PROPOSAL">Proposal</option>
                    <option value="NEGOTIATION">Negotiation</option>
                    <option value="CLOSED_WON">Closed Won</option>
                    <option value="CLOSED_LOST">Closed Lost</option>
                  </select>
                </Field>
                <Field label="Temperature" error={errors.temperature?.message}>
                  <select className="input" {...register('temperature')}>
                    <option value="">Auto-calculate</option>
                    <option value="HOT">🔥 Hot</option>
                    <option value="WARM">☀️ Warm</option>
                    <option value="COLD">❄️ Cold</option>
                  </select>
                </Field>
                <Field label="Source" error={errors.source?.message}>
                  <select className="input" {...register('source')}>
                    <option value="manual">Manual</option>
                    <option value="landing_page">Landing Page</option>
                    <option value="google_ads">Google Ads</option>
                    <option value="facebook_ads">Facebook Ads</option>
                    <option value="organic_seo">Organic SEO</option>
                    <option value="referral">Referral</option>
                    <option value="direct">Direct</option>
                  </select>
                </Field>
                <Field label="Assign To" error={errors.assignToUserId?.message}>
                  <select className="input" {...register('assignToUserId')}>
                    <option value="">Unassigned</option>
                    {usersData?.data?.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role.name})</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Notes" error={errors.notes?.message}>
                  <textarea className="input resize-none" rows={3} placeholder="Additional notes about this lead..." {...register('notes')} />
                </Field>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary min-w-[100px]">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Create Lead'}
            </button>
          </div>
        </form>

        {mutation.isError && (
          <div className="mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {(mutation.error as any)?.response?.data?.message || 'An error occurred. Please try again.'}
          </div>
        )}
      </div>
    </div>
  );
}
