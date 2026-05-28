import { Logo } from "@/components/ui/Logo";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
	return (
		<>
			<div className="flex min-h-screen flex-col bg-background px-4 pb-8 sm:px-6 lg:px-8 overflow-x-hidden">
				<div className="mx-auto w-full max-w-3xl space-y-8">{children}</div>
			</div>
			<footer className="flex w-full items-center justify-center border-t border-brand-border bg-white">
				<div className="flex items-center justify mx-auto max-w-7xl px-4 py-6 sm:px-6 gap-2 lg:px-8">
					<Logo variant="icon" width={32} height={32} className="h-8 w-8 rounded-sm" />
					<div className="flex justify-center md:order-2">
						<a href="#" className="text-muted-foreground hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20">
							<span className="sr-only">فيسبوك</span>
							{/* SVG Icon */}
						</a>
					</div>

					<p className="text-center text-xs leading-5 text-muted-foreground">
						&copy; {new Date().getFullYear()} تجارتك. جميع الحقوق محفوظة.
					</p>
				</div>
			</footer>
		</>
	);
}
