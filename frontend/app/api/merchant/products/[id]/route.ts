import { proxyProductMultipartRequest } from "../product-upload-proxy";

export const runtime = "nodejs";

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;

  return proxyProductMultipartRequest({
    request,
    route: `products/${encodeURIComponent(id)}`,
    method: "PATCH",
  });
};
