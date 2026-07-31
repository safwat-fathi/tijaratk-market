import { adminService } from '@/services/api/admin.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { togglePlanStatusAction } from '@/actions/admin-server';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import { redirect } from 'next/navigation';

export const metadata = { title: "الباقات" };

export const dynamic = 'force-dynamic';

async function getPlans() {
  try {
    const response = await adminService.getPlans();
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : (response.data as any).data || [];
    }
    if (!response.success && response.message === 'Unauthorized') {
      redirect('/admin/login');
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('Failed to fetch plans:', error);
    return [];
  }
}

export default async function AdminPlans() {
  const plans = await getPlans();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">إدارة الباقات</h1>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الباقة</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">السعر</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الحالة</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {plans.map((plan: any) => (
              <tr key={plan.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{plan.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{plan.price} ج.م</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${plan.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {plan.is_active ? 'مفعلة' : 'معطلة'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <form action={togglePlanStatusAction.bind(null, plan.id, plan.is_active)}>
                    <Button 
                      type="submit"
                      variant={plan.is_active ? 'outline' : 'primary'}
                      size="sm"
                    >
                      {plan.is_active ? 'إيقاف' : 'تفعيل'}
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
