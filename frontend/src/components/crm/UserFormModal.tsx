'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import { X, Loader2 } from 'lucide-react';

const createSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
  phone: z.string().optional(),
  roleId: z.string().uuid('Select a role'),
});

const editSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  roleId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export function UserFormModal({ user, onClose, onSuccess }: {
  user: User | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!user;
  const schema = isEdit ? editSchema : createSchema;

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => usersApi.getRoles().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema as any),
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        roleId: user.roleId,
        status: user.status,
      });
    } else {
      reset({});
    }
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? usersApi.update(user!.id, data) : usersApi.create(data),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? `Edit ${user?.firstName}` : 'Add Team Member'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutateAsync(d))} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input className="input" placeholder="John" {...register('firstName')} />
              {(errors as any).firstName && <p className="mt-1 text-xs text-red-500">{(errors as any).firstName.message}</p>}
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className="input" placeholder="Smith" {...register('lastName')} />
            </div>
          </div>

          {!isEdit && (
            <>
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" placeholder="john@company.com" {...register('email' as any)} />
                {(errors as any).email && <p className="mt-1 text-xs text-red-500">{(errors as any).email.message}</p>}
              </div>
              <div>
                <label className="label">Password *</label>
                <input className="input" type="password" placeholder="Min 8 characters" {...register('password' as any)} />
                {(errors as any).password && <p className="mt-1 text-xs text-red-500">{(errors as any).password.message}</p>}
              </div>
            </>
          )}

          <div>
            <label className="label">Phone</label>
            <input className="input" placeholder="+1-703-555-0100" {...register('phone')} />
          </div>

          <div>
            <label className="label">Role *</label>
            <select className="input" {...register('roleId')}>
              <option value="">Select role</option>
              {rolesData?.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name} — {r.description}</option>
              ))}
            </select>
            {(errors as any).roleId && <p className="mt-1 text-xs text-red-500">{(errors as any).roleId.message}</p>}
          </div>

          {isEdit && (
            <div>
              <label className="label">Status</label>
              <select className="input" {...register('status' as any)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          )}

          {mutation.isError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {(mutation.error as any)?.response?.data?.message || 'An error occurred.'}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
