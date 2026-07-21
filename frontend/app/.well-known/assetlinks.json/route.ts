import { NextResponse } from "next/server";

const CUSTOMER_PACKAGE_ID = "com.tijaratk.customer";
const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

const getCertificateFingerprints = (envVar: string | undefined) =>
  (envVar || "")
    .split(",")
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter((fingerprint) => SHA256_FINGERPRINT.test(fingerprint));

/** Publishes the Android Digital Asset Links association for the TWA apps. */
export function GET() {
  const customerFingerprints = getCertificateFingerprints(process.env.ANDROID_CUSTOMER_CERT_SHA256_FINGERPRINTS);
  const merchantFingerprints = getCertificateFingerprints(process.env.ANDROID_MERCHANT_CERT_SHA256_FINGERPRINTS);
  
  const statements: any[] = [];

  if (customerFingerprints.length > 0) {
    statements.push({
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: CUSTOMER_PACKAGE_ID,
        sha256_cert_fingerprints: customerFingerprints,
      },
    });
  }

  if (merchantFingerprints.length > 0) {
    statements.push({
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.use_as_origin"
      ],
      target: {
        namespace: "android_app",
        package_name: "com.tijaratk.merchant",
        sha256_cert_fingerprints: merchantFingerprints,
      },
    });
  }

  return NextResponse.json(statements, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
}
