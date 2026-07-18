import { redirect } from "next/navigation";
import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import {
  adminService,
  type AdminDirectoryAreasQuery,
  type AdminDirectoryAreasResponse,
} from "@/services/api/admin.service";
import { AdminPagination } from "../_components/AdminPagination";
import AreasManager from "./_components/AreasManager";
import { AreasFilters } from "./_components/AreasFilters";

export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;
type AdminAreasPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

const EMPTY_RESPONSE: AdminDirectoryAreasResponse = {
  data: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
  facets: { main_areas: [], governorates: [], cities: [] },
};

const parsePositiveInteger = (
  value: SearchParamValue,
  fallback: number,
  maximum?: number,
) => {
  if (typeof value !== "string") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
};

const parseOptionalText = (value: SearchParamValue) => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 120);
  return normalized || undefined;
};

const parseAllowedValue = <T extends string>(
  value: SearchParamValue,
  allowed: readonly T[],
) =>
  typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : undefined;

const buildQuery = (
  searchParams: Record<string, SearchParamValue>,
): AdminDirectoryAreasQuery => ({
  page: parsePositiveInteger(searchParams.page, 1),
  limit: parseAllowedValue(searchParams.limit, ["20", "50", "100"] as const)
    ? Number(searchParams.limit)
    : 20,
  search: parseOptionalText(searchParams.search),
  kind: parseAllowedValue(searchParams.kind, ["main", "sub"] as const),
  parentId:
    typeof searchParams.parentId === "string"
      ? parsePositiveInteger(searchParams.parentId, 0) || undefined
      : undefined,
  status: parseAllowedValue(searchParams.status, [
    "active",
    "inactive",
  ] as const),
  governorate: parseOptionalText(searchParams.governorate),
  city: parseOptionalText(searchParams.city),
  attention: parseAllowedValue(searchParams.attention, [
    "any",
    "main_without_active_children",
    "missing_english",
    "missing_location",
    "orphaned_child",
  ] as const),
});

const toPaginationParams = (query: AdminDirectoryAreasQuery) => ({
  search: query.search,
  kind: query.kind,
  parentId: query.parentId ? String(query.parentId) : undefined,
  status: query.status,
  governorate: query.governorate,
  city: query.city,
  attention: query.attention,
});

const toUrlSearchParams = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params;
};

async function getAreas(query: AdminDirectoryAreasQuery) {
  try {
    const response = await adminService.getDirectoryAreasForManagement(query);
    if (response.success && response.data) return response.data;
    if (!response.success && response.message === "Unauthorized") {
      redirect("/admin/login");
    }
    return {
      ...EMPTY_RESPONSE,
      meta: {
        ...EMPTY_RESPONSE.meta,
        page: query.page,
        limit: query.limit,
      },
    };
  } catch (error) {
    if (isNextRedirectError(error)) throw error;
    console.error("Failed to fetch areas:", error);
    return {
      ...EMPTY_RESPONSE,
      meta: {
        ...EMPTY_RESPONSE.meta,
        page: query.page,
        limit: query.limit,
      },
    };
  }
}

export default async function AdminAreasPage({
  searchParams,
}: AdminAreasPageProps) {
  const query = buildQuery(await searchParams);
  const result = await getAreas(query);
  if (query.page > result.meta.totalPages) {
    const params = toUrlSearchParams(toPaginationParams(query));
    params.set("page", String(result.meta.totalPages));
    params.set("limit", String(query.limit));
    redirect(`/admin/areas?${params.toString()}`);
  }
  const hasActiveFilters = Boolean(
    query.search ||
      query.kind ||
      query.parentId ||
      query.status ||
      query.governorate ||
      query.city ||
      query.attention,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">إدارة المناطق</h1>
      <AreasFilters
        key={query.search ?? ""}
        facets={result.facets}
        query={query}
        hasActiveFilters={hasActiveFilters}
      />
      <AreasManager
        initialAreas={result.data}
        mainAreas={result.facets.main_areas}
        page={result.meta.page}
        hasActiveFilters={hasActiveFilters}
      />
      <AdminPagination
        basePath="/admin/areas"
        page={result.meta.page}
        totalPages={result.meta.totalPages}
        total={result.meta.total}
        limit={result.meta.limit}
        params={toPaginationParams(query)}
      />
    </div>
  );
}
