import type { TenantCategory } from "@/constants";

export interface LoginRequest {
	phone: string;
	pass: string;
}

export interface LoginResponse {
	access_token: string;
	user: {
		id: number;
		phone: string;
		role: string;
		tenant_id: number;
		name: string;
	};
}

// Matching SignupDto from backend
export interface RegisterRequest {
	storeName: string;
	name: string;
	phone: string;
	category?: TenantCategory;
	password: string;
	confirm_password: string;
}

export interface RequestPasswordResetRequest {
	phone: string;
}

export interface VerifyPasswordResetRequest {
	phone: string;
	otp: string;
	password: string;
	confirm_password: string;
}

export interface UpdatePasswordRequest {
	currentPassword: string;
	newPassword: string;
}
