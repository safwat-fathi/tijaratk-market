import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { STORAGE_KEYS } from "@/constants";

const SUPPORTED_SOURCES = new Set(["talabat_csv", "chefaa_csv"]);

export async function GET(request: Request) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    return NextResponse.json(
      { success: false, message: "API base URL is not configured" },
      { status: 500 },
    );
  }

  const source = new URL(request.url).searchParams.get("source") || "";
  if (!SUPPORTED_SOURCES.has(source)) {
    return NextResponse.json(
      { success: false, message: "Unsupported catalog source" },
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
  backendUrl.searchParams.set("source", source);

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
        `attachment; filename="catalog-${source}.csv"`,
    },
  });
}
