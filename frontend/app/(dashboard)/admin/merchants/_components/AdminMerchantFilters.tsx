"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Combobox } from "@/components/ui/Combobox";
import { MerchantSearchCombobox } from "./MerchantSearchCombobox";
import type { AdminDirectoryArea } from "@/services/api/admin.service";

type AdminMerchantFiltersProps = {
  areas: AdminDirectoryArea[];
};

export function AdminMerchantFilters({ areas }: AdminMerchantFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasActiveFilters = ["search", "tenantId", "areaId", "status", "category"].some(
    (key) => searchParams.has(key),
  );

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleResetFilters = () => {
    router.push(pathname);
  };

  const areaOptions = [
    { label: "الكل", value: "all" },
    ...areas.map((a) => ({ label: a.name_ar, value: String(a.id) })),
  ];

  const statusOptions = [
    { label: "الكل", value: "all" },
    { label: "نشط", value: "active" },
    { label: "غير نشط", value: "inactive" },
    { label: "موقوف", value: "suspended" },
  ];

  const categoryOptions = [
    { label: "الكل", value: "all" },
    { label: "بقالة", value: "grocery" },
    { label: "خضار وفاكهة", value: "greengrocer" },
    { label: "جزارة", value: "butcher" },
    { label: "مخبز", value: "bakery" },
    { label: "صيدلية", value: "pharmacy" },
    { label: "أخرى", value: "other" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm md:grid-cols-5 md:items-end">
      <div className="md:col-span-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">بحث المتجر</label>
        <MerchantSearchCombobox />
      </div>
      
      <div className="md:col-span-1">
        <Combobox
          label="المنطقة"
          options={areaOptions}
          value={searchParams.get("areaId") || "all"}
          onValueChange={(val) => handleFilterChange("areaId", val)}
          inputClassName="py-2 px-3"
          disableFiltering={true}
        />
      </div>

      <div className="md:col-span-1">
        <Combobox
          label="حالة المتجر"
          options={statusOptions}
          value={searchParams.get("status") || "all"}
          onValueChange={(val) => handleFilterChange("status", val)}
          inputClassName="py-2 px-3"
          disableFiltering={true}
        />
      </div>

      <div className="md:col-span-1">
        <Combobox
          label="نوع المتجر"
          options={categoryOptions}
          value={searchParams.get("category") || "all"}
          onValueChange={(val) => handleFilterChange("category", val)}
          inputClassName="py-2 px-3"
          disableFiltering={true}
        />
      </div>

      <button
        type="button"
        onClick={handleResetFilters}
        disabled={!hasActiveFilters}
        className="h-10 rounded-md border border-brand-border px-4 text-sm font-semibold text-brand-text transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
      >
        إعادة ضبط
      </button>
    </div>
  );
}
