import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

type PublicPageShellProps = {
	eyebrow: string;
	title: string;
	description: string;
	children: React.ReactNode;
};

export default function PublicPageShell({
	eyebrow,
	title,
	description,
	children,
}: PublicPageShellProps) {
	return (
		<div className="min-h-screen bg-[#F7F8F6]" dir="rtl">
			<header className="border-b border-brand-border bg-white">
				<div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
					<Link href="/" className="flex items-center gap-2">
						<Logo variant="icon" width={32} height={32} className="rounded-md" />
						<span className="text-xl font-bold text-brand-primary">تجارتك</span>
					</Link>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
				<section className="rounded-3xl border border-brand-border bg-white p-6 shadow-soft sm:p-8">
					<p className="text-sm font-bold text-brand-accent">{eyebrow}</p>
					<h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-brand-text sm:text-5xl">
						{title}
					</h1>
					<p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
						{description}
					</p>
				</section>

				<div className="mt-8 space-y-8">{children}</div>
			</main>

			<footer className="border-t border-brand-border bg-white px-4 py-8">
				<div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
					<p>© {new Date().getFullYear()} تجارتك. منصة لإدارة الطلبات بدون عمولة.</p>
					<div className="flex items-center gap-4">
						<a href="https://www.facebook.com/profile.php?id=61589320905109" target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary transition-colors">
							<span className="sr-only">فيسبوك</span>
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
						</a>
						<a href="https://wa.me/201037007345" target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary transition-colors">
							<span className="sr-only">واتساب</span>
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9"></path><path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"></path></svg>
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
