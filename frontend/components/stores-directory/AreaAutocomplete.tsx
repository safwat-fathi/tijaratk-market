"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  normalizeAreaSearchValue,
  prepareAreaSearchOptions,
  rankPreparedAreaSearchOptions,
} from "@/lib/stores-directory/area-search";

export type AreaAutocompleteOption = {
  name: string;
  nameEn?: string | null;
  slug: string;
  destinationSlug?: string;
  parentNameAr?: string;
  stores: number;
};

type Props = {
  areas: AreaAutocompleteOption[];
  destination:
    | {
        type: "landing";
      }
    | {
        type: "category";
        categorySlug: string;
      };
  placeholder?: string;
  inputClassName?: string;
  iconClassName?: string;
  emptyMessage?: string;
};

const MAX_RESULTS = 6;

const getAreaHref = (
  area: AreaAutocompleteOption,
  destination: Props["destination"],
) => {
  if (destination.type === "landing") {
    return `/?area=${encodeURIComponent(area.destinationSlug || area.slug)}`;
  }

  return `/stores/${encodeURIComponent(area.slug)}/${encodeURIComponent(
    destination.categorySlug,
  )}`;
};

export default function AreaAutocomplete({
  areas,
  destination,
  placeholder = "ابحث عن منطقتك...",
  inputClassName = "w-full rounded-full border border-gray-300 bg-white py-4 pl-6 pr-14 text-lg font-medium text-[#222B2E] shadow-sm focus:border-[#27AE60] focus:outline-none focus:ring-2 focus:ring-[#27AE60]/20",
  iconClassName = "h-6 w-6 text-gray-400",
  emptyMessage = "لا توجد منطقة بهذا الاسم",
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const normalizedQuery = normalizeAreaSearchValue(query);
  const preparedAreas = useMemo(() => prepareAreaSearchOptions(areas), [areas]);
  const matches = useMemo(() => {
    return rankPreparedAreaSearchOptions(
      preparedAreas,
      normalizedQuery,
      MAX_RESULTS,
    );
  }, [preparedAreas, normalizedQuery]);
  const shouldShowDropdown = isFocused && normalizedQuery.length > 0;

  const navigateToArea = (area: AreaAutocompleteOption) => {
    router.push(getAreaHref(area, destination));
    setQuery(area.name);
    setIsFocused(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || matches.length === 0) return;

    event.preventDefault();
    navigateToArea(matches[0]);
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={iconClassName}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
        inputMode="search"
        autoComplete="off"
      />

      {shouldShowDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white text-right shadow-lg">
          {matches.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-2">
              {matches.map((area) => (
                <button
                  key={area.slug}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigateToArea(area)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-right transition-colors hover:bg-[#E8F5ED] focus:bg-[#E8F5ED] focus:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[#222B2E]">
                      {area.name}
                    </span>
                    {area.parentNameAr && (
                      <span className="mt-0.5 block truncate text-xs font-medium text-gray-500">
                        ضمن: {area.parentNameAr}
                      </span>
                    )}
                  </span>
                  <span className="flex-none rounded-full bg-[#F7F8F6] px-3 py-1 text-xs font-semibold text-[#0F5A3D]">
                    {area.stores} متجر
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm font-medium text-gray-500">
              {emptyMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
