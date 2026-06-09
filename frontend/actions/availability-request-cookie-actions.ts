"use server";

import {
	markAvailabilityCookieRequestSent,
	markCustomAvailabilityCookieRequestSent,
	prepareAvailabilityCookieState,
	prepareCustomAvailabilityCookieState,
} from "@/lib/tracking/availability-request-cookie";

export async function prepareAvailabilityRequestAction(input: {
	slug: string;
	product_id: number;
}): Promise<{
	success: boolean;
	visitor_key: string;
	date_key: string;
	already_requested_today: boolean;
	message?: string;
}> {
	try {
		const prepared = await prepareAvailabilityCookieState(
			input.slug,
			input.product_id,
		);

		return {
			success: true,
			visitor_key: prepared.visitorKey,
			date_key: prepared.dateKey,
			already_requested_today: prepared.alreadyRequestedToday,
		};
	} catch (error) {
		console.error("Failed to prepare availability request cookie state", error);
		return {
			success: false,
			visitor_key: "",
			date_key: "",
			already_requested_today: false,
			message: "تعذر تجهيز طلب التوفير حالياً",
		};
	}
}

export async function prepareCustomAvailabilityRequestAction(input: {
	slug: string;
	requested_product_name: string;
}): Promise<{
	success: boolean;
	visitor_key: string;
	date_key: string;
	already_requested_today: boolean;
	requested_product_name: string;
	message?: string;
}> {
	try {
		const prepared = await prepareCustomAvailabilityCookieState(
			input.slug,
			input.requested_product_name,
		);

		return {
			success: true,
			visitor_key: prepared.visitorKey,
			date_key: prepared.dateKey,
			already_requested_today: prepared.alreadyRequestedToday,
			requested_product_name: prepared.requestedProductName,
		};
	} catch (error) {
		console.error("Failed to prepare custom availability request cookie state", error);
		return {
			success: false,
			visitor_key: "",
			date_key: "",
			already_requested_today: false,
			requested_product_name: "",
			message: "تعذر تجهيز طلب التوفير حالياً",
		};
	}
}

export async function markAvailabilityRequestSentAction(input: {
	slug: string;
	product_id: number;
	date_key?: string;
}): Promise<{ success: boolean; message?: string }> {
	try {
		await markAvailabilityCookieRequestSent(
			input.slug,
			input.product_id,
			input.date_key,
		);

		return { success: true };
	} catch (error) {
		console.error("Failed to mark availability request cookie state", error);
		return {
			success: false,
			message: "تعذر حفظ حالة الطلب محلياً",
		};
	}
}

export async function markCustomAvailabilityRequestSentAction(input: {
	slug: string;
	requested_product_name: string;
	date_key?: string;
}): Promise<{ success: boolean; message?: string }> {
	try {
		await markCustomAvailabilityCookieRequestSent(
			input.slug,
			input.requested_product_name,
			input.date_key,
		);

		return { success: true };
	} catch (error) {
		console.error("Failed to mark custom availability request cookie state", error);
		return {
			success: false,
			message: "تعذر حفظ حالة الطلب محلياً",
		};
	}
}
