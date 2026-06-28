declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production';
      HTTP_SERVER_PORT: number;
      DB_URL: string;
      APP_URL: string;
      JWT_SECRET: string;
      CSRF_SECRET: string;
      CLIENT_URL: string;
      ACCOUNT_SID: string;
      AUTH_TOKEN: string;
      WHATSAPP_PHONE_NUMBER: string;
      WHATSAPP_NOTIFICATIONS_ENABLED: boolean;
      TWILIO_CONTENT_SID_NEW_ORDER_MERCHANT: string;
      TWILIO_CONTENT_SID_ORDER_RECEIVED_CUSTOMER: string;
      TWILIO_CONTENT_SID_ORDER_OUT_FOR_DELIVERY: string;
      TWILIO_CONTENT_SID_ORDER_STATUS_UPDATE_CUSTOMER: string;
      TWILIO_CONTENT_SID_MERCHANT_DAY_CLOSURE_SUMMARY: string;
      TWILIO_VERIFY_SERVICE_SID: string;
      SEED_SUPERMARKET_OWNER_CREDENTIAL: string;
    }
  }
}

export {};
