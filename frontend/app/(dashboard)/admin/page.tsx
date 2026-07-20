import { adminService } from '@/services/api/admin.service';
import { Card } from '@/components/ui/Card';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import { formatArabicInteger } from '@/lib/utils/number';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function formatCounter(value: number | null | undefined) {
  return formatArabicInteger(value) ?? '٠';
}

async function getStats() {
  try {
    const response = await adminService.getDashboardStats();
    if (response.success && response.data) {
      return response.data;
    }
    if (!response.success && response.message === 'Unauthorized') {
      redirect('/admin/login');
    }
    return null;
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('Failed to fetch admin stats:', error);
    return null;
  }
}

export default async function AdminDashboard() {
  const profile = await adminService.getCurrentAdmin();
  if (profile.data?.role === 'operations_admin') {
    redirect('/admin/merchants');
  }
  const stats = await getStats();

  if (!stats) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        تعذر تحميل الإحصائيات أو ليس لديك صلاحية الوصول.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">نظرة عامة</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
        <Card className="p-6 border-t-4 border-t-red-500">
          <h3 className="text-sm font-medium text-gray-500">إجمالي التجار</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCounter(stats.totalMerchants)}
          </p>
        </Card>
        
        <Card className="p-6 border-t-4 border-t-green-500">
          <h3 className="text-sm font-medium text-gray-500">التجار النشطين</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCounter(stats.activeMerchants)}
          </p>
        </Card>

        <Card className="p-6 border-t-4 border-t-amber-500">
          <h3 className="text-sm font-medium text-gray-500">طلبات انضمام تجار قيد المراجعة</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCounter(stats.pendingApplications)}
          </p>
        </Card>
        
        <Card className="p-6 border-t-4 border-t-blue-500">
          <h3 className="text-sm font-medium text-gray-500">إجمالي الطلبات</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCounter(stats.totalOrders)}
          </p>
        </Card>

        <Card className="p-6 border-t-4 border-t-cyan-500">
          <h3 className="text-sm font-medium text-gray-500">طلبات مكتملة</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCounter(stats.completedOrders)}
          </p>
        </Card>

        <Card className="p-6 border-t-4 border-t-purple-500">
          <h3 className="text-sm font-medium text-gray-500">الباقات المتاحة</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatCounter(stats.totalPlans)}
          </p>
        </Card>
      </div>
    </div>
  );
}
