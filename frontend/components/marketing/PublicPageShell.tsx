import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { PublicFooter } from "@/components/layout/PublicFooter";

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

			<PublicFooter />
		</div>
	);
}
