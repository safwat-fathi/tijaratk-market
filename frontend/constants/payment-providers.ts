export type PaymentProviderLogo = {
  label: string;
  labelAr: string;
  logoSrc: string | null;
};

export const INSTAPAY_PROVIDER: PaymentProviderLogo = {
  label: "InstaPay",
  labelAr: "إنستاباي",
  logoSrc: "/payment-providers/InstaPay.webp",
};
