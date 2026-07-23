const PRIORITY_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/merchant\/?$/,
  /^\/merchant\/login\/?$/,
  /^\/admin\/login\/?$/,
  /^\/admin\/merchants(?:\/|$)/,
  /^\/admin\/catalog-items\/?$/,
] as const;

const DEFAULT_PRODUCTION_TRACE_SAMPLE_RATE = 0.05;
const PRIORITY_PRODUCTION_TRACE_SAMPLE_RATE = 0.25;

type SentrySamplingContext = {
  name: string;
  location?: { pathname?: string };
  normalizedRequest?: { url?: string };
  inheritOrSampleWith: (fallbackSampleRate: number) => number;
};

const extractPathname = (context: SentrySamplingContext) => {
  if (context.location?.pathname) return context.location.pathname;

  const requestUrl = context.normalizedRequest?.url;
  if (requestUrl) {
    try {
      return new URL(requestUrl, "https://tijaratk.local").pathname;
    } catch {
      return requestUrl.split("?")[0] || "/";
    }
  }

  const pathMatch = context.name.match(/\/[^\s?]*/);
  return pathMatch?.[0] || "/";
};

export const sentryTracesSampler = (context: SentrySamplingContext) => {
  if (process.env.NODE_ENV !== "production") return 1;

  const pathname = extractPathname(context);
  const sampleRate = PRIORITY_ROUTE_PATTERNS.some((pattern) =>
    pattern.test(pathname),
  )
    ? PRIORITY_PRODUCTION_TRACE_SAMPLE_RATE
    : DEFAULT_PRODUCTION_TRACE_SAMPLE_RATE;

  return context.inheritOrSampleWith(sampleRate);
};
