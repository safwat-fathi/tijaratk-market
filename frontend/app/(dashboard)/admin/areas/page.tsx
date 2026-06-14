import { adminService } from '@/services/api/admin.service';
import { isNextRedirectError } from '@/lib/auth/navigation-errors';
import { redirect } from 'next/navigation';
import AreasManager from './_components/AreasManager';

export const dynamic = 'force-dynamic';

async function getAreas() {
  try {
    const response = await adminService.getDirectoryAreas();
    if (response.success && response.data) {
      return Array.isArray(response.data) ? response.data : (response.data as any).data || [];
    }
    if (!response.success && response.message === 'Unauthorized') {
      redirect('/admin/login');
    }
    return [];
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error('Failed to fetch areas:', error);
    return [];
  }
}

export default async function AdminAreasPage() {
  const areas = await getAreas();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">إدارة المناطق</h1>
      </div>
      <AreasManager initialAreas={areas} />
    </div>
  );
}
