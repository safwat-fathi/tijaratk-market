import { NextResponse } from "next/server";

const MANIFEST_HEADERS = {
  "Content-Type": "application/manifest+json; charset=utf-8",
} as const;

/** Returns the standalone administrator dashboard manifest. */
export function GET() {
  return NextResponse.json(
    {
      name: "تجارتك للإدارة",
      short_name: "إدارة تجارتك",
      description: "إدارة المتاجر والطلبات وعمليات منصة تجارتك.",
      id: "/pwa/admin",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#F9FAFB",
      theme_color: "#0F5A3D",
      dir: "rtl",
      lang: "ar-EG",
      icons: [
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
      ],
    },
    { headers: MANIFEST_HEADERS },
  );
}
