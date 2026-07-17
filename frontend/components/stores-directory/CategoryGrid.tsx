"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import AreaAutocomplete from "@/components/stores-directory/AreaAutocomplete";
import BottomSheet from "@/components/ui/BottomSheet";

export type DirectoryCategoryCard = {
  slug: string;
  name: string;
  stores: number;
  color: string;
  icon: ReactNode;
};

export type DirectoryAreaOption = {
  name: string;
  nameEn?: string | null;
  slug: string;
  stores: number;
  categoryCounts: Record<string, number>;
};

type Props = {
  categories: DirectoryCategoryCard[];
  areas: DirectoryAreaOption[];
  selectedAreaSlug?: string;
};

export default function CategoryGrid({
  categories,
  areas,
  selectedAreaSlug,
}: Props) {
  const [selectedCategory, setSelectedCategory] =
    useState<DirectoryCategoryCard | null>(null);
  const selectedCategoryAreas = selectedCategory
    ? areas
        .map((area) => ({
          ...area,
          selectedStores: area.categoryCounts[selectedCategory.slug] ?? 0,
        }))
        .filter((area) => area.selectedStores > 0)
    : [];

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {categories.map((cat) => {
          const cardContent = (
            <>
              <div
                className={`ml-6 flex h-20 w-20 flex-none items-center justify-center rounded-2xl ${cat.color} transition-transform group-hover:scale-105`}
              >
                {cat.icon}
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-bold text-[#222B2E]">
                  {cat.name}
                </h3>
                <p className="text-base font-medium text-gray-500">
                  {cat.stores} متجر متوفر
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors group-hover:bg-[#E8F5ED] group-hover:text-[#27AE60]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </div>
            </>
          );

          if (selectedAreaSlug) {
            return (
              <Link
                key={cat.slug}
                href={`/stores/${encodeURIComponent(selectedAreaSlug)}/${encodeURIComponent(cat.slug)}`}
                className="group flex w-full items-center rounded-2xl border border-gray-100 bg-white p-6 text-right shadow-sm transition-all hover:border-[#27AE60]/30 hover:shadow-md"
              >
                {cardContent}
              </Link>
            );
          }

          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className="group flex w-full items-center rounded-2xl border border-gray-100 bg-white p-6 text-right shadow-sm transition-all hover:border-[#27AE60]/30 hover:shadow-md"
            >
              {cardContent}
            </button>
          );
        })}
      </div>

      <BottomSheet
        isOpen={!!selectedCategory}
        onClose={() => setSelectedCategory(null)}
        title="اختر منطقتك أولاً"
      >
        <div className="flex flex-col gap-6 pb-4 pt-2">
          <AreaAutocomplete
            areas={selectedCategoryAreas.map((area) => ({
              name: area.name,
              nameEn: area.nameEn,
              slug: area.slug,
              stores: area.selectedStores,
            }))}
            destination={{
              type: "category",
              categorySlug: selectedCategory?.slug ?? "",
            }}
            inputClassName="w-full rounded-full border border-gray-300 bg-white py-3 pl-6 pr-12 text-base font-medium text-[#222B2E] shadow-sm focus:border-[#27AE60] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/20"
            iconClassName="h-5 w-5 text-gray-400"
          />

          <div className="flex flex-wrap gap-2">
            {selectedCategoryAreas.map((area) => (
              <Link
                key={area.slug}
                href={`/stores/${encodeURIComponent(area.slug)}/${encodeURIComponent(selectedCategory?.slug ?? "")}`}
                className="rounded-full border border-gray-200 bg-[#F7F8F6] px-4 py-2 text-sm font-semibold text-[#0F5A3D] transition-colors hover:border-[#27AE60]/30 hover:bg-[#E8F5ED]"
              >
                {area.name}
                <span className="mr-1 text-xs text-gray-500">
                  ({area.selectedStores})
                </span>
              </Link>
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
