import type {
	Product,
	PublicProductCategory,
} from "@/types/models/product";
import type { ProductCartSelection } from "../_components/ProductList";

export const ALL_PRODUCTS_CATEGORY = "__all_products__";

export type CategoryTab = {
	key: string;
	label: string;
	count: number;
	image_url: string | null;
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
						image_url: null,
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
			image_url:
				categoriesSource.find(item => item.image_url)?.image_url ?? null,
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
