"use server";

import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import { availabilityRequestsService } from "@/services/api/availability-requests.service";
import type {
	MerchantAvailabilityRequestItem,
	MerchantAvailabilityRequestsMeta,
	MerchantAvailabilityRequestsParams,
} from "@/types/services/availability-requests";

type AvailabilityRequestsPageActionResult = {
	success: boolean;
	message?: string;
	data: MerchantAvailabilityRequestItem[];
	meta: MerchantAvailabilityRequestsMeta;
};

const DEFAULT_LIMIT = 20;

const buildFallbackMeta = (
	page: number,
	limit: number,
	total = 0,
): MerchantAvailabilityRequestsMeta => ({
	total,
	page,
	last_page: total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
	limit,
});

const normalizePositiveInteger = (
	value: number | undefined,
	fallback: number,
): number => {
	if (!Number.isFinite(value) || !value) {
		return fallback;
	}

	const normalized = Math.floor(value);
	return normalized > 0 ? normalized : fallback;
};

export async function getAvailabilityRequestsPageAction(
	input?: MerchantAvailabilityRequestsParams,
): Promise<AvailabilityRequestsPageActionResult> {
	const page = normalizePositiveInteger(input?.page, 1);
	const limit = normalizePositiveInteger(input?.limit, DEFAULT_LIMIT);

	try {
		const response = await availabilityRequestsService.getMerchantRequests({
			...input,
			page,
			limit,
		});

		if (!response.success || !response.data) {
			return {
				success: false,
				message: response.message || "تعذر تحميل طلبات التوفير",
				data: [],
				meta: buildFallbackMeta(page, limit),
			};
		}

		return {
			success: true,
			data: Array.isArray(response.data.data) ? response.data.data : [],
			meta: response.data.meta || buildFallbackMeta(page, limit),
		};
	} catch (error) {
		if (isNextRedirectError(error)) {
			throw error;
		}

		return {
			success: false,
			message:
				error instanceof Error ? error.message : "تعذر تحميل طلبات التوفير",
			data: [],
			meta: buildFallbackMeta(page, limit),
		};
	}
}
