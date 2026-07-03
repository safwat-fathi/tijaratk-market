"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { adminService, type AdminTenant } from "@/services/api/admin.service";
import { useDebounce } from 'use-debounce';

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
  const [suggestions, setSuggestions] = useState<AdminTenant[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedSearch] = useDebounce(inputValue, 400);

  useEffect(() => {
    if (!tenantIdParam) {
      setInputValue(searchParamValue);
    }
  }, [searchParamValue, tenantIdParam]);

  useEffect(() => {
    let active = true;

    if (!debouncedSearch || !debouncedSearch.trim()) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      const query = normalizeMerchantSearch(debouncedSearch);
      if (!query) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await adminService.getTenants({ search: query, limit: 5 });
        if (active && res.success && res.data && 'data' in res.data) {
          setSuggestions(res.data.data as AdminTenant[]);
        } else if (active && res.success && res.data && Array.isArray(res.data)) {
           setSuggestions(res.data as AdminTenant[]);
        } else if (active) {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Failed to fetch suggestions", err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchSuggestions();

    return () => {
      active = false;
    };
  }, [debouncedSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedSearch = normalizeMerchantSearch(value);
    params.delete("tenantId"); // Reset exact ID
    params.set("page", "1");
    if (normalizedSearch) {
      params.set("search", normalizedSearch);
    } else {
      params.delete("search");
    }
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  };

  const handleSelectSuggestion = (tenant: AdminTenant) => {
    setInputValue(tenant.name);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    params.set("tenantId", String(tenant.id));
    params.delete("search"); // Delete broad search since we have exact
    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full rounded-md border border-brand-border focus:border-brand-accent focus:outline-none focus:ring-4 focus:ring-brand-accent/15 px-4 py-2"
          placeholder="ابحث بالاسم أو رقم الهاتف..."
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearchSubmit(inputValue);
            }
          }}
        />
        <button
          type="button"
          onClick={() => handleSearchSubmit(inputValue)}
          className="absolute inset-y-0 left-0 flex items-center px-3 text-gray-500 hover:text-brand-accent focus:outline-none"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {isOpen && inputValue.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-brand-border rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">جاري البحث...</div>
          ) : suggestions.length > 0 ? (
            <ul className="py-1 text-sm text-brand-text divide-y divide-brand-border/50">
              {suggestions.map((tenant) => (
                <li key={tenant.id}>
                  <button
                    type="button"
                    className="w-full text-right px-4 py-3 hover:bg-brand-soft focus:bg-brand-soft focus:outline-none flex justify-between items-center transition-colors"
                    onClick={() => handleSelectSuggestion(tenant)}
                  >
                    <span className="font-medium truncate ml-2">{tenant.name}</span>
                    <span className="text-gray-500 text-xs shrink-0" dir="ltr">{tenant.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              لا توجد نتائج مطابقة
            </div>
          )}
        </div>
      )}
    </div>
  );
}
