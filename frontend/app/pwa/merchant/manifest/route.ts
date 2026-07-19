import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/constants";
import type { Tenant } from "@/types/models/tenant";

const GENERIC_APP_NAME = "تجارتك للتاجر";
const MANIFEST_HEADERS = {
  "Content-Type": "application/manifest+json; charset=utf-8",
} as const;

type ApiTenantResponse = {
  success?: boolean;
  data?: Tenant;
};

const fallbackIcons = [
  {
    src: "/android-chrome-192x192.png",
    sizes: "192x192",
    type: "image/png",
  },
  {
    src: "/android-chrome-512x512.png",
    sizes: "512x512",
    type: "image/png",
  },
] as const;

const getManifestIcons = (logoUrl?: string | null) => {
  if (!logoUrl) return fallbackIcons;

  return [
    {
      src: logoUrl,
      sizes: "any",
      type: "image/png",
    },
    ...fallbackIcons,
  ];
};

const buildManifest = (tenant?: Tenant) => {
  const storeName = tenant?.directory_profile?.display_name || tenant?.name;
  const appName = storeName ? `${storeName} - لوحة التاجر` : GENERIC_APP_NAME;

  return {
    name: appName,
    short_name: storeName || GENERIC_APP_NAME,
    description: "تابع طلبات ومنتجات وعملاء متجرك من لوحة تجارتك.",
    id: tenant?.slug ? `/pwa/merchant/${tenant.slug}` : "/pwa/merchant",
    start_url: "/merchant?src=pwa-merchant",
    scope: "/merchant",
    display: "standalone",
    launch_handler: { client_mode: "navigate-existing" },
    background_color: "#F7F8F6",
    theme_color: "#0F5A3D",
    dir: "rtl",
    lang: "ar-EG",
    icons: getManifestIcons(tenant?.directory_profile?.logo_url),
  };
};

async function getTenantForManifest(): Promise<Tenant | undefined> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(STORAGE_KEYS.ACCESS_TOKEN)?.value;

  if (!apiBaseUrl || !accessToken) {
    return undefined;
  }

  try {
    const cookiesString = cookieStore.toString();
    const response = await fetch(`${apiBaseUrl}/tenants/me`, {
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken.replace(/['"]+/g, "")}`,
        ...(cookiesString ? { Cookie: cookiesString } : {}),
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as ApiTenantResponse;
    return payload.success && payload.data ? payload.data : undefined;
  } catch {
    return undefined;
  }
}

export async function GET() {
  const tenant = await getTenantForManifest();

  return NextResponse.json(buildManifest(tenant), {
    headers: MANIFEST_HEADERS,
  });
}
