import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { STORAGE_KEYS } from "@/constants";

export async function GET() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBaseUrl) {
    return NextResponse.json(
      { success: false, message: "API base URL is not configured" },
      { status: 500 },
    );
  }

  const accessToken = (await cookies()).get(
    STORAGE_KEYS.ACCESS_TOKEN,
  )?.value;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const backendUrl = `${apiBaseUrl.replace(/\/$/, "")}/products/import-template`;

  const response = await fetch(backendUrl, {
    headers: {
      Authorization: `Bearer ${accessToken.replace(/['"]+/g, "")}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch template" },
      { status: response.status },
    );
  }

  const body = await response.arrayBuffer();
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "text/csv; charset=utf-8",
      "Content-Disposition":
        response.headers.get("content-disposition") ||
        `attachment; filename="product-import-template.csv"`,
    },
  });
}
