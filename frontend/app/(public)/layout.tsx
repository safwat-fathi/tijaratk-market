import { Logo } from "@/components/ui/Logo";

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
			<footer className="flex w-full items-center justify-center border-t border-brand-border bg-white">
				<div className="flex items-center justify mx-auto max-w-7xl px-4 py-6 sm:px-6 gap-2 lg:px-8">
					<Logo variant="icon" width={32} height={32} className="h-8 w-8 rounded-sm" />
					<div className="flex justify-center md:order-2 gap-4 ml-4">
						<a href="https://www.facebook.com/profile.php?id=61589320905109" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20">
							<span className="sr-only">فيسبوك</span>
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
						</a>
						<a href="https://wa.me/201037007345" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20">
							<span className="sr-only">واتساب</span>
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9"></path><path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"></path></svg>
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
