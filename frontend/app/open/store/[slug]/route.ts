import { NextResponse } from "next/server";

const STOREFRONT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Props = {
  params: Promise<{ slug: string }>;
};

/** Converts the customer-only App Link path into the existing storefront route. */
export async function GET(request: Request, { params }: Props) {
  const { slug } = await params;
  if (!STOREFRONT_SLUG.test(slug)) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const storefrontUrl = new URL(`/${encodeURIComponent(slug)}`, requestUrl);
  storefrontUrl.search = requestUrl.search;

  return NextResponse.redirect(storefrontUrl, 307);
}
