import { NextResponse } from "next/server";
import { CUSTOMER_PWA } from "@/lib/customer-pwa";

const MANIFEST_HEADERS = {
  "Content-Type": "application/manifest+json; charset=utf-8",
} as const;

export function GET() {
  return NextResponse.json(
    {
      name: CUSTOMER_PWA.name,
      short_name: CUSTOMER_PWA.name,
      description: "اطلب احتياجاتك من المتاجر المحلية عبر تجارتك.",
      id: CUSTOMER_PWA.id,
      start_url: CUSTOMER_PWA.startUrl,
      scope: "/",
      display: "standalone",
      launch_handler: { client_mode: "navigate-existing" },
      background_color: "#F7F8F6",
      theme_color: "#0F5A3D",
      dir: "rtl",
      lang: "ar-EG",
      icons: [
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
      ],
    },
    { headers: MANIFEST_HEADERS },
  );
}
