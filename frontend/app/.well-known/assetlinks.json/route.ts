import { NextResponse } from "next/server";

const CUSTOMER_PACKAGE_ID = "com.tijaratk.customer";
const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

const getCertificateFingerprints = () =>
  (process.env.ANDROID_CUSTOMER_CERT_SHA256_FINGERPRINTS || "")
    .split(",")
    .map((fingerprint) => fingerprint.trim().toUpperCase())
    .filter((fingerprint) => SHA256_FINGERPRINT.test(fingerprint));

/** Publishes the Android Digital Asset Links association for the customer TWA. */
export function GET() {
  const fingerprints = getCertificateFingerprints();
  const statements = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: CUSTOMER_PACKAGE_ID,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];

  return NextResponse.json(statements, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=300",
    },
  });
}
