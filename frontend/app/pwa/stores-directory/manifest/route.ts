import { NextResponse } from "next/server";
import { SITE_DESCRIPTION } from "@/lib/marketing-seo";

export function GET() {
  return NextResponse.json(
    {
      name: "تجارتك - دليل المتاجر",
      short_name: "دليل تجارتك",
      description: SITE_DESCRIPTION,
      id: "/pwa/stores-directory",
      start_url: "/?src=pwa-directory",
      scope: "/",
      display: "standalone",
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
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
      },
    },
  );
}
