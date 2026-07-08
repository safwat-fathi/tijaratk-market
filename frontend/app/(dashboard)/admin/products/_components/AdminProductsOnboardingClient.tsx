"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  adminAddProductFromCatalogAction,
  adminCreateProductForTenantAction,
  adminLoadCatalogItemsAction,
  adminLoadProductOnboardingAction,
  adminSearchTenantProductsAction,
  adminUploadProductCatalogSheetAction,
  adminUpdateProductAvailabilityAction,
  adminUpdateProductPayloadAction,
} from "@/actions/admin-server";
import { Card } from "@/components/ui/Card";
import ProductOnboardingClient, {
  type ProductOnboardingActions,
} from "@/app/(dashboard)/merchant/(features)/products/new/_components/ProductOnboardingClient";
import type { AdminTenant } from "@/services/api/admin.service";
import type {
  CatalogItemsResponse,
  Product,
  PublicProductCategory,
} from "@/types/models/product";

type AdminProductOnboardingData = {
  products: Product[];
  productCategories: string[];
  catalogItemsResponse: CatalogItemsResponse;
  catalogCategories: PublicProductCategory[];
};

type ProductSheetUploadResult = {
  total_rows: number;
  created_rows: number;
  updated_rows: number;
  skipped_rows: number;
  failed_rows: number;
  errors: Array<{
    row_number: number;
    message: string;
  }>;
};

type AdminProductsOnboardingClientProps = {
  merchants: AdminTenant[];
};

const normalizeSearchText = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export default function AdminProductsOnboardingClient({
  merchants,
}: AdminProductsOnboardingClientProps) {
  const [merchantSearch, setMerchantSearch] = useState("");
  const [selectedMerchantId, setSelectedMerchantId] = useState<number | null>(
    null,
  );
  const [onboardingData, setOnboardingData] =
    useState<AdminProductOnboardingData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sheetUploadResult, setSheetUploadResult] =
    useState<ProductSheetUploadResult | null>(null);
  const [sheetUploadMessage, setSheetUploadMessage] = useState<string | null>(
    null,
  );
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSheetUploadPending, startSheetUploadTransition] = useTransition();
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredMerchants = useMemo(() => {
    const normalizedSearch = normalizeSearchText(merchantSearch);
    if (!normalizedSearch) {
      return merchants.slice(0, 20);
    }

    return merchants
      .filter((merchant) =>
        normalizeSearchText(merchant.name).includes(normalizedSearch),
      )
      .slice(0, 20);
  }, [merchantSearch, merchants]);

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.id === selectedMerchantId),
    [merchants, selectedMerchantId],
  );

  const handleSelectMerchant = useCallback((merchant: AdminTenant) => {
    setSelectedMerchantId(merchant.id);
    setMerchantSearch(merchant.name);
    setOnboardingData(null);
    setMessage(null);
    setSheetUploadResult(null);
    setSheetUploadMessage(null);
    setIsSelectorOpen(false);

    startTransition(async () => {
      const response = await adminLoadProductOnboardingAction(merchant.id);
      if (!response.success || !response.data) {
        setMessage(response.message || "تعذر تحميل بيانات منتجات التاجر");
        return;
      }

      setOnboardingData(response.data);
    });
  }, []);

  const reloadSelectedMerchant = useCallback((merchantId: number) => {
    startTransition(async () => {
      const response = await adminLoadProductOnboardingAction(merchantId);
      if (!response.success || !response.data) {
        setMessage(response.message || "تعذر تحميل بيانات منتجات التاجر");
        return;
      }

      setOnboardingData(response.data);
    });
  }, []);

  const handleUploadProductSheet = useCallback(
    (formData: FormData) => {
      if (!selectedMerchantId) {
        setSheetUploadMessage("يجب اختيار تاجر أولًا");
        return;
      }

      setSheetUploadMessage(null);
      setSheetUploadResult(null);

      startSheetUploadTransition(async () => {
        try {
          formData.append('tenantId', selectedMerchantId.toString());
          const response = await fetch('/api/admin/products/import', {
            method: 'POST',
            body: formData,
          });
          const result = await response.json();
          if (!response.ok || !result.success) {
            setSheetUploadMessage(result.message || "تعذر رفع ملف المنتجات");
            return;
          }
          setSheetUploadResult(result.data);
          reloadSelectedMerchant(selectedMerchantId);
        } catch (error) {
          console.error("Error uploading CSV:", error);
          setSheetUploadMessage("حدث خطأ أثناء الاتصال بالخادم");
        }
      });
    },
    [selectedMerchantId, reloadSelectedMerchant],
  );

  // Use effect for auto-selection removed as per user request

  const actions = useMemo<ProductOnboardingActions | null>(() => {
    if (!selectedMerchantId) {
      return null;
    }

    return {
      createProduct: (...args) =>
        adminCreateProductForTenantAction(selectedMerchantId, ...args),
      addProductFromCatalog: (catalogItemId) =>
        adminAddProductFromCatalogAction(selectedMerchantId, catalogItemId),
      loadCatalogItems: (params) =>
        adminLoadCatalogItemsAction(selectedMerchantId, params),
      loadProducts: (status) =>
        adminLoadProductOnboardingAction(selectedMerchantId, status).then(
          (response) => ({
            success: response.success,
            data: response.data?.products,
            message: response.message,
          }),
        ),
      searchTenantProducts: (search, page, limit, categoryOrOptions) =>
        adminSearchTenantProductsAction(
          selectedMerchantId,
          search,
          page,
          limit,
          categoryOrOptions,
        ),
      updateProduct: adminUpdateProductPayloadAction,
      updateProductAvailability: adminUpdateProductAvailabilityAction,
      removeProduct: async () => ({
        success: false,
        message: "حذف المنتجات متاح من شاشة التجار فقط",
      }),
    };
  }, [selectedMerchantId]);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-30 rounded-lg border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-brand-text">
                إدارة منتجات تاجر
              </h2>
              {selectedMerchant ? (
                <>
                  <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-primary">
                    {selectedMerchant.name}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                    {selectedMerchant.category || "other"}
                  </span>
                  {typeof selectedMerchant._count?.products === "number" ? (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      {selectedMerchant._count.products} منتج
                    </span>
                  ) : null}
                </>
              ) : null}
              {isPending ? (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                  جاري التحميل
                </span>
              ) : null}
            </div>

            <div className="relative max-w-xl" ref={comboboxRef}>
              <label className="sr-only" htmlFor="admin-merchant-search">
                ابحث باسم المتجر
              </label>
              <div className="relative">
                <input
                  id="admin-merchant-search"
                  value={merchantSearch}
                  onFocus={() => setIsSelectorOpen(true)}
                  onChange={(event) => {
                    setMerchantSearch(event.target.value);
                    setIsSelectorOpen(true);
                  }}
                  placeholder="ابحث باسم المتجر أو اختر تاجرًا"
                  className="h-11 w-full rounded-md border border-brand-border bg-white px-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 pe-10"
                />
                {merchantSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setMerchantSearch("");
                      setSelectedMerchantId(null);
                      setOnboardingData(null);
                      setIsSelectorOpen(true);
                    }}
                    className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none"
                    aria-label="مسح البحث"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {isSelectorOpen ? (
                <div className="absolute inset-x-0 top-12 z-40 max-h-80 overflow-y-auto rounded-md border border-brand-border bg-white shadow-lg">
                  {filteredMerchants.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      لا توجد متاجر بهذا الاسم
                    </p>
                  ) : (
                    <div className="divide-y divide-brand-border">
                      {filteredMerchants.map((merchant) => {
                        const isSelected = merchant.id === selectedMerchantId;

                        return (
                          <button
                            key={merchant.id}
                            type="button"
                            onClick={() => handleSelectMerchant(merchant)}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-start text-sm transition ${
                              isSelected
                                ? "bg-brand-soft text-brand-primary"
                                : "bg-white text-brand-text hover:bg-brand-soft/50"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {merchant.name}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {merchant.category || "other"} · {merchant.phone}
                              </span>
                            </span>
                            {isSelected ? (
                              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-brand-primary">
                                محدد
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/admin/products?view=all-products"
              className="inline-flex h-10 items-center rounded-md border border-brand-border bg-white px-3 text-sm font-semibold text-brand-text hover:bg-brand-soft"
            >
              كل منتجات النظام
            </a>
          </div>
        </div>

        {selectedMerchant ? (
          <form
            action={handleUploadProductSheet}
            className="mt-3 grid gap-2 rounded-md border border-brand-border bg-gray-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <label className="space-y-1 block">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-brand-text">
                  رفع CSV لتحديث منتجات التاجر
                </span>
              </div>
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                className="block h-10 w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm file:me-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-xs file:font-semibold file:text-brand-primary"
                required
              />
            </label>
            <button
              type="submit"
              disabled={isSheetUploadPending}
              className="inline-flex h-10 items-center justify-center self-end rounded-md bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSheetUploadPending ? "جاري الرفع" : "رفع الملف"}
            </button>
          </form>
        ) : null}

        {message ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </p>
        ) : null}

        {sheetUploadMessage ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {sheetUploadMessage}
          </p>
        ) : null}

        {sheetUploadResult ? (
          <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <p className="font-semibold">
              تم معالجة {sheetUploadResult.total_rows} صف: تم إنشاء{" "}
              {sheetUploadResult.created_rows} وتحديث{" "}
              {sheetUploadResult.updated_rows} وتخطي{" "}
              {sheetUploadResult.skipped_rows} وفشل{" "}
              {sheetUploadResult.failed_rows}.
            </p>
            {sheetUploadResult.errors.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-red-700">
                {sheetUploadResult.errors.slice(0, 5).map((error) => (
                  <li key={`${error.row_number}-${error.message}`}>
                    صف {error.row_number}: {error.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedMerchant && onboardingData && actions ? (
        <ProductOnboardingClient
          key={selectedMerchant.id}
          initialProducts={onboardingData.products}
          initialCatalogItems={onboardingData.catalogItemsResponse.data}
          initialCatalogMeta={onboardingData.catalogItemsResponse.meta}
          catalogCategories={onboardingData.catalogCategories}
          productCategories={onboardingData.productCategories}
          storeType={selectedMerchant.category}
          actions={actions}
          enableCatalogHiding={false}
          enableBulkWizard={false}
          allowProductRemoval={false}
          layoutMode="admin"
        />
      ) : (
        <Card className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center border-dashed border-2">
          <div className="mb-4 rounded-full bg-brand-soft p-4 text-brand-primary">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 21v-7.5a2.25 2.25 0 0 1-2.25-2.25v-1.5a2.25 2.25 0 0 1 2.25-2.25H15M10.5 21v-7.5a2.25 2.25 0 0 0-2.25-2.25v-1.5A2.25 2.25 0 0 0 6 7.5H4.5m15 13.5v-7.5a2.25 2.25 0 0 0-2.25-2.25v-1.5A2.25 2.25 0 0 0 15 7.5h-1.5m-15 13.5V7.5a2.25 2.25 0 0 1 2.25-2.25h15A2.25 2.25 0 0 1 22.5 7.5v13.5"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-bold text-brand-text">لا يوجد تاجر محدد</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            يرجى البحث واختيار تاجر من القائمة أعلاه لعرض منتجاته وإدارتها أو الإضافة من الكتالوج.
          </p>
        </Card>
      )}
    </div>
  );
}
