import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { STORAGE_KEYS } from "@/constants";

const SUPPORTED_SOURCES = new Set(["talabat_csv", "chefaa_csv"]);
const CATALOG_TYPE_TO_SOURCE = {
  grocery: "talabat_csv",
  pharmacy: "chefaa_csv",
} as const;
type CatalogType = keyof typeof CATALOG_TYPE_TO_SOURCE;

const isCatalogType = (value: string): value is CatalogType =>
  value in CATALOG_TYPE_TO_SOURCE;

export async function GET(request: Request) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    return NextResponse.json(
      { success: false, message: "API base URL is not configured" },
      { status: 500 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const catalogType = searchParams.get("catalogType") || "";
  const legacySource = searchParams.get("source") || "";
  const hasCatalogType = isCatalogType(catalogType);
  const source = hasCatalogType
    ? CATALOG_TYPE_TO_SOURCE[catalogType]
    : legacySource;

  if (!SUPPORTED_SOURCES.has(source)) {
    return NextResponse.json(
      { success: false, message: "Unsupported catalog type" },
      { status: 400 },
    );
  }

  const accessToken = (await cookies()).get(
    STORAGE_KEYS.ADMIN_ACCESS_TOKEN,
  )?.value;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const backendUrl = new URL(
    `${apiBaseUrl.replace(/\/$/, "")}/admin/catalog-items/export`,
  );
  if (hasCatalogType) {
    backendUrl.searchParams.set("catalogType", catalogType);
  } else {
    backendUrl.searchParams.set("source", source);
  }

  const response = await fetch(backendUrl, {
    headers: {
      Authorization: `Bearer ${accessToken.replace(/['"]+/g, "")}`,
    },
    cache: "no-store",
  });

  const body = await response.arrayBuffer();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "text/csv; charset=utf-8",
      "Content-Disposition":
        response.headers.get("content-disposition") ||
        `attachment; filename="${source === "talabat_csv" ? "grocery-items" : source === "chefaa_csv" ? "pharmacy-items" : "catalog-items"}.csv"`,
    },
  });
}
