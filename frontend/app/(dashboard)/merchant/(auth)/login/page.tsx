import LoginForm from "@/app/(dashboard)/merchant/(auth)/_components/auth/login-form";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"تسجيل دخول التاجر",
	"سجّل الدخول إلى حساب التاجر بعد تواصل فريق تجارتك معك واعتماد طلب الانضمام.",
);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ credentialChanged?: string }>;
}) {
  const { credentialChanged } = await searchParams;
  const notice =
    credentialChanged === "phone"
      ? "تم تغيير رقم الهاتف. سجل الدخول بالرقم الجديد."
      : credentialChanged === "password"
        ? "تم تغيير كلمة المرور. سجل الدخول مرة أخرى."
        : undefined;

  return <LoginForm notice={notice} />;
}
