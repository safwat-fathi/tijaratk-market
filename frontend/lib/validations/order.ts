import { z } from "zod";
import { OrderSource, UnavailableItemAction } from "@/types/enums";
import { isValidEgyptianCustomerPhone } from "@/lib/utils/phone";

const orderSourceValues = [
	OrderSource.STOREFRONT,
	OrderSource.DIRECTORY,
	OrderSource.WHATSAPP,
	OrderSource.MANUAL,
] as const;

const unavailableItemActionValues = [
	UnavailableItemAction.SUGGEST_REPLACEMENT,
	UnavailableItemAction.DELETE_ITEM,
	UnavailableItemAction.CANCEL_ORDER,
] as const;

export const createOrderSchema = z.object({
	customer_name: z.string().min(2, "Name is required"),
	customer_phone: z
		.string()
		.refine(isValidEgyptianCustomerPhone, "Phone number is required and must be valid"),
	delivery_address: z.string().min(5, "Address must be at least 5 characters"),
	notes: z.string().optional(),
	order_request: z.string().optional(),
	cart: z.string().optional(), // We'll parse this manually or refine
	delivery_area_slug: z.string().optional(),
	order_source: z.enum(orderSourceValues).optional(),
	source_metadata: z.string().optional(),
	unavailable_item_action: z.enum(unavailableItemActionValues).optional(),
	card_on_delivery_requested: z
		.enum(["true", "false", "on"])
		.optional()
		.transform(value => value === "true" || value === "on"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
