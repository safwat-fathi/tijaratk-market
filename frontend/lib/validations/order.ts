import { z } from "zod";

export const createOrderSchema = z.object({
	customer_name: z.string().min(2, "Name is required"),
	customer_phone: z
		.string()
		.min(10, "Phone number is required and must be valid"),
	delivery_address: z.string().min(5, "Address must be at least 5 characters"),
	notes: z.string().optional(),
	order_request: z.string().optional(),
	cart: z.string().optional(), // We'll parse this manually or refine
	delivery_area_slug: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
