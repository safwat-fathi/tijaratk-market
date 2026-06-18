import ResetPasswordForm from "./_components/ResetPasswordForm";
import { createNoIndexMetadata } from "@/lib/marketing-seo";

export const metadata = createNoIndexMetadata(
	"إعادة تعيين كلمة مرور التاجر",
	"استعد الوصول إلى حساب التاجر عبر رمز تحقق واتساب.",
);

export default function ResetPasswordPage() {
	return <ResetPasswordForm />;
}
