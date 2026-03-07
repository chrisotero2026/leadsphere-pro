'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/lib/api';
import { getInitials } from '@/lib/utils';
import { Loader2, CheckCircle } from 'lucide-react';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function SettingsPage() {
  const { user } = useAuth();
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => { setPasswordSuccess(true); reset(); setTimeout(() => setPasswordSuccess(false), 4000); },
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-2xl font-bold text-brand-700">
            {getInitials(user.firstName, user.lastName)}
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">{user.firstName} {user.lastName}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-100 capitalize">
              {user.role.name}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          To update your profile information, contact an administrator.
        </p>
      </div>

      {/* Change password */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>

        {passwordSuccess && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            <CheckCircle className="w-4 h-4" /> Password changed successfully!
          </div>
        )}

        <form onSubmit={handleSubmit((d: any) => passwordMutation.mutateAsync(d))} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input max-w-sm" {...register('currentPassword')} />
            {errors.currentPassword && <p className="mt-1 text-xs text-red-500">{errors.currentPassword.message as string}</p>}
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input max-w-sm" {...register('newPassword')} />
            {errors.newPassword && <p className="mt-1 text-xs text-red-500">{errors.newPassword.message as string}</p>}
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input max-w-sm" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword.message as string}</p>}
          </div>

          {passwordMutation.isError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {(passwordMutation.error as any)?.response?.data?.message || 'Failed to change password.'}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Change Password'}
          </button>
        </form>
      </div>

      {/* System info */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3">System</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span className="text-gray-500">Platform</span>
            <span className="font-medium">LeadSphere Pro v1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Market</span>
            <span className="font-medium">Virginia · Maryland · Washington DC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">API</span>
            <span className="font-medium font-mono text-xs bg-gray-50 px-2 py-0.5 rounded border">
              {process.env.NEXT_PUBLIC_API_URL}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
