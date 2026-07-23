import { NextResponse } from "next/server";
import { zoneStorefrontsService } from "@/services/api/zone-storefronts.service";
import { isZoneStorefrontEnabled } from "@/lib/zone-storefront-feature";

type Props = {
  params: Promise<{ slug: string }>;
};

const DEFAULT_ICONS = [
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

export async function GET(_request: Request, { params }: Props) {
  if (!isZoneStorefrontEnabled()) {
    return NextResponse.json(
      { error: "Zone storefront not found" },
      { status: 404 },
    );
  }

  const { slug } = await params;
  const response = await zoneStorefrontsService.getPublicZone(slug);

  if (!response.success || !response.data) {
    return NextResponse.json(
      { error: "Zone storefront not found" },
      { status: 404 },
    );
  }

  const zone = response.data;

  return NextResponse.json(
    {
      name: zone.name,
      short_name: zone.name.slice(0, 24),
      description: `اطلب احتياجاتك من ${zone.area.name_ar} عبر ${zone.name}.`,
      id: `/pwa/zone-storefront/${zone.slug}`,
      start_url: `/market/${zone.slug}?src=pwa-zone`,
      scope: "/",
      display: "standalone",
      background_color: "#F7F8F6",
      theme_color: "#0F5A3D",
      dir: "rtl",
      lang: "ar-EG",
      icons: DEFAULT_ICONS,
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
      },
    },
  );
}
