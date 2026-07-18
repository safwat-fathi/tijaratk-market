"use client";

import { useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import type {
  AdminDirectoryAreasQuery,
  AdminDirectoryAreasResponse,
} from "@/services/api/admin.service";

type AreasFiltersProps = {
  facets: AdminDirectoryAreasResponse["facets"];
  query: AdminDirectoryAreasQuery;
  hasActiveFilters: boolean;
};

export const AreasFilters = ({
  facets,
  query,
  hasActiveFilters,
}: AreasFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(query.search ?? "");

  const cityOptions = useMemo(() => {
    const names = facets.cities
      .filter(
        (entry) =>
          !query.governorate || entry.governorate === query.governorate,
      )
      .map((entry) => entry.name);
    return Array.from(new Set(names));
  }, [facets.cities, query.governorate]);

  const navigate = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const updateFilter = (key: string, value: string) => {
    navigate((params) => {
      if (value) params.set(key, value);
      else params.delete(key);

      if (key === "governorate") {
        const selectedCity = params.get("city");
        const cityRemainsValid = facets.cities.some(
          (entry) =>
            entry.name === selectedCity &&
            (!value || entry.governorate === value),
        );
        if (selectedCity && !cityRemainsValid) params.delete("city");
      }
    });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateFilter("search", search.trim());
  };

  const reset = () => {
    setSearch("");
    router.push(pathname);
  };
  const canReset =
    hasActiveFilters || query.page !== 1 || query.limit !== 20;

  return (
    <div className="rounded-xl border border-brand-border bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-bold text-brand-text">مجموعة العمليات</h2>
        <p className="mt-1 text-sm text-gray-500">
          صفِّ المناطق حسب الهيكل والموقع والحالة أو البيانات التي تحتاج مراجعة.
        </p>
      </div>
      <form
        onSubmit={submitSearch}
        className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <Field label="البحث" htmlFor="area-search" className="md:col-span-2">
          <div className="flex gap-2">
            <Input
              id="area-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={120}
              placeholder="الاسم العربي أو الإنجليزي أو الرابط أو الموقع"
            />
            <Button type="submit" className="shrink-0">
              بحث
            </Button>
          </div>
        </Field>

        <Field label="نوع المنطقة" htmlFor="area-kind-filter">
          <Select
            id="area-kind-filter"
            value={query.kind ?? ""}
            onChange={(event) => updateFilter("kind", event.target.value)}
          >
            <option value="">الكل</option>
            <option value="main">مناطق رئيسية</option>
            <option value="sub">مناطق فرعية</option>
          </Select>
        </Field>

        <Field label="نطاق المنطقة الرئيسية" htmlFor="area-parent-filter">
          <Select
            id="area-parent-filter"
            value={query.parentId ? String(query.parentId) : ""}
            onChange={(event) => updateFilter("parentId", event.target.value)}
          >
            <option value="">كل المناطق</option>
            {facets.main_areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name_ar}
                {area.is_active ? "" : " — معطلة"}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="الحالة" htmlFor="area-status-filter">
          <Select
            id="area-status-filter"
            value={query.status ?? ""}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">الكل</option>
            <option value="active">مفعلة</option>
            <option value="inactive">معطلة</option>
          </Select>
        </Field>

        <Field label="المحافظة" htmlFor="area-governorate-filter">
          <Select
            id="area-governorate-filter"
            value={query.governorate ?? ""}
            onChange={(event) =>
              updateFilter("governorate", event.target.value)
            }
          >
            <option value="">كل المحافظات</option>
            {facets.governorates.map((governorate) => (
              <option key={governorate} value={governorate}>
                {governorate}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="المدينة" htmlFor="area-city-filter">
          <Select
            id="area-city-filter"
            value={query.city ?? ""}
            onChange={(event) => updateFilter("city", event.target.value)}
          >
            <option value="">كل المدن</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="يحتاج مراجعة" htmlFor="area-attention-filter">
          <Select
            id="area-attention-filter"
            value={query.attention ?? ""}
            onChange={(event) => updateFilter("attention", event.target.value)}
          >
            <option value="">بدون تصفية</option>
            <option value="any">أي مشكلة</option>
            <option value="main_without_active_children">
              رئيسية بلا مناطق فرعية نشطة
            </option>
            <option value="missing_english">الاسم الإنجليزي مفقود</option>
            <option value="missing_location">بيانات الموقع ناقصة</option>
            <option value="orphaned_child">المنطقة الرئيسية غير متاحة</option>
          </Select>
        </Field>

        <Field label="عدد الصفوف" htmlFor="area-limit-filter">
          <Select
            id="area-limit-filter"
            value={String(query.limit)}
            onChange={(event) => updateFilter("limit", event.target.value)}
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </Select>
        </Field>

        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            disabled={!canReset}
            className="w-full"
          >
            إعادة ضبط
          </Button>
        </div>
      </form>
    </div>
  );
};
