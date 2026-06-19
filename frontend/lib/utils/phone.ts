const E164_MAX_LENGTH = 15;
const MIN_WHATSAPP_PHONE_LENGTH = 11;
const EGYPT_LOCAL_MOBILE_PHONE_PATTERN = /^01\d{9}$/;
const EGYPT_E164_MOBILE_PHONE_PATTERN = /^\+201\d{9}$/;
const EGYPT_COUNTRY_CODE_MOBILE_PHONE_PATTERN = /^201\d{9}$/;

export const isValidEgyptianCustomerPhone = (rawPhone: string): boolean => {
	const phone = rawPhone.trim();

	return (
		EGYPT_LOCAL_MOBILE_PHONE_PATTERN.test(phone) ||
		EGYPT_E164_MOBILE_PHONE_PATTERN.test(phone) ||
		EGYPT_COUNTRY_CODE_MOBILE_PHONE_PATTERN.test(phone)
	);
};

export const normalizePhoneForWhatsApp = (
	rawPhone: string,
	defaultCountryCode = "20",
): string | null => {
	if (!rawPhone || !defaultCountryCode) {
		return null;
	}

	let digits = rawPhone.replace(/\D/g, "");
	if (!digits) {
		return null;
	}

	if (digits.startsWith("00")) {
		digits = digits.slice(2);
	}

	if (digits.startsWith(`0${defaultCountryCode}`)) {
		digits = digits.slice(1);
	}

	let normalized: string;
	if (digits.startsWith(defaultCountryCode)) {
		normalized = digits;
	} else if (digits.startsWith("0")) {
		normalized = `${defaultCountryCode}${digits.slice(1)}`;
	} else {
		normalized = `${defaultCountryCode}${digits}`;
	}

	if (
		normalized.length < MIN_WHATSAPP_PHONE_LENGTH ||
		normalized.length > E164_MAX_LENGTH
	) {
		return null;
	}

	return normalized;
};

export const buildWhatsAppLink = (rawPhone: string): string | null => {
	const normalizedPhone = normalizePhoneForWhatsApp(rawPhone);
	if (!normalizedPhone) {
		return null;
	}

	return `https://wa.me/${normalizedPhone}`;
};
