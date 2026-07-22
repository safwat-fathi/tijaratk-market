import type { Metadata } from "next";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CUSTOMER_PWA_METADATA } from "@/lib/customer-pwa";

export const metadata: Metadata = CUSTOMER_PWA_METADATA;

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
	return (
		<>
			<div className="flex min-h-screen flex-col bg-background px-4 pb-8 sm:px-6 lg:px-8">
				<div className="mx-auto w-full max-w-3xl space-y-8">{children}</div>
			</div>
			<PublicFooter />
		</>
	);
}
