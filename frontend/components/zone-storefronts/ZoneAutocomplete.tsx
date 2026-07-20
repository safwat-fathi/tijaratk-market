"use client";

import { type KeyboardEvent, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  normalizeAreaSearchValue,
  prepareAreaSearchOptions,
  rankPreparedAreaSearchOptions,
} from "@/lib/stores-directory/area-search";

export type ZoneSearchOption = {
  name: string;
  nameEn?: string | null;
  slug: string;
  zoneSlug: string;
  category: "grocery" | "pharmacy";
};

type Props = {
  options: ZoneSearchOption[];
};

const MAX_RESULTS = 6;
const INPUT_ID = "zone-area-search";
const RESULTS_ID = "zone-area-search-results";

const getCategoryLabel = (category: ZoneSearchOption["category"]) =>
  category === "pharmacy" ? "صيدلية" : "سوبر ماركت";

export default function ZoneAutocomplete({ options }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = normalizeAreaSearchValue(query);
  const preparedOptions = useMemo(
    () => prepareAreaSearchOptions(options),
    [options],
  );
  const matches = useMemo(
    () =>
      normalizedQuery
        ? rankPreparedAreaSearchOptions(
            preparedOptions,
            normalizedQuery,
            MAX_RESULTS,
          )
        : options.slice(0, MAX_RESULTS),
    [normalizedQuery, options, preparedOptions],
  );
  const shouldShowResults = isFocused;
  const activeOption = activeIndex >= 0 ? matches[activeIndex] : undefined;

  const navigateToZone = (option: ZoneSearchOption) => {
    setQuery(option.name);
    setIsFocused(false);
    setActiveIndex(-1);
    router.push(`/market/${encodeURIComponent(option.zoneSlug)}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsFocused(false);
      setActiveIndex(-1);
      return;
    }

    if (matches.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, matches.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      navigateToZone(activeOption ?? matches[0]);
    }
  };

  return (
    <div>
      <label
        htmlFor={INPUT_ID}
        className="block text-base font-bold text-brand-text"
      >
        اختر منطقتك
      </label>
      <p id={`${INPUT_ID}-hint`} className="mt-1 text-sm text-gray-600">
        ستنتقل مباشرة إلى خدمة السوبر ماركت أو الصيدلية المتاحة في المنطقة.
      </p>

      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
          aria-hidden="true"
        />
        <input
          id={INPUT_ID}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب اسم منطقتك..."
          className="brand-focus min-h-12 w-full rounded-xl border border-brand-border bg-white py-3 pl-4 pr-12 text-base font-semibold text-brand-text shadow-soft placeholder:font-normal"
          autoComplete="off"
          aria-describedby={`${INPUT_ID}-hint`}
          aria-autocomplete="list"
          aria-controls={RESULTS_ID}
          aria-expanded={shouldShowResults}
          aria-activedescendant={
            activeOption
              ? `zone-area-option-${activeOption.zoneSlug}`
              : undefined
          }
          role="combobox"
        />

        {shouldShowResults && (
          <div
            id={RESULTS_ID}
            role="listbox"
            aria-label="المناطق المتاحة"
            className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-brand-border bg-white p-2 text-right shadow-float"
          >
            {matches.length > 0 ? (
              matches.map((option, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.zoneSlug}
                    id={`zone-area-option-${option.zoneSlug}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigateToZone(option)}
                    className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-right transition-colors duration-200 focus:outline-none ${
                      isActive ? "bg-brand-soft" : "hover:bg-brand-bg"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-primary">
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-brand-text">
                        {option.name}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-brand-border bg-white px-3 py-1 text-xs font-bold text-brand-primary">
                      {getCategoryLabel(option.category)}
                    </span>
                  </button>
                );
              })
            ) : (
              <p role="status" className="px-3 py-4 text-sm text-gray-600">
                لا توجد منطقة متاحة بهذا الاسم حالياً.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
