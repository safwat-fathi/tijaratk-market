"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateTenantDirectoryStatusAction } from "@/actions/admin-server";
import type { AdminTenant } from "@/services/api/admin.service";

type DirectoryStatusFormProps = {
	tenant: AdminTenant;
};

const DIRECTORY_STATUS_OPTIONS = [
	{ value: "draft", label: "مسودة" },
	{ value: "listed", label: "ظاهر في الدليل" },
	{ value: "hidden", label: "مخفي" },
	{ value: "suspended", label: "موقوف من الدليل" },
] as const;

type DirectoryStatus = (typeof DIRECTORY_STATUS_OPTIONS)[number]["value"];

const isDirectoryStatus = (value: string): value is DirectoryStatus =>
	DIRECTORY_STATUS_OPTIONS.some((status) => status.value === value);

export function DirectoryStatusForm({ tenant }: DirectoryStatusFormProps) {
	const router = useRouter();
	const directoryStatus = tenant.directory_profile?.directory_status ?? "draft";
	const [selectedStatus, setSelectedStatus] = useState(directoryStatus);
	const [state, formAction, isPending] = useActionState(
		updateTenantDirectoryStatusAction.bind(null, tenant.id),
		{ success: false },
	);

	useEffect(() => {
		setSelectedStatus(directoryStatus);
	}, [directoryStatus]);

	useEffect(() => {
		if (state.success) {
			router.refresh();
		}
	}, [router, state.success]);

	return (
		<form action={formAction}>
			<label className="sr-only" htmlFor={`tenant-${tenant.id}-directory-status`}>
				حالة الدليل
			</label>
			<select
				id={`tenant-${tenant.id}-directory-status`}
				name="directory_status"
				value={selectedStatus}
				disabled={isPending}
				onChange={(event) => {
					const nextStatus = event.currentTarget.value;
					if (!isDirectoryStatus(nextStatus)) return;
					setSelectedStatus(nextStatus);
					event.currentTarget.form?.requestSubmit();
				}}
				className="block min-h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 focus:border-primary focus:outline-none focus:ring-primary sm:w-40"
			>
				{DIRECTORY_STATUS_OPTIONS.map((status) => (
					<option key={status.value} value={status.value}>
						{status.label}
					</option>
				))}
			</select>
		</form>
	);
}
