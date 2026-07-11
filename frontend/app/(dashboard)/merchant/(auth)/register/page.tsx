import RegisterForm from "@/app/(dashboard)/merchant/(auth)/_components/auth/register-form";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"طلب انضمام متجر",
	"أرسل بيانات متجرك للمراجعة، وسيتواصل معك فريق تجارتك لاستكمال المستندات القانونية والاعتماد.",
);

export default function RegisterPage() {
  return <RegisterForm />;
}
