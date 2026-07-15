import { createHmac } from "node:crypto";
import { headers } from "next/headers";

const META_CONTEXT_HEADER = "x-tijaratk-meta-context";
const META_CONTEXT_SIGNATURE_HEADER =
  "x-tijaratk-meta-context-signature";

const firstForwardedIp = (value: string | null) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .find(Boolean);

export const buildMetaRequestContextHeaders = async (): Promise<HeadersInit> => {
  const signingSecret = process.env.META_CONTEXT_SIGNING_SECRET?.trim();
  if (!signingSecret) return {};

  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("cf-connecting-ip")?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    firstForwardedIp(requestHeaders.get("x-forwarded-for"));
  const userAgent = requestHeaders.get("user-agent")?.trim().slice(0, 512);
  const encodedContext = Buffer.from(
    JSON.stringify({
      ...(ip ? { ip } : {}),
      ...(userAgent ? { userAgent } : {}),
      timestamp: Date.now(),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", signingSecret)
    .update(encodedContext)
    .digest("base64url");

  return {
    [META_CONTEXT_HEADER]: encodedContext,
    [META_CONTEXT_SIGNATURE_HEADER]: signature,
  };
};

