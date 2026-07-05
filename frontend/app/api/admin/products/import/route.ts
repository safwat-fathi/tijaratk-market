import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { STORAGE_KEYS } from "@/constants";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

import * as Sentry from '@sentry/nextjs';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(STORAGE_KEYS.ADMIN_ACCESS_TOKEN)?.value;
  if (!token) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const tenantId = formData.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ success: false, message: 'Tenant ID is required' }, { status: 400 });
    }

    // We can just forward the formData as is
    // Wait, the backend endpoint for Admin is /admin/tenants/:id/products/import
    const res = await fetch(`${BACKEND_URL}/admin/tenants/${tenantId}/products/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Proxy error uploading products:', error);
    Sentry.captureException(error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
