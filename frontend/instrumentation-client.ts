// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { runAfterLoadAndIdle } from "@/lib/browser/run-after-load-and-idle";
import { sentryTracesSampler } from "@/lib/monitoring/sentry-sampling";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",

  tracesSampler: sentryTracesSampler,
  enableLogs: process.env.NODE_ENV !== "production",

  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.01 : 0,
  replaysOnErrorSampleRate: 1,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

if (typeof window !== "undefined") {
  runAfterLoadAndIdle(() => {
    void import("@/lib/monitoring/deferred-replay")
      .then(({ initializeDeferredReplay }) => initializeDeferredReplay())
      .catch(() => undefined);
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
