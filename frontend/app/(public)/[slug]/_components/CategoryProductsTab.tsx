import { ScrollableTabList, TabButton } from "@/components/ui/ScrollableTabs";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import { formatArabicInteger } from "@/lib/utils/number";
import { ALL_PRODUCTS_CATEGORY, type CategoryTab } from "../_utils/order-form";

interface CategoryProductsTabProps {
	categoryTabs: CategoryTab[];
	activeCategory: string;
	onCategoryChange: (categoryKey: string) => void;
	setCategoryPillRef?: (
		categoryKey: string,
		node: HTMLElement | null,
	) => void;
}

export default function CategoryProductsTab({
	categoryTabs,
	activeCategory,
	onCategoryChange,
	setCategoryPillRef,
}: CategoryProductsTabProps) {
	return (
		<ScrollableTabList className="mb-4">
			{categoryTabs.map(category => {
				const isActive = activeCategory === category.key;
				return (
					<TabButton
						key={category.key}
						ref={node => setCategoryPillRef?.(category.key, node)}
						variant="pill"
						isActive={isActive}
						draggable={false}
						href={category.key === ALL_PRODUCTS_CATEGORY ? "?" : `?category=${encodeURIComponent(category.key)}`}
						prefetch={true}
						onClick={() => {
							// Allow onCategoryChange to handle the URL if needed
							onCategoryChange(category.key);
						}}
						className={
							isActive
								? "border-brand-primary bg-brand-soft text-brand-primary"
								: ""
						}
					>
						<ImageThumbnail
							src={category.image_url}
							alt={category.label}
							width={40}
							height={40}
							draggable={false}
							disableEnlarge={true}
							sizes="32px"
							imageClassName="h-8 w-8 rounded-full object-cover ring-1 ring-gray-200"
							fallback={
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px]">
									🛒
								</span>
							}
						/>
						{category.label}
						<span
							className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
								isActive
									? "bg-white/60 text-brand-primary"
									: "bg-brand-soft text-muted-foreground"
							}`}
						>
							{formatArabicInteger(category.count) || category.count}
						</span>
					</TabButton>
				);
			})}
		</ScrollableTabList>
	);
}
