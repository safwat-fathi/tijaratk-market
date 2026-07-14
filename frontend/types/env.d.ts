declare module "bun" {
	
		interface Env {
			NODE_ENV: "development" | "production";
			NEXT_PUBLIC_API_BASE_URL: string;
			NEXT_PUBLIC_APP_BASE_URL: string;
			NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
			NEXT_PUBLIC_API_GOLD_PRICE: string;
			NEXT_PUBLIC_GOLD_API_TOKEN: string;
			NEXT_PUBLIC_ACCESS_TOKEN: string;
			NEXT_PUBLIC_REFRESH_TOKEN: string;
			NEXT_PUBLIC_CSRF_COOKIE_NAME: string;
			NEXT_PUBLIC_SENTRY_DSN: string;
			SESSION_SECRET: string;
			CSRF_SECRET: string;
		}
	
}

declare namespace NodeJS {
	interface ProcessEnv {
		readonly NEXT_PUBLIC_GA_MEASUREMENT_ID?: string;
	}
}
