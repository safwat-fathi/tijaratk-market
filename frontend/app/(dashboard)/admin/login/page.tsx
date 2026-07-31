import { createNoIndexMetadata } from "@/lib/marketing-seo";
import AdminLoginForm from "./_components/AdminLoginForm";

export const metadata = createNoIndexMetadata(
  "تسجيل دخول الإدارة",
  "تسجيل الدخول إلى لوحة تحكم الإدارة في تجارتك.",
);

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
