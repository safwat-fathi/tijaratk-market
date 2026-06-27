"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  adminAddProductFromCatalogAction,
  adminCreateProductForTenantAction,
  adminLoadCatalogItemsAction,
  adminLoadProductOnboardingAction,
  adminRemoveProductAction,
  adminSearchTenantProductsAction,
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
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
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
      removeProduct: adminRemoveProductAction,
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

        {message ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </p>
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
