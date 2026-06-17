import type {
	Product,
	PublicProductCategory,
} from "@/types/models/product";
import type { Order } from "@/types/models/order";
import type { ProductCartSelection } from "../_components/ProductList";

export const ALL_PRODUCTS_CATEGORY = "__all_products__";

export type PaginationState = {
	page: number;
	lastPage: number;
	isLoading: boolean;
	hasLoaded: boolean;
	error: string | null;
};

export type CategoryTab = {
	key: string;
	label: string;
	count: number;
	image_url?: string;
};

const parseProductPrice = (product?: Product): number | null => {
	if (!product) {
		return null;
	}

	const parsedPrice = Number(product.current_price);
	if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
		return null;
	}

	return parsedPrice;
};

const resolveUnitMultiplier = (
	product: Product | undefined,
	unitOptionId: string | undefined,
): number => {
	if (!product || !unitOptionId) {
		return 1;
	}

	const options = product.order_config?.quantity?.unit_options;
	if (!Array.isArray(options)) {
		return 1;
	}

	const matched = options.find(option => option.id === unitOptionId);
	if (!matched) {
		return 1;
	}

	const multiplier = Number(matched.multiplier);
	if (!Number.isFinite(multiplier) || multiplier <= 0) {
		return 1;
	}

	return multiplier;
};

export const resolveSelectionLineTotal = (
	selection: ProductCartSelection,
	product: Product | undefined,
): number | null => {
	if (selection.selection_mode === "price") {
		const amount = Number(selection.selection_amount_egp || 0);

		return Number.isFinite(amount) && amount > 0
			? Number(amount.toFixed(2))
			: null;
	}

	const productPrice = parseProductPrice(product);
	if (!productPrice) {
		return null;
	}

	if (selection.selection_mode === "weight") {
		const grams = Number(selection.selection_grams || 0);
		if (!Number.isFinite(grams) || grams <= 0) {
			return null;
		}

		return Number(((grams / 1000) * productPrice).toFixed(2));
	}

	const qty = Number(selection.selection_quantity || 0);
	if (!Number.isFinite(qty) || qty <= 0) {
		return null;
	}

	const multiplier = resolveUnitMultiplier(product, selection.unit_option_id);
	return Number((qty * multiplier * productPrice).toFixed(2));
};

export const resolveSelectionQuantityText = (
	selection: ProductCartSelection,
	product: Product | undefined,
): string => {
	if (selection.selection_mode === "weight") {
		const grams = Number(selection.selection_grams || 0);
		return Number((grams / 1000).toFixed(3)).toString();
	}

	if (selection.selection_mode === "price") {
		return "1";
	}

	const qty = Number(selection.selection_quantity || 0);
	const multiplier = resolveUnitMultiplier(product, selection.unit_option_id);
	return Number((qty * multiplier).toFixed(3)).toString();
};

export const buildInitialCartSelections = (
	initialOrder?: Order | null,
): Record<number, ProductCartSelection> =>
	initialOrder?.items?.reduce(
		(acc: Record<number, ProductCartSelection>, item) => {
			if (!item.product_id) {
				return acc;
			}

			const itemSelectionMode =
				item.selection_mode === "weight" ||
				item.selection_mode === "price" ||
				item.selection_mode === "quantity"
					? item.selection_mode
					: "quantity";

			if (itemSelectionMode === "weight") {
				const grams = Number(item.selection_grams || 0);
				if (Number.isFinite(grams) && grams > 0) {
					acc[item.product_id] = {
						selection_mode: "weight",
						selection_grams: Math.round(grams),
						item_note: item.notes || undefined,
					};
				}
				return acc;
			}

			if (itemSelectionMode === "price") {
				const amount = Number(item.selection_amount_egp || 0);
				if (Number.isFinite(amount) && amount > 0) {
					acc[item.product_id] = {
						selection_mode: "price",
						selection_amount_egp: Number(amount.toFixed(2)),
						item_note: item.notes || undefined,
					};
				}
				return acc;
			}

			const parsedQty =
				Number(item.selection_quantity || 0) ||
				Number.parseFloat(String(item.quantity ?? "1"));
			if (Number.isFinite(parsedQty) && parsedQty > 0) {
				acc[item.product_id] = {
					selection_mode: "quantity",
					selection_quantity: parsedQty,
					unit_option_id: item.unit_option_id || undefined,
					item_note: item.notes || undefined,
				};
			}
			return acc;
		},
		{} as Record<number, ProductCartSelection>,
	) || {};

export const buildCategoryTabs = (
	initialCategories: PublicProductCategory[],
	initialProducts: Product[],
	initialProductsTotal: number,
): CategoryTab[] => {
	const categoriesSource: PublicProductCategory[] =
		initialCategories.length > 0
			? initialCategories
			: Array.from(
						initialProducts.reduce<Map<string, number>>((acc, product) => {
							const category = product.category?.trim();
							if (!category) {
								return acc;
							}
							acc.set(category, (acc.get(category) || 0) + 1);
							return acc;
						}, new Map<string, number>()),
				  ).map(([category, count]) => ({
						category,
						count,
						image_url: undefined,
				  }));

	const allCount =
		categoriesSource.length > 0
			? categoriesSource.reduce((sum, category) => sum + category.count, 0)
			: initialProductsTotal;

	return [
		{
			key: ALL_PRODUCTS_CATEGORY,
			label: "الكل",
			count: allCount,
			image_url: categoriesSource.find(item => item.image_url)?.image_url,
		},
		...categoriesSource.map(category => ({
			key: category.category,
			label: category.category,
			count: category.count,
			image_url: category.image_url,
		})),
	];
};

export const calculateCartSummary = (
	cartSelections: Record<number, ProductCartSelection>,
	knownProductsById: Record<number, Product>,
) => {
	const isValidSelection = (selection: ProductCartSelection): boolean => {
		if (selection.selection_mode === "quantity") {
			const quantity = Number(selection.selection_quantity || 0);
			return Number.isFinite(quantity) && quantity > 0;
		}

		if (selection.selection_mode === "weight") {
			const grams = Number(selection.selection_grams || 0);
			return Number.isFinite(grams) && grams > 0;
		}

		const amount = Number(selection.selection_amount_egp || 0);
		return Number.isFinite(amount) && amount > 0;
	};

	const totalItems = Object.entries(cartSelections).reduce((sum, [, selection]) => {
		if (!isValidSelection(selection)) {
			return sum;
		}

		return sum + 1;
	}, 0);

	const estimatedTotal = Object.entries(cartSelections).reduce(
		(sum, [pid, selection]) => {
			const product = knownProductsById[Number(pid)];
			const lineTotal = resolveSelectionLineTotal(selection, product);
			if (lineTotal === null) {
				return sum;
			}

			return sum + lineTotal;
		},
		0,
	);

	const hasPricedItems = Object.entries(cartSelections).some(([pid, selection]) => {
		const product = knownProductsById[Number(pid)];
		return resolveSelectionLineTotal(selection, product) !== null;
	});

	return {
		totalItems,
		estimatedTotal,
		hasPricedItems,
	};
};

export const buildCartItems = (
	cartSelections: Record<number, ProductCartSelection>,
	knownProductsById: Record<number, Product>,
) =>
	Object.entries(cartSelections).map(([pid, selection]) => {
		const product = knownProductsById[Number(pid)];
		return {
			product_id: Number(pid),
			name: product?.name || "منتج",
			quantity: resolveSelectionQuantityText(selection, product),
			total_price: resolveSelectionLineTotal(selection, product) || undefined,
			notes: selection.item_note?.trim() || undefined,
			selection_mode: selection.selection_mode,
			selection_quantity: selection.selection_quantity,
			selection_grams: selection.selection_grams,
			selection_amount_egp: selection.selection_amount_egp,
			unit_option_id: selection.unit_option_id,
		};
	});
