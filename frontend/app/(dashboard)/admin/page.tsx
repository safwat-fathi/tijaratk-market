'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/dashboard-stats')
      .then((res) => {
        if (res.status === 401) {
          router.push('/admin/login');
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setStats(data.data || data);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">نظرة عامة</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 border-t-4 border-t-red-500">
          <h3 className="text-sm font-medium text-gray-500">إجمالي التجار</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalMerchants}</p>
        </Card>
        
        <Card className="p-6 border-t-4 border-t-green-500">
          <h3 className="text-sm font-medium text-gray-500">التجار النشطين</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.activeMerchants}</p>
        </Card>
        
        <Card className="p-6 border-t-4 border-t-blue-500">
          <h3 className="text-sm font-medium text-gray-500">إجمالي الطلبات</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
        </Card>

        <Card className="p-6 border-t-4 border-t-purple-500">
          <h3 className="text-sm font-medium text-gray-500">الباقات المتاحة</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.totalPlans}</p>
        </Card>
      </div>
    </div>
  );
}
