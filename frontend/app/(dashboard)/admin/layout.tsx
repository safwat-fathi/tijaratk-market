"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { adminLogoutAction } from "@/actions/admin-server";

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const [sidebarOpen, setSidebarOpen] = useState(false);

	if (pathname === "/admin/login") {
		return <div className="min-h-screen bg-gray-50">{children}</div>;
	}

	const navItems = [
		{ label: "لوحة التحكم", href: "/admin" },
		{ label: "التجار", href: "/admin/merchants" },
		{ label: "الباقات", href: "/admin/plans" },
		{ label: "الاستيراد", href: "/admin/imports" },
	];

	return (
		<div className="min-h-screen bg-gray-50" dir="rtl">
			{/* Mobile sidebar placeholder/trigger */}
			<div className="fixed inset-x-0 top-0 z-40 flex items-center gap-x-6 border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6 md:hidden">
				<button
					type="button"
					className="-m-2.5 rounded-md p-2.5 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:hidden"
					onClick={() => setSidebarOpen(true)}
				>
					<span className="sr-only">فتح القائمة</span>
					<svg
						className="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth="2.5"
						stroke="currentColor"
						aria-hidden="true"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
						/>
					</svg>
				</button>
				<div className="flex-1 text-sm font-semibold leading-6 text-gray-900">
					لوحة تحكم الإدارة
				</div>
				<Logo variant="icon" width={32} height={32} className="h-8 w-8" />
			</div>

			{/* Static sidebar for desktop */}
			<div className="hidden md:fixed md:inset-y-0 md:z-50 md:flex md:w-64 md:flex-col md:start-0">
				<aside className="flex grow flex-col overflow-y-auto border-e border-gray-200 bg-white min-h-screen">
					<div className="h-16 flex justify-center items-center px-6 border-b border-gray-200 shrink-0">
						<span className="font-bold text-brand-accent">مسئولى تجارتك</span>
					</div>
					<nav className="p-4 space-y-1">
						{navItems.map((item) => {
							const isActive = pathname === item.href;
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
										isActive
											? "bg-red-50 text-red-700"
											: "text-gray-900 hover:bg-gray-50"
									}`}
								>
									{item.label}
								</Link>
							);
						})}
					</nav>
					<div className="py-4 flex flex-col gap-4 justify-center items-center border-t border-gray-200 mt-auto shrink-0">
						<form action={adminLogoutAction} className="w-full px-4">
							<Button
								type="submit"
								variant="outline"
								className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
							>
								تسجيل خروج
							</Button>
						</form>
						<Logo />
					</div>
				</aside>
			</div>

			{/* Mobile Sidebar Overlay */}
			{sidebarOpen && (
				<div className="relative z-50 md:hidden" role="dialog" aria-modal="true">
					<div
						className="fixed inset-0 bg-gray-900/80"
						onClick={() => setSidebarOpen(false)}
					></div>
					<div className="fixed inset-0 flex">
						<div className="relative me-16 flex w-full max-w-xs flex-1">
							<div className="absolute start-full top-0 flex w-16 justify-center pt-5">
								<button
									type="button"
									className="-m-2.5 rounded-md p-2.5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
									onClick={() => setSidebarOpen(false)}
								>
									<span className="sr-only">إغلاق القائمة</span>
									<svg
										className="h-6 w-6"
										fill="none"
										viewBox="0 0 24 24"
										strokeWidth="2.5"
										stroke="currentColor"
										aria-hidden="true"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
							<div className="flex grow flex-col overflow-y-auto bg-white min-h-screen">
								<div className="h-16 flex justify-center items-center px-6 border-b border-gray-200 shrink-0">
									<span className="font-bold text-brand-accent">مسئولى تجارتك</span>
								</div>
								<nav className="p-4 space-y-1">
									{navItems.map((item) => {
										const isActive = pathname === item.href;
										return (
											<Link
												key={item.href}
												href={item.href}
												onClick={() => setSidebarOpen(false)}
												className={`flex items-center px-4 py-2 text-sm font-medium rounded-md ${
													isActive
														? "bg-red-50 text-red-700"
														: "text-gray-900 hover:bg-gray-50"
												}`}
											>
												{item.label}
											</Link>
										);
									})}
								</nav>
								<div className="py-4 flex flex-col gap-4 justify-center items-center border-t border-gray-200 mt-auto shrink-0">
									<form action={adminLogoutAction} className="w-full px-4">
										<Button
											type="submit"
											variant="outline"
											className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
											onClick={() => setSidebarOpen(false)}
										>
											تسجيل خروج
										</Button>
									</form>
									<Logo />
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Main Content */}
			<main className="pt-20 pb-10 md:py-0 md:ps-64 min-h-screen flex flex-col">
				<div className="p-4 sm:p-8 flex-1">{children}</div>
			</main>
		</div>
	);
}
