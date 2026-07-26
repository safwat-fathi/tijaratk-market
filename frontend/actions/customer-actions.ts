"use server";

import { isNextRedirectError } from "@/lib/auth/navigation-errors";
import {
  customersService,
  type PublicCustomerProfile,
} from "@/services/api/customers.service";
import { persistVerifiedAccessCodeInCookie } from "@/lib/tracking/customer-tracking-cookie";
import { Customer } from "@/types/models/customer";

type CustomersPageMeta = {
  total: number;
  page: number;
  last_page: number;
  limit: number;
  has_next: boolean;
};

type CustomersPageActionResult = {
  success: boolean;
  message?: string;
  data: Customer[];
  meta: CustomersPageMeta;
};

type CustomerDetailsActionResult = {
  success: boolean;
  message?: string;
  data?: Customer;
};

type PublicCustomerProfileActionResult = {
  success: boolean;
  message?: string;
  data?: PublicCustomerProfile | null;
};

type PublicCustomerOrdersActionResult = {
  success: boolean;
  message?: string;
  data?: Awaited<ReturnType<typeof customersService.getPublicOrdersByAccessCode>>["data"];
};

const DEFAULT_LIMIT = 20;

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

const buildFallbackMeta = (
  page: number,
  limit: number,
  total = 0,
): CustomersPageMeta => ({
  total,
  page,
  last_page: total > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
  limit,
  has_next: false,
});

const normalizePublicCustomerProfile = (
  profile: PublicCustomerProfile,
): PublicCustomerProfile => {
  const addresses = Array.from(
    new Set(
      profile.addresses
        .map((address) => (typeof address === "string" ? address.trim() : ""))
        .filter(Boolean),
    ),
  );

  return {
    ...profile,
    addresses,
  };
};

export async function getCustomersPageAction(input?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<CustomersPageActionResult> {
  const search = input?.search?.trim() || undefined;
  const page = normalizePositiveInteger(input?.page, 1);
  const limit = normalizePositiveInteger(input?.limit, DEFAULT_LIMIT);

  try {
    const response = await customersService.getCustomers({
      search,
      page,
      limit,
    });
    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر تحميل العملاء",
        data: [],
        meta: buildFallbackMeta(page, limit),
      };
    }

    const customers = Array.isArray(response.data.data)
      ? response.data.data
      : [];
    const total = normalizePositiveInteger(response.data.meta?.total, 0);
    const currentPage = normalizePositiveInteger(
      response.data.meta?.page,
      page,
    );
    const lastPage = normalizePositiveInteger(
      response.data.meta?.last_page,
      total > 0 ? Math.ceil(total / limit) : 1,
    );

    return {
      success: true,
      data: customers,
      meta: {
        total,
        page: currentPage,
        last_page: lastPage,
        limit,
        has_next: currentPage < lastPage,
      },
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : "تعذر تحميل العملاء",
      data: [],
      meta: buildFallbackMeta(page, limit),
    };
  }
}

export async function getCustomerDetailsAction(
  customerId: number,
): Promise<CustomerDetailsActionResult> {
  const normalizedId = normalizePositiveInteger(customerId, 0);
  if (normalizedId <= 0) {
    return {
      success: false,
      message: "رقم العميل غير صالح",
    };
  }

  try {
    const response = await customersService.getCustomer(normalizedId);
    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر تحميل بيانات العميل",
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "تعذر تحميل بيانات العميل",
    };
  }
}

export async function getPublicCustomerByPhoneAction(input: {
  slug: string;
  phone: string;
}): Promise<PublicCustomerProfileActionResult> {
  const slug = input.slug.trim();
  const phone = input.phone.trim();

  if (!slug || !phone) {
    return {
      success: false,
      message: "بيانات البحث غير مكتملة",
    };
  }

  try {
    const response = await customersService.getPublicCustomerByPhone(
      slug,
      phone,
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر تحميل بيانات العميل",
      };
    }

    return {
      success: true,
      data: response.data
        ? normalizePublicCustomerProfile(response.data)
        : null,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "تعذر تحميل بيانات العميل",
    };
  }
}

export async function getPublicCustomerByAccessCodeAction(input: {
  code: string;
  phone: string;
}): Promise<PublicCustomerProfileActionResult> {
  const code = input.code.trim();
  const phone = input.phone.trim();

  if (!code || !phone) {
    return {
      success: false,
      message: "اكتب كود العميل ورقم الهاتف",
    };
  }

  try {
    const response = await customersService.getPublicCustomerByAccessCode({
      code,
      phone,
    });
    if (!response.success) {
      return {
        success: false,
        message: response.message || "تعذر تحميل بيانات العميل",
      };
    }

    if (response.data) {
      await persistVerifiedAccessCodeInCookie({ code, phone });
    }

    return {
      success: true,
      data: response.data
        ? normalizePublicCustomerProfile(response.data)
        : null,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "تعذر تحميل بيانات العميل",
    };
  }
}

export async function getPublicOrdersByAccessCodeAction(input: {
  code: string;
  phone: string;
}): Promise<PublicCustomerOrdersActionResult> {
  const code = input.code.trim();
  const phone = input.phone.trim();

  if (!code || !phone) {
    return {
      success: false,
      message: "اكتب كود العميل ورقم الهاتف",
      data: [],
    };
  }

  try {
    const response = await customersService.getPublicOrdersByAccessCode({
      code,
      phone,
    });
    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || "تعذر تحميل الطلبات",
        data: [],
      };
    }

    if (response.data.length > 0) {
      await persistVerifiedAccessCodeInCookie({ code, phone });
    } else {
      const profileResponse =
        await customersService.getPublicCustomerByAccessCode({ code, phone });
      if (profileResponse.success && profileResponse.data) {
        await persistVerifiedAccessCodeInCookie({ code, phone });
      }
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : "تعذر تحميل الطلبات",
      data: [],
    };
  }
}
