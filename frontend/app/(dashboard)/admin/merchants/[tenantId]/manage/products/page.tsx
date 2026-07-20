import { redirect } from "next/navigation";
import {
  getManagedSessionRevokePath,
  getManagedStoreFallbackPath,
  hasManagedSectionAccess,
  isManagedPermissionFailure,
  isManagedSessionFailure,
} from "@/lib/admin-managed-access";
import { adminService } from "@/services/api/admin.service";
import ProductsClientView from "./ProductsClientView";

export const dynamic = "force-dynamic";

export default async function ManagedProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tenantId: tenantIdValue } = await params;
  const tenantId = Number(tenantIdValue);
  const resolvedSearchParams = await searchParams;

  const status = typeof resolvedSearchParams.status === "string" ? resolvedSearchParams.status : "active";
  const productsPage = Number(resolvedSearchParams.products_page) || 1;
  const productsSearch = typeof resolvedSearchParams.products_search === "string" ? resolvedSearchParams.products_search : undefined;
  const productsCategory = typeof resolvedSearchParams.products_category === "string" ? resolvedSearchParams.products_category : undefined;

  const catalogPage = Number(resolvedSearchParams.catalog_page) || 1;
  const catalogCategory = typeof resolvedSearchParams.catalog_category === "string" ? resolvedSearchParams.catalog_category : undefined;

  const sessionResponse = await adminService.getCurrentManagementSession();
  if (!sessionResponse.success) {
    if (isManagedSessionFailure(sessionResponse)) {
      redirect(getManagedSessionRevokePath(tenantId));
    }
    throw new Error(
      sessionResponse.message || "تعذر التحقق من جلسة إدارة المتجر",
    );
  }
  const session = sessionResponse.data;
  if (!session || session.tenant_id !== tenantId) {
    redirect(getManagedSessionRevokePath(tenantId));
  }
  if (!hasManagedSectionAccess(session.permissions, "products")) {
    redirect(getManagedStoreFallbackPath(session));
  }

  const [
    productsResponse,
    catalogResponse,
    categoriesResponse,
  ] = await Promise.all([
    adminService.getManagedProducts(tenantId, {
      status,
      page: productsPage,
      limit: 20,
      search: productsSearch,
      category: productsCategory,
    }),
    adminService.getManagedCatalog(tenantId, {
      page: catalogPage,
      limit: 20,
      category: catalogCategory,
    }),
    adminService.getManagedProductCategories(tenantId),
  ]);

  const failedResponse = [
    productsResponse,
    catalogResponse,
    categoriesResponse,
  ].find((response) => !response.success);
  if (failedResponse) {
    if (isManagedSessionFailure(failedResponse)) {
      redirect(getManagedSessionRevokePath(tenantId));
    }
    if (isManagedPermissionFailure(failedResponse)) {
      redirect(`/admin/merchants/${tenantId}/manage`);
    }
    throw new Error(failedResponse.message || "تعذر تحميل منتجات المتجر");
  }

  const permissions = new Set(session.permissions);

  const productsData = Array.isArray(productsResponse.data) ? productsResponse.data : productsResponse.data?.data || [];
  const productsMeta = !Array.isArray(productsResponse.data) ? productsResponse.data?.meta : null;

  const catalogData = catalogResponse.data?.data || [];
  const catalogMeta = catalogResponse.data?.meta || null;

  const productCategories = categoriesResponse.data || [];

  return (
    <ProductsClientView
      tenantId={tenantId}
      permissions={permissions}
      productsData={productsData}
      productsMeta={productsMeta}
      catalogData={catalogData}
      catalogMeta={catalogMeta}
      productCategories={productCategories}
    />
  );
}
