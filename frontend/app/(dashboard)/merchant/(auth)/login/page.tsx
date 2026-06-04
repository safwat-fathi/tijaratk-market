import LoginForm from "@/app/(dashboard)/merchant/(auth)/_components/auth/login-form";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"تسجيل دخول التاجر",
	"قم بتسجيل الدخول إلى حساب التاجر الخاص بك لإدارة متجرك والبدء في تلقي الطلبات.",
);

export default function LoginPage() {
  return <LoginForm />;
}
