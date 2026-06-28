import HttpService from "@/services/base/http.service";
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RequestPasswordResetRequest,
  VerifyPasswordResetRequest,
  UpdatePasswordRequest,
} from "@/types/services/auth";

class AuthService extends HttpService {
	constructor() {
		super("/auth");
	}

	public async login(payload: LoginRequest) {
		const response = await this.post<LoginResponse>("login", payload);
		return response;
	}

	public async signup(payload: RegisterRequest) {
		return this.post("signup", payload);
	}

	public async requestPasswordReset(payload: RequestPasswordResetRequest) {
		return this.post<{ success: boolean; message?: string }>(
			"password-reset/request",
			payload,
		);
	}

	public async verifyPasswordReset(payload: VerifyPasswordResetRequest) {
		return this.post<{ success: boolean; message?: string }>(
			"password-reset/verify",
			payload,
		);
	}

	public async updatePassword(payload: UpdatePasswordRequest) {
		return this.post<{ success: boolean; message?: string }>(
			"update-password",
			payload,
		);
	}

	public async logout() {
		// Best effort API call
		try {
			await this.post("logout", {});
		} catch (error) {
			console.error("Logout API call failed:", error);
		}
		return { success: true };
	}
}

export const authService = new AuthService();
