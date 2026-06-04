import { adminService } from '@/services/api/admin.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toggleTenantStatusAction } from '@/actions/admin-server';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function getTenants() {
  try {
    const response = await adminService.getTenants();
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : (response.data as any).data || [];
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

export default async function AdminMerchants() {
  const merchants = await getTenants();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">إدارة التجار</h1>

      <Card className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الاسم</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رقم الهاتف</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الطلبات</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">العملاء</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {merchants.map((merchant: any) => (
              <tr key={merchant.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {merchant.name}
                  <div className="text-xs text-gray-500">/{merchant.slug}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant._count?.orders || 0}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant._count?.customers || 0}</td>
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
      </Card>
    </div>
  );
}
