import LoginForm from "@/app/(dashboard)/merchant/(auth)/_components/auth/login-form";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"تسجيل دخول التاجر",
	"سجّل الدخول إلى حساب التاجر بعد تواصل فريق تجارتك معك واعتماد طلب الانضمام.",
);

export default function LoginPage() {
  return <LoginForm />;
}
