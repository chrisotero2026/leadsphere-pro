'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { User } from '@/types';
import { getInitials, formatRelativeTime } from '@/lib/utils';
import { Plus, Search, Edit2, UserX, Shield, User as UserIcon, Eye } from 'lucide-react';
import { UserFormModal } from '@/components/crm/UserFormModal';
import { useAuth } from '@/hooks/useAuth';

const ROLE_CONFIG = {
  admin:   { color: 'bg-red-50 text-red-700 border-red-200',    icon: <Shield className="w-3 h-3" /> },
  manager: { color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <UserIcon className="w-3 h-3" /> },
  agent:   { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <UserIcon className="w-3 h-3" /> },
  viewer:  { color: 'bg-gray-50 text-gray-600 border-gray-200', icon: <Eye className="w-3 h-3" /> },
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersApi.getAll({ ...(search && { search }), limit: 50 }).then((r) => r.data),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const users: User[] = data?.data || [];
  const isAdmin = currentUser?.role.name === 'admin';

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} members</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingUser(null); setShowForm(true); }} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Member
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search team members..."
            className="input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Users grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="space-y-1.5">
                  <div className="h-4 bg-gray-200 rounded w-24" />
                  <div className="h-3 bg-gray-100 rounded w-32" />
                </div>
              </div>
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="col-span-3 card p-12 text-center text-gray-400">
            <UserIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <div>No team members found.</div>
          </div>
        ) : (
          users.map((u) => {
            const roleCfg = ROLE_CONFIG[u.role.name as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.viewer;
            const isInactive = u.status !== 'ACTIVE';

            return (
              <div key={u.id} className={`card p-5 transition-all hover:shadow-md ${isInactive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-brand-100 rounded-full flex items-center justify-center font-bold text-brand-700">
                      {getInitials(u.firstName, u.lastName)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {u.firstName} {u.lastName}
                        {u.id === currentUser?.id && <span className="ml-1.5 text-xs text-brand-500">(you)</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{u.email}</div>
                    </div>
                  </div>

                  {isAdmin && u.id !== currentUser?.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingUser(u); setShowForm(true); }}
                        className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!isInactive && (
                        <button
                          onClick={() => confirm(`Deactivate ${u.firstName}?`) && deactivateMutation.mutate(u.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Deactivate"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className={`badge flex items-center gap-1 ${roleCfg.color}`}>
                    {roleCfg.icon}
                    {u.role.name}
                  </span>
                  {isInactive && (
                    <span className="badge bg-red-50 text-red-600 border-red-200 text-xs">Inactive</span>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{u._count?.assignedLeads || 0}</div>
                    <div className="text-xs text-gray-400">Leads</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mt-1">Last login</div>
                    <div className="text-xs text-gray-600">{u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : 'Never'}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <UserFormModal
          user={editingUser}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['users'] }); }}
        />
      )}
    </div>
  );
}
