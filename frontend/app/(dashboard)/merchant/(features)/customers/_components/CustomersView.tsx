"use client";

import { getCustomersPageAction } from "@/actions/customer-actions";
import { Customer } from "@/types/models/customer";
import { useCallback, useEffect, useRef, useState } from "react";
import CustomerHeader from "./CustomerHeader";
import CustomerSearch from "./CustomerSearch";
import CustomerCard from "./CustomerCard";
import CustomerDetailsSheet from "./CustomerDetailsSheet";
import { useDebouncedCallback } from "use-debounce";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface CustomersViewProps {
	initialCustomers: Customer[];
	initialPage: number;
	initialLastPage: number;
	initialError?: string;
	initialSearch?: string;
}

const DEFAULT_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 500;

export default function CustomersView({
	initialCustomers,
	initialPage,
	initialLastPage,
	initialError,
	initialSearch = "",
}: CustomersViewProps) {
	const safeInitialPage = Math.max(1, initialPage || 1);
	const safeInitialLastPage = Math.max(
		safeInitialPage,
		initialLastPage || safeInitialPage,
	);

	const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
	const [searchQuery, setSearchQuery] = useState(initialSearch);
	const [activeSearch, setActiveSearch] = useState(initialSearch);
	const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
		null,
	);

	const [page, setPage] = useState(safeInitialPage);
	const [hasMore, setHasMore] = useState(safeInitialPage < safeInitialLastPage);
	const [isLoading, setIsLoading] = useState(false);
	const [listError, setListError] = useState<string | null>(initialError || null);

	const observerTarget = useRef<HTMLDivElement | null>(null);
	const requestIdRef = useRef(0);

	const loadCustomers = useCallback(
		async ({
			pageNumber,
			search,
			reset,
		}: {
			pageNumber: number;
			search: string;
			reset: boolean;
		}) => {
			const requestId = ++requestIdRef.current;
			setIsLoading(true);
			setListError(null);

			const response = await getCustomersPageAction({
				search: search.trim() || undefined,
				page: pageNumber,
				limit: DEFAULT_LIMIT,
			});

			if (requestId !== requestIdRef.current) {
				return;
			}

			if (!response.success) {
				if (reset) {
					setCustomers([]);
					setPage(1);
				}

				setHasMore(false);
				setListError(response.message || "تعذر تحميل العملاء");
				setIsLoading(false);
				return;
			}

			const nextPage = Math.max(1, response.meta.page || pageNumber);
			const nextLastPage = Math.max(nextPage, response.meta.last_page || nextPage);

			setCustomers(previous =>
				reset ? response.data : [...previous, ...response.data],
			);
			setPage(nextPage);
			setHasMore(nextPage < nextLastPage);
			setIsLoading(false);
		},
		[],
	);

	const debouncedSearch = useDebouncedCallback((value: string) => {
		setActiveSearch(value);
		void loadCustomers({
			pageNumber: 1,
			search: value,
			reset: true,
		});
	}, SEARCH_DEBOUNCE_MS);

	const handleSearchChange = (value: string) => {
		setSearchQuery(value);
		debouncedSearch(value);
	};

	const handleSearchClear = () => {
		debouncedSearch.cancel();
		setSearchQuery("");
		setActiveSearch("");
		void loadCustomers({
			pageNumber: 1,
			search: "",
			reset: true,
		});
	};

	useEffect(() => {
		return () => debouncedSearch.cancel();
	}, [debouncedSearch]);

	useEffect(() => {
		const target = observerTarget.current;
		if (!target || !hasMore) {
			return;
		}

		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (!entry?.isIntersecting || isLoading || !hasMore) {
					return;
				}

				void loadCustomers({
					pageNumber: page + 1,
					search: activeSearch,
					reset: false,
				});
			},
			{ threshold: 1.0 },
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [activeSearch, hasMore, isLoading, loadCustomers, page]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <CustomerHeader count={customers.length} />
      
      <div className="sticky top-[57px] z-10 bg-white pb-1 shadow-soft">
        <CustomerSearch
					value={searchQuery}
					onChange={handleSearchChange}
					onClear={handleSearchClear}
				/>
      </div>

			{listError && (
				<div className="bg-white px-4 py-2 text-sm text-status-error">{listError}</div>
			)}

      <div className="min-h-[calc(100vh-200px)] bg-background">
        {customers.length > 0 ? (
           <>
               {customers.map(customer => (
                 <button key={`${customer.id}-${customer.phone}`} type="button" onClick={() => setSelectedCustomerId(customer.id)} className="block w-full text-start focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20">
                    <CustomerCard customer={customer} />
                  </button>
               ))}
               
               {/* Loader for infinite scroll */}
               {hasMore && (
                    <div ref={observerTarget} className="flex justify-center py-6 text-muted-foreground">
                         <LoadingSpinner className="h-6 w-6" />
                   </div>
               )}
           </>
        ) : (
           !isLoading && (
               <EmptyState
                title="لا يوجد عملاء"
                description={listError ? "حدث خطأ أثناء تحميل البيانات." : "حاول تعديل البحث."}
                icon={
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                }
               />
           )
        )}
        
        {isLoading && customers.length === 0 && (
              <div className="flex justify-center py-12 text-brand-primary">
                <LoadingSpinner className="h-8 w-8" />
             </div>
        )}
      </div>

      <CustomerDetailsSheet 
        key={selectedCustomerId ?? "customer-sheet"}
        customerId={selectedCustomerId} 
        onClose={() => setSelectedCustomerId(null)} 
      />
    </div>
  );
}
