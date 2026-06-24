import { NextResponse } from "next/server";
import { tenantsService } from "@/services/api/tenants.service";

type Props = {
  params: Promise<{ slug: string }>;
};

const getStoreManifestIcon = (logoUrl?: string | null) => {
  if (logoUrl) {
    return [
      {
        src: logoUrl,
        sizes: "any",
        type: "image/png",
      },
    ];
  }

  return [
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
  ];
};

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const response = await tenantsService.getPublicTenant(slug);

  if (!response.success || !response.data) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const tenant = response.data;
  const displayName = tenant.directory_profile?.display_name || tenant.name;

  return NextResponse.json(
    {
      name: displayName,
      short_name: displayName.slice(0, 24),
      description: `اطلب من ${displayName} عبر تجارتك.`,
      id: `/pwa/storefront/${tenant.slug}`,
      start_url: `/${tenant.slug}?src=pwa`,
      scope: "/",
      display: "standalone",
      background_color: "#F7F8F6",
      theme_color: "#0F5A3D",
      dir: "rtl",
      lang: "ar-EG",
      icons: getStoreManifestIcon(tenant.directory_profile?.logo_url),
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
      },
    },
  );
}
