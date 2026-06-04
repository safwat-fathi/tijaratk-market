import RegisterForm from "@/app/(dashboard)/merchant/(auth)/_components/auth/register-form";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"إنشاء حساب تاجر",
	"ابدأ رحلتك مع تجارتك وقم بإنشاء حساب لمتجرك بكل سهولة لتصل لعملائك بشكل أفضل.",
);

export default function RegisterPage() {
  return <RegisterForm />;
}
