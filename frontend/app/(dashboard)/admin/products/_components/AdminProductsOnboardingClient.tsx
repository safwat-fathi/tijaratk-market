"use client";

import { useMemo, useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();

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

  const handleSelectMerchant = (merchant: AdminTenant) => {
    setSelectedMerchantId(merchant.id);
    setOnboardingData(null);
    setMessage(null);

    startTransition(async () => {
      const response = await adminLoadProductOnboardingAction(merchant.id);
      if (!response.success || !response.data) {
        setMessage(response.message || "تعذر تحميل بيانات منتجات التاجر");
        return;
      }

      setOnboardingData(response.data);
    });
  };

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
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-brand-text">
                اختيار التاجر
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ابحث باسم المتجر ثم اختر التاجر لإدارة منتجاته.
              </p>
            </div>
            <input
              value={merchantSearch}
              onChange={(event) => setMerchantSearch(event.target.value)}
              placeholder="ابحث باسم المتجر"
              className="h-11 w-full rounded-md border border-brand-border px-3 text-sm focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
            />
            <div className="max-h-80 overflow-y-auto rounded-md border border-brand-border">
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
                        <span>
                          <span className="block font-semibold">
                            {merchant.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {merchant.category || "other"} · {merchant.phone}
                          </span>
                        </span>
                        {isSelected ? (
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-brand-primary">
                            محدد
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-dashed border-brand-border bg-brand-soft/30 p-4">
            {selectedMerchant ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-brand-text">
                  المتجر المحدد
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold text-brand-text">
                    {selectedMerchant.name}
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {selectedMerchant.category || "other"}
                  </span>
                  {typeof selectedMerchant._count?.products === "number" ? (
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-muted-foreground">
                      {selectedMerchant._count.products} منتج
                    </span>
                  ) : null}
                </div>
                {isPending ? (
                  <p className="text-sm text-muted-foreground">
                    جاري تحميل المنتجات والكتالوج...
                  </p>
                ) : null}
                {message ? (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {message}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                اختر تاجرًا لعرض نفس تجربة إضافة المنتجات المتاحة في لوحة
                التاجر.
              </p>
            )}
          </div>
        </div>
      </Card>

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
        />
      ) : null}
    </div>
  );
}
