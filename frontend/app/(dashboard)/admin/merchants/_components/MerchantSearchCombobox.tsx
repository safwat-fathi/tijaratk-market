"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  searchAdminMerchantsAction,
  type AdminMerchantSearchSuggestion,
} from "@/actions/admin-server";

const normalizeMerchantSearch = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const compactPhone = trimmed.replace(/[\s()-]/g, "");
  return /^[+0-9]+$/.test(compactPhone) ? compactPhone : trimmed;
};

export function MerchantSearchCombobox() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamValue = searchParams.get("search") || "";
  const tenantIdParam = searchParams.get("tenantId");
  const [inputValue, setInputValue] = useState(searchParamValue);
  const deferredSearch = useDeferredValue(inputValue);
  const [suggestions, setSuggestions] = useState<
    AdminMerchantSearchSuggestion[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (!tenantIdParam) {
      setInputValue(searchParamValue);
    }
  }, [searchParamValue, tenantIdParam]);

  useEffect(() => {
    const query = normalizeMerchantSearch(deferredSearch);
    const requestId = ++requestSequence.current;

    if (!query) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const searchTimeout = window.setTimeout(() => {
      setIsLoading(true);
      void searchAdminMerchantsAction(query)
        .then((results) => {
          if (requestSequence.current !== requestId) return;
          startTransition(() => setSuggestions(results));
        })
        .catch(() => {
          if (requestSequence.current === requestId) setSuggestions([]);
        })
        .finally(() => {
          if (requestSequence.current === requestId) setIsLoading(false);
        });
    }, 300);

    return () => window.clearTimeout(searchTimeout);
  }, [deferredSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedSearch = normalizeMerchantSearch(value);
    params.delete("tenantId");
    params.set("page", "1");
    if (normalizedSearch) {
      params.set("search", normalizedSearch);
    } else {
      params.delete("search");
    }
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  };

  const handleSelectSuggestion = (
    tenant: AdminMerchantSearchSuggestion,
  ) => {
    setInputValue(tenant.name);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.set("tenantId", String(tenant.id));
    params.delete("search");
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="merchant-search-suggestions"
          aria-autocomplete="list"
          className="w-full rounded-md border border-brand-border px-4 py-2 focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15"
          placeholder="ابحث بالاسم أو رقم الهاتف..."
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSearchSubmit(inputValue);
            } else if (event.key === "Escape") {
              setIsOpen(false);
            }
          }}
        />
        <button
          type="button"
          onClick={() => handleSearchSubmit(inputValue)}
          className="absolute inset-y-0 left-0 flex items-center px-3 text-gray-500 hover:text-brand-accent focus:outline-none"
          aria-label="بحث"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      </div>

      {isOpen && inputValue.trim() ? (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-brand-border bg-white shadow-lg">
          {isLoading ? (
            <div className="px-4 py-3 text-center text-sm text-gray-500">
              جاري البحث...
            </div>
          ) : suggestions.length > 0 ? (
            <ul
              id="merchant-search-suggestions"
              role="listbox"
              className="divide-y divide-brand-border/50 py-1 text-sm text-brand-text"
            >
              {suggestions.map((tenant) => (
                <li key={tenant.id}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center justify-between px-4 py-3 text-right transition-colors hover:bg-brand-soft focus:bg-brand-soft focus:outline-none"
                    onClick={() => handleSelectSuggestion(tenant)}
                  >
                    <span className="ml-2 truncate font-medium">
                      {tenant.name}
                    </span>
                    <span
                      className="shrink-0 text-xs text-gray-500"
                      dir="ltr"
                    >
                      {tenant.phone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-center text-sm text-gray-500">
              لا توجد نتائج مطابقة
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
