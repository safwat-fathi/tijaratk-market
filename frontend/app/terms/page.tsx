import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { SITE_URL } from "@/lib/marketing-seo";

export const metadata: Metadata = {
  title: "شروط الاستخدام",
  description: "شروط استخدام منصة تجارتك للتجار والعملاء.",
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col font-sans bg-[#F7F8F6]">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 prose prose-lg prose-slate rtl:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-[#0F5A3D] mb-8">
            شروط الاستخدام
          </h1>
          
          <p className="text-gray-700 leading-relaxed mb-6">
            مرحباً بك في <strong>تجارتك</strong>. تُنظم هذه الشروط استخدامك لمنصتنا كمقدم خدمة (تاجر) أو كمستخدم (عميل). باستخدامك للمنصة، فإنك توافق على الالتزام بهذه الشروط.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. طبيعة المنصة ودورنا</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            تعمل منصة <strong>تجارتك</strong> كمزود خدمة تقنية (وسيط تقني) تتيح للتجار إدارة طلباتهم وعرض منتجاتهم للعملاء. المنصة ليست البائع الفعلي للمنتجات، ولا نتدخل في تفاصيل البيع والشراء أو تسعير المنتجات، ويقتصر دورنا على إتاحة المنصة والخدمة التقنية ضمن الحدود المتاحة.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. مسؤولية التاجر</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            التاجر (مقدم الخدمة/البائع) هو المسؤول الأول والوحيد عن:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
            <li>صحة أسعار المنتجات ودقتها.</li>
            <li>توفر المنتجات وجودتها.</li>
            <li>عملية التوصيل والتعامل المباشر مع العميل.</li>
            <li>سياسة الاسترجاع والاستبدال وفقاً لقانون حماية المستهلك.</li>
            <li>الالتزام بكافة التراخيص والقوانين المحلية المنظمة لنشاطه التجاري (خاصة الصيدليات فيما يتعلق ببيع الأدوية والمنتجات الطبية والالتزام بالوصفات الطبية والإعلانات الدوائية).</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. المنتجات المحظورة والأنشطة المخالفة</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            يُمنع منعاً باتاً استخدام المنصة في عرض أو بيع منتجات محظورة قانوناً، أو مقيدة بدون الحصول على التراخيص اللازمة. يشمل ذلك، على سبيل المثال لا الحصر، الأدوية غير المصرح بها أو المنتجات الخاضعة لتنظيم خاص بدون الالتزام بالقانون. كما يُمنع منعاً باتاً بيع أو ترويج السجائر، منتجات التبغ، السجائر الإلكترونية، أدوات التدخين، أو أي منتجات ذات صلة من خلال المنصة. تحتفظ منصة تجارتك بالحق الكامل في إيقاف أو حظر أي تاجر يستخدم المنصة في نشاط مخالف دون إشعار مسبق.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. حدود المسؤولية</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            لا تتحمل منصة تجارتك أي مسؤولية عن تعطل الخدمة الطارئ أو أي خطأ في تسعير المنتجات المعروضة من قبل التاجر أو أي تأخير في توصيل الطلبات. المنصة لا تقدم أي نصائح طبية، ولا تبيع الأدوية مباشرة، والتاجر هو المسؤول عن الالتزام بتراخيصه وتقديم الخدمة للعميل.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. الاشتراك، الإلغاء، والاسترداد للتجار</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            تخضع خدماتنا المقدمة للتجار لقواعد الاشتراك الموضحة في صفحة الباقات. يحق للتاجر إلغاء الاشتراك وفقاً للشروط المحددة وقت التعاقد. سياسات الاسترداد المالي للاشتراكات تخضع لشروط الباقة المختارة ولا تطبق على الفترات التي تم الاستفادة منها من الخدمة.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. ملكية المحتوى</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            يتحمل التاجر مسؤولية المحتوى الذي يقوم برفعه على المنصة، بما في ذلك صور المنتجات، أسماء المتاجر، وبيانات المنتجات. يضمن التاجر أن لديه الحقوق الكاملة لاستخدام هذا المحتوى ولا ينتهك حقوق الملكية الفكرية لأي طرف ثالث.
          </p>

          <div className="mt-12 p-4 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-500">
            آخر تحديث: {new Date().toLocaleDateString('ar-EG')}
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
