import { adminService } from '@/services/api/admin.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toggleTenantStatusAction } from '@/actions/admin-server';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import { redirect } from 'next/navigation';
import { PlanSelect } from './_components/PlanSelect';
import { TenantAreaForm } from './_components/TenantAreaForm';
import type { AdminDirectoryArea, AdminPlan, AdminTenant } from '@/services/api/admin.service';

export const dynamic = 'force-dynamic';

async function getTenants() {
  try {
    const response = await adminService.getTenants();
    if (response.success && response.data) {
      return response.data;
    }
    if (!response.success && response.message === 'Unauthorized') {
      redirect('/admin/login');
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('Failed to fetch tenants:', error);
    return [];
  }
}

async function getPlansList() {
  try {
    const response = await adminService.getPlans();
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('Failed to fetch plans:', error);
    return [];
  }
}

async function getDirectoryAreas() {
  try {
    const response = await adminService.getDirectoryAreas();
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('Failed to fetch directory areas:', error);
    return [];
  }
}

export default async function AdminMerchants() {
  const [merchants, plans, areas]: [AdminTenant[], AdminPlan[], AdminDirectoryArea[]] =
    await Promise.all([getTenants(), getPlansList(), getDirectoryAreas()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">إدارة التجار</h1>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رقم الهاتف</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المنتجات</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الطلبات</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العملاء</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المناطق</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الباقة</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {merchants.map((merchant) => (
              <tr key={merchant.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {merchant.name}
                  <div className="text-xs text-gray-500">/{merchant.slug}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant._count?.products || 0}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant._count?.orders || 0}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant._count?.customers || 0}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <TenantAreaForm tenant={merchant} areas={areas} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <PlanSelect
                    tenantId={merchant.id}
                    currentPlanId={merchant.tenant_subscriptions?.[0]?.plan_id}
                    plans={plans}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${merchant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {merchant.status === 'active' ? 'نشط' : 'موقوف'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <form action={toggleTenantStatusAction.bind(null, merchant.id, merchant.status)}>
                    <Button 
                      type="submit"
                      variant={merchant.status === 'active' ? 'outline' : 'primary'}
                      size="sm"
                    >
                      {merchant.status === 'active' ? 'إيقاف' : 'تفعيل'}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
