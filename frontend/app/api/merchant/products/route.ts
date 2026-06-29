import { proxyProductMultipartRequest } from "./product-upload-proxy";

export const runtime = "nodejs";

export const POST = (request: Request) =>
  proxyProductMultipartRequest({
    request,
    route: "products",
    method: "POST",
  });
