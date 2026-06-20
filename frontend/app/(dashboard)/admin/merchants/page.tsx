import { adminService } from '@/services/api/admin.service';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toggleTenantStatusAction } from '@/actions/admin-server';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import { redirect } from 'next/navigation';
import { PlanSelect } from './_components/PlanSelect';
import { TenantAreaForm } from './_components/TenantAreaForm';
import { DirectoryStatusForm } from './_components/DirectoryStatusForm';
import { ExternalLink } from 'lucide-react';
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

function MerchantStatusBadge({ status }: { status: AdminTenant['status'] }) {
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      {status === 'active' ? 'نشط' : 'موقوف'}
    </span>
  );
}

function ToggleTenantStatusForm({ merchant }: { merchant: AdminTenant }) {
  return (
    <form action={toggleTenantStatusAction.bind(null, merchant.id, merchant.status)}>
      <Button
        type="submit"
        variant={merchant.status === 'active' ? 'outline' : 'primary'}
        size="sm"
        className="w-full md:w-auto"
      >
        {merchant.status === 'active' ? 'إيقاف' : 'تفعيل'}
      </Button>
    </form>
  );
}

export default async function AdminMerchants() {
  const [merchants, plans, areas]: [AdminTenant[], AdminPlan[], AdminDirectoryArea[]] =
    await Promise.all([getTenants(), getPlansList(), getDirectoryAreas()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">إدارة التجار</h1>

      <div className="space-y-4 md:hidden">
        {merchants.length === 0 ? (
          <Card className="p-6 text-center text-sm text-gray-500">
            لا يوجد تجار
          </Card>
        ) : (
          merchants.map((merchant) => (
            <Card key={merchant.id} className="space-y-5 p-4">
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-bold text-gray-900">
                      {merchant.name}
                    </h2>
                    <a
                      href={`/${merchant.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      /{merchant.slug}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <MerchantStatusBadge status={merchant.status} />
                </div>
                <p className="break-all text-sm text-gray-600">{merchant.phone}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-gray-50 px-2 py-3">
                  <div className="text-xs font-medium text-gray-500">المنتجات</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {merchant._count?.products || 0}
                  </div>
                </div>
                <div className="rounded-md bg-gray-50 px-2 py-3">
                  <div className="text-xs font-medium text-gray-500">الطلبات</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {merchant._count?.orders || 0}
                  </div>
                </div>
                <div className="rounded-md bg-gray-50 px-2 py-3">
                  <div className="text-xs font-medium text-gray-500">العملاء</div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {merchant._count?.customers || 0}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <TenantAreaForm tenant={merchant} areas={areas} />

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-600">حالة الدليل</div>
                  <DirectoryStatusForm tenant={merchant} />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-600">الباقة</div>
                  <PlanSelect
                    tenantId={merchant.id}
                    currentPlanId={merchant.tenant_subscriptions?.[0]?.plan_id}
                    plans={plans}
                  />
                </div>

                <ToggleTenantStatusForm merchant={merchant} />
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="hidden overflow-hidden md:block">
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
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">حالة الدليل</th>
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
                  <div className="mt-0.5">
                    <a
                      href={`/${merchant.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      /{merchant.slug}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant._count?.products || 0}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant._count?.orders || 0}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{merchant._count?.customers || 0}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <TenantAreaForm tenant={merchant} areas={areas} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <DirectoryStatusForm tenant={merchant} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <PlanSelect
                    tenantId={merchant.id}
                    currentPlanId={merchant.tenant_subscriptions?.[0]?.plan_id}
                    plans={plans}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <MerchantStatusBadge status={merchant.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <ToggleTenantStatusForm merchant={merchant} />
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
