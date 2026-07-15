declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production";
      NEXT_PUBLIC_API_BASE_URL: string;
      NEXT_PUBLIC_APP_BASE_URL: string;
      NEXT_PUBLIC_SENTRY_DSN: string;
      NEXT_PUBLIC_META_PIXEL_ID?: string;
      META_CONTEXT_SIGNING_SECRET?: string;
    }
  }
}

export {};
