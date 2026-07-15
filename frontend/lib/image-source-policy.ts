export type ImageRemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
};

const STATIC_REMOTE_IMAGE_PATTERNS: ImageRemotePattern[] = [
  {
    protocol: "https",
    hostname: "tijaratk.com",
  },
  {
    protocol: "https",
    hostname: "cdn.mafrservices.com",
  },
  {
    protocol: "https",
    hostname: "cdn.chefaa.com",
  },
  {
    protocol: "https",
    hostname: "talabat.dhmedia.io",
    pathname: "/image/**",
  },
  {
    protocol: "https",
    hostname: "images.deliveryhero.io",
    pathname: "/image/**",
  },
  {
    protocol: "http",
    hostname: "localhost",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
  },
];

const LOCAL_IMAGE_HOSTS = new Set(["localhost", "127.0.0.1"]);

const parseApiImagePattern = (
  apiBaseUrl?: string | null,
): ImageRemotePattern | null => {
  const normalizedBaseUrl = apiBaseUrl?.trim();
  if (!normalizedBaseUrl) return null;

  try {
    const parsed = new URL(normalizedBaseUrl);
    const protocol = parsed.protocol.replace(/:$/, "");
    const isAllowedProtocol =
      protocol === "https" ||
      (protocol === "http" && LOCAL_IMAGE_HOSTS.has(parsed.hostname));

    if (!isAllowedProtocol) return null;

    return {
      protocol,
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
    } as ImageRemotePattern;
  } catch {
    return null;
  }
};

/**
 * Returns the remote image patterns shared by Next configuration and runtime
 * rendering guards.
 */
export const getRemoteImagePatterns = (
  apiBaseUrl?: string | null,
): ImageRemotePattern[] => {
  const apiPattern = parseApiImagePattern(apiBaseUrl);
  if (!apiPattern) return [...STATIC_REMOTE_IMAGE_PATTERNS];

  const alreadyConfigured = STATIC_REMOTE_IMAGE_PATTERNS.some(
    (pattern) =>
      pattern.protocol === apiPattern.protocol &&
      pattern.hostname === apiPattern.hostname &&
      (pattern.port || "") === (apiPattern.port || ""),
  );

  return alreadyConfigured
    ? [...STATIC_REMOTE_IMAGE_PATTERNS]
    : [...STATIC_REMOTE_IMAGE_PATTERNS, apiPattern];
};

const matchesPathname = (pathname: string, pattern?: string): boolean => {
  if (!pattern) return true;
  if (pattern.endsWith("/**")) {
    return pathname.startsWith(pattern.slice(0, -2));
  }

  return pathname === pattern;
};

const matchesRemotePattern = (
  url: URL,
  pattern: ImageRemotePattern,
): boolean =>
  url.protocol === `${pattern.protocol}:` &&
  url.hostname === pattern.hostname &&
  (!pattern.port || url.port === pattern.port) &&
  matchesPathname(url.pathname, pattern.pathname);

/**
 * Checks whether a string can be passed to next/image without triggering its
 * render-time remote-host validation.
 */
export const isAllowedImageSource = (
  source?: string | null,
  apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL,
): boolean => {
  const normalizedSource = source?.trim();
  if (!normalizedSource) return false;

  if (normalizedSource.startsWith("/") && !normalizedSource.startsWith("//")) {
    return true;
  }

  if (
    normalizedSource.startsWith("data:image/") ||
    normalizedSource.startsWith("blob:")
  ) {
    return true;
  }

  try {
    const parsed = new URL(normalizedSource);
    return getRemoteImagePatterns(apiBaseUrl).some((pattern) =>
      matchesRemotePattern(parsed, pattern),
    );
  } catch {
    return false;
  }
};

/**
 * Some approved sources must bypass the Next optimizer while still being safe
 * to render directly in the browser.
 */
export const shouldBypassImageOptimization = (source: string): boolean => {
  if (source.startsWith("data:image/") || source.startsWith("blob:")) {
    return true;
  }

  try {
    const parsed = new URL(source);
    return (
      parsed.hostname === "cdn.mafrservices.com" ||
      LOCAL_IMAGE_HOSTS.has(parsed.hostname)
    );
  } catch {
    return false;
  }
};
