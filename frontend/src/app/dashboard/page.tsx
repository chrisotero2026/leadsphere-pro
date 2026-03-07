'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { BarChart3, Users, TrendingUp, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalLeads: 0,
    hotLeads: 0,
    conversionRate: 0,
    revenue: 0,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    // Mock stats
    setStats({
      totalLeads: 247,
      hotLeads: 12,
      conversionRate: 18.5,
      revenue: 24500,
    });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome back, {user?.firstName}!</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Leads */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Leads</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalLeads}</p>
              </div>
              <Users className="w-12 h-12 text-blue-100 bg-blue-50 rounded-lg p-3" />
            </div>
          </div>

          {/* Hot Leads */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Hot Leads</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.hotLeads}</p>
              </div>
              <AlertCircle className="w-12 h-12 text-red-100 bg-red-50 rounded-lg p-3" />
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Conversion Rate</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.conversionRate}%</p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-100 bg-green-50 rounded-lg p-3" />
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Revenue</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">${stats.revenue.toLocaleString()}</p>
              </div>
              <BarChart3 className="w-12 h-12 text-purple-100 bg-purple-50 rounded-lg p-3" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="/dashboard/leads" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              <p className="font-medium text-gray-900">Manage Leads</p>
              <p className="text-sm text-gray-600 mt-1">View and manage all leads</p>
            </a>
            <a href="/dashboard/territories" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              <p className="font-medium text-gray-900">Territories</p>
              <p className="text-sm text-gray-600 mt-1">Manage your territories</p>
            </a>
            <a href="/dashboard/ai" className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              <p className="font-medium text-gray-900">AI Intelligence</p>
              <p className="text-sm text-gray-600 mt-1">AI-powered insights</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
