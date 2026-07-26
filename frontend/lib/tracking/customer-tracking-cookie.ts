import { cookies } from "next/headers";

import { STORAGE_KEYS } from "@/constants";

const COOKIE_VERSION = 1;
const MAX_TRACKED_ORDER_ITEMS = 15;
const MAX_CUSTOMER_PROFILE_ITEMS = 8;
const MAX_TRACKING_COOKIE_VALUE_BYTES = 3200;
const TRACKING_COOKIE_TTL_DAYS = 90;

export type SavedAccessCodeCookieItem = {
	code: string;
	phone: string;
	last_used_at: string;
};

export type TrackedOrderCookieItem = {
	token: string;
	slug: string;
	created_at: string;
};

export type CustomerProfileCookieItem = {
	name?: string;
	phone: string;
	address?: string;
	notes?: string;
	updated_at: string;
};

type CustomerProfileCookieInput = {
	name?: string;
	phone: string;
	address?: string;
	notes?: string;
};

type TrackedOrdersCookiePayload = {
	v: number;
	items: TrackedOrderCookieItem[];
	customer_profiles_by_slug: Record<string, CustomerProfileCookieItem>;
	access_codes?: SavedAccessCodeCookieItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function normalizeSlugKey(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return "";
	}

	try {
		return decodeURIComponent(trimmed).normalize("NFC");
	} catch {
		return trimmed.normalize("NFC");
	}
}

function isValidTrackedOrderItem(value: unknown): value is TrackedOrderCookieItem {
	if (!isRecord(value)) {
		return false;
	}

	const token = value.token;
	const slug = value.slug;
	const createdAt = value.created_at;

	return (
		typeof token === "string" &&
		token.trim().length > 0 &&
		typeof slug === "string" &&
		slug.trim().length > 0 &&
		typeof createdAt === "string" &&
		createdAt.trim().length > 0
	);
}

function normalizeTrackedOrderItems(items: TrackedOrderCookieItem[]) {
	const deduped = new Map<string, TrackedOrderCookieItem>();

	for (const item of items) {
		const token = item.token.trim();
		const slug = item.slug.trim();
		const createdAt = item.created_at.trim();

		if (!token || !slug || !createdAt) {
			continue;
		}

		if (!deduped.has(token)) {
			deduped.set(token, {
				token,
				slug,
				created_at: createdAt,
			});
		}
	}

	return Array.from(deduped.values()).slice(0, MAX_TRACKED_ORDER_ITEMS);
}

function normalizeOptionalText(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

function isValidSavedAccessCodeCookieItem(value: unknown): value is SavedAccessCodeCookieItem {
	if (!isRecord(value)) return false;
	const code = value.code;
	const phone = value.phone;
	const lastUsedAt = value.last_used_at;
	return (
		typeof code === "string" && code.trim().length > 0 &&
		typeof phone === "string" && phone.trim().length > 0 &&
		typeof lastUsedAt === "string" && lastUsedAt.trim().length > 0
	);
}

function normalizeSavedAccessCodes(items?: unknown[]): SavedAccessCodeCookieItem[] {
	if (!Array.isArray(items)) return [];
	const deduped = new Map<string, SavedAccessCodeCookieItem>();
	for (const raw of items) {
		if (!isValidSavedAccessCodeCookieItem(raw)) continue;
		const code = raw.code.trim();
		const phone = raw.phone.trim();
		const lastUsedAt = raw.last_used_at.trim();
		const existing = deduped.get(phone);
		if (!existing || Date.parse(existing.last_used_at) < Date.parse(lastUsedAt)) {
			deduped.set(phone, { code, phone, last_used_at: lastUsedAt });
		}
	}
	return Array.from(deduped.values())
		.sort((a, b) => {
			const timeA = Date.parse(a.last_used_at);
			const timeB = Date.parse(b.last_used_at);
			return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
		})
		.slice(0, 5);
}

function isValidCustomerProfileCookieItem(
	value: unknown,
): value is CustomerProfileCookieItem {
	if (!isRecord(value)) {
		return false;
	}

	const phone = value.phone;
	const updatedAt = value.updated_at;

	return (
		typeof phone === "string" &&
		phone.trim().length > 0 &&
		typeof updatedAt === "string" &&
		updatedAt.trim().length > 0
	);
}

function normalizeCustomerProfilesBySlug(
	value: unknown,
): Record<string, CustomerProfileCookieItem> {
	if (!isRecord(value)) {
		return {};
	}

	const nextProfilesEntries: Array<[string, CustomerProfileCookieItem]> = [];

	for (const [rawSlug, rawProfile] of Object.entries(value)) {
		const slug = normalizeSlugKey(rawSlug);
		if (!slug || !isValidCustomerProfileCookieItem(rawProfile)) {
			continue;
		}

		const phone = rawProfile.phone.trim();
		const updatedAt = rawProfile.updated_at.trim();

		if (!phone || !updatedAt) {
			continue;
		}

		nextProfilesEntries.push([
			slug,
			{
			phone,
			updated_at: updatedAt,
			name: normalizeOptionalText(rawProfile.name),
			address: normalizeOptionalText(rawProfile.address),
			notes: normalizeOptionalText(rawProfile.notes),
			},
		]);
	}

	return Object.fromEntries(nextProfilesEntries);
}

function sortCustomerProfileEntriesByNewest(
	profilesBySlug: Record<string, CustomerProfileCookieItem>,
): Array<[string, CustomerProfileCookieItem]> {
	return Object.entries(profilesBySlug).sort(([, profileA], [, profileB]) => {
		const timeA = Date.parse(profileA.updated_at);
		const timeB = Date.parse(profileB.updated_at);

		return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
	});
}

function limitCustomerProfilesBySlug(
	profilesBySlug: Record<string, CustomerProfileCookieItem>,
	limit = MAX_CUSTOMER_PROFILE_ITEMS,
): Record<string, CustomerProfileCookieItem> {
	return Object.fromEntries(
		sortCustomerProfileEntriesByNewest(profilesBySlug).slice(0, limit),
	);
}

function getEncodedCookiePayloadSize(payload: TrackedOrdersCookiePayload) {
	return encodeURIComponent(JSON.stringify(payload)).length;
}

function normalizeTrackedOrdersCookiePayload(
	payload: TrackedOrdersCookiePayload,
): TrackedOrdersCookiePayload {
	let normalizedPayload: TrackedOrdersCookiePayload = {
		v: COOKIE_VERSION,
		items: normalizeTrackedOrderItems(payload.items),
		customer_profiles_by_slug: limitCustomerProfilesBySlug(
			payload.customer_profiles_by_slug,
		),
		access_codes: normalizeSavedAccessCodes(payload.access_codes),
	};

	while (
		getEncodedCookiePayloadSize(normalizedPayload) >
			MAX_TRACKING_COOKIE_VALUE_BYTES &&
		Object.keys(normalizedPayload.customer_profiles_by_slug).length > 0
	) {
		normalizedPayload = {
			...normalizedPayload,
			customer_profiles_by_slug: limitCustomerProfilesBySlug(
				normalizedPayload.customer_profiles_by_slug,
				Object.keys(normalizedPayload.customer_profiles_by_slug).length - 1,
			),
		};
	}

	while (
		getEncodedCookiePayloadSize(normalizedPayload) >
			MAX_TRACKING_COOKIE_VALUE_BYTES &&
		normalizedPayload.items.length > 1
	) {
		normalizedPayload = {
			...normalizedPayload,
			items: normalizedPayload.items.slice(0, -1),
		};
	}

	return normalizedPayload;
}

function parseTrackedOrdersCookie(
	rawCookie?: string,
): TrackedOrdersCookiePayload {
	const defaultPayload: TrackedOrdersCookiePayload = { v: COOKIE_VERSION, items: [], customer_profiles_by_slug: {}, access_codes: [] };
	if (!rawCookie) {
		return defaultPayload;
	}

	try {
		const parsed = JSON.parse(rawCookie) as unknown;
		if (!isRecord(parsed)) {
			return defaultPayload;
		}

		const items = Array.isArray(parsed.items)
			? parsed.items.filter(isValidTrackedOrderItem)
			: [];
		const customerProfilesBySlug = normalizeCustomerProfilesBySlug(
			parsed.customer_profiles_by_slug,
		);
		const accessCodes = normalizeSavedAccessCodes(parsed.access_codes as unknown[]);

		return {
			v: COOKIE_VERSION,
			items: normalizeTrackedOrderItems(items),
			customer_profiles_by_slug: limitCustomerProfilesBySlug(
				customerProfilesBySlug,
			),
			access_codes: accessCodes,
		};
	} catch {
		return defaultPayload;
	}
}

async function readTrackedOrdersCookiePayload(): Promise<TrackedOrdersCookiePayload> {
	const cookieStore = await cookies();
	const rawCookie = cookieStore.get(STORAGE_KEYS.CUSTOMER_TRACKED_ORDERS)?.value;
	return parseTrackedOrdersCookie(rawCookie);
}

async function writeTrackedOrdersCookie(
	payload: TrackedOrdersCookiePayload,
): Promise<void> {
	const cookieStore = await cookies();
	const normalizedPayload = normalizeTrackedOrdersCookiePayload(payload);
	const expiresAt = new Date(
		Date.now() + TRACKING_COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000,
	);

	cookieStore.set(
		STORAGE_KEYS.CUSTOMER_TRACKED_ORDERS,
		JSON.stringify(normalizedPayload),
		{
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			expires: expiresAt,
		},
	);
}

export async function listTrackedOrdersFromCookie(): Promise<
	TrackedOrderCookieItem[]
> {
	const payload = await readTrackedOrdersCookiePayload();

	return payload.items;
}

export async function appendTrackedOrderToCookie(
	item: TrackedOrderCookieItem,
): Promise<TrackedOrderCookieItem[]> {
	if (!isValidTrackedOrderItem(item)) {
		return listTrackedOrdersFromCookie();
	}

	const payload = await readTrackedOrdersCookiePayload();
	const nextItems = normalizeTrackedOrderItems([item, ...payload.items]);

	await writeTrackedOrdersCookie({
		v: COOKIE_VERSION,
		items: nextItems,
		customer_profiles_by_slug: payload.customer_profiles_by_slug,
		access_codes: payload.access_codes,
	});

	return nextItems;
}

export async function persistCreatedOrderCustomerTracking({
	trackedOrder,
	slug,
	profile,
	customerAccessCode,
}: {
	trackedOrder?: TrackedOrderCookieItem;
	slug: string;
	profile: CustomerProfileCookieInput;
	customerAccessCode?: string;
}): Promise<TrackedOrderCookieItem[]> {
	const normalizedSlug = normalizeSlugKey(slug);
	const normalizedPhone = profile.phone.trim();
	const payload = await readTrackedOrdersCookiePayload();
	const nextItems =
		trackedOrder && isValidTrackedOrderItem(trackedOrder)
			? normalizeTrackedOrderItems([trackedOrder, ...payload.items])
			: payload.items;
	const nextProfilesMap = new Map(
		Object.entries(payload.customer_profiles_by_slug),
	);

	if (normalizedSlug && normalizedPhone) {
		nextProfilesMap.set(normalizedSlug, {
			phone: normalizedPhone,
			name: normalizeOptionalText(profile.name),
			address: normalizeOptionalText(profile.address),
			notes: normalizeOptionalText(profile.notes),
			updated_at: new Date().toISOString(),
		});
	}

	const nextAccessCodes = [...(payload.access_codes || [])];
	if (customerAccessCode && normalizedPhone) {
		nextAccessCodes.push({
			code: customerAccessCode.trim(),
			phone: normalizedPhone,
			last_used_at: new Date().toISOString(),
		});
	}

	await writeTrackedOrdersCookie({
		v: COOKIE_VERSION,
		items: nextItems,
		customer_profiles_by_slug: Object.fromEntries(nextProfilesMap),
		access_codes: normalizeSavedAccessCodes(nextAccessCodes),
	});

	return nextItems;
}

export async function getSavedAccessCodesFromCookie(): Promise<SavedAccessCodeCookieItem[]> {
	const payload = await readTrackedOrdersCookiePayload();
	return payload.access_codes || [];
}

/** Persists a credential only after the backend confirms the complete pair. */
export async function persistVerifiedAccessCodeInCookie(input: {
	code: string;
	phone: string;
}): Promise<void> {
	const code = input.code.trim();
	const phone = input.phone.trim();
	if (!code || !phone) return;

	const payload = await readTrackedOrdersCookiePayload();
	await writeTrackedOrdersCookie({
		...payload,
		access_codes: normalizeSavedAccessCodes([
			{
				code,
				phone,
				last_used_at: new Date().toISOString(),
			},
			...(payload.access_codes || []),
		]),
	});
}

export async function getCustomerProfileBySlugFromCookie(
	slug: string,
): Promise<CustomerProfileCookieItem | null> {
	const normalizedSlug = normalizeSlugKey(slug);
	if (!normalizedSlug) {
		return null;
	}

	const payload = await readTrackedOrdersCookiePayload();
	const customerProfilesBySlug = new Map(
		Object.entries(payload.customer_profiles_by_slug),
	);
	return customerProfilesBySlug.get(normalizedSlug) || null;
}

export async function upsertCustomerProfileBySlugInCookie(
	slug: string,
	profile: CustomerProfileCookieInput,
): Promise<void> {
	const normalizedSlug = normalizeSlugKey(slug);
	const normalizedPhone = profile.phone.trim();

	if (!normalizedSlug || !normalizedPhone) {
		return;
	}

	const payload = await readTrackedOrdersCookiePayload();
	const nextProfilesMap = new Map(
		Object.entries(payload.customer_profiles_by_slug),
	);
	nextProfilesMap.set(normalizedSlug, {
		phone: normalizedPhone,
		name: normalizeOptionalText(profile.name),
		address: normalizeOptionalText(profile.address),
		notes: normalizeOptionalText(profile.notes),
		updated_at: new Date().toISOString(),
	});

	await writeTrackedOrdersCookie({
		v: COOKIE_VERSION,
		items: payload.items,
		customer_profiles_by_slug: limitCustomerProfilesBySlug(
			Object.fromEntries(nextProfilesMap),
		),
		access_codes: payload.access_codes,
	});
}

export async function removeTrackedOrderFromCookie(
	token: string,
): Promise<TrackedOrderCookieItem[]> {
	const payload = await readTrackedOrdersCookiePayload();
	const nextItems = payload.items.filter(item => item.token !== token);

	await writeTrackedOrdersCookie({
		v: COOKIE_VERSION,
		items: nextItems,
		customer_profiles_by_slug: payload.customer_profiles_by_slug,
		access_codes: payload.access_codes,
	});

	return nextItems;
}

export async function clearTrackedOrdersCookie(): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.delete({
		name: STORAGE_KEYS.CUSTOMER_TRACKED_ORDERS,
		path: "/",
	});
}
