import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { SITE_URL } from "@/lib/marketing-seo";

export const metadata: Metadata = {
  title: "سياسة الخصوصية وحماية البيانات الشخصية",
  description: "سياسة الخصوصية وحماية البيانات الشخصية لمنصة تجارتك وفقاً للقوانين المصرية.",
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col font-sans bg-[#F7F8F6]">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 prose prose-lg prose-slate rtl:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-[#0F5A3D] mb-8">
            سياسة الخصوصية وحماية البيانات الشخصية
          </h1>
          
          <p className="text-gray-700 leading-relaxed mb-6">
            نحن في <strong>تجارتك</strong> نولي اهتماماً كبيراً بخصوصية مستخدمينا وحماية بياناتهم الشخصية. تم إعداد هذه السياسة وفقاً لقانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020، لتوضيح كيفية جمعنا للبيانات واستخدامها وحمايتها.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. البيانات التي نجمعها</h2>
          <p className="text-gray-700 leading-relaxed mb-4">نقوم بجمع بعض البيانات الضرورية لتقديم الخدمة وتحسينها، وتشمل:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
            <li><strong>البيانات الأساسية:</strong> الاسم، رقم الهاتف، العنوان.</li>
            <li><strong>بيانات الطلبات:</strong> تفاصيل الطلبات، تتبع الطلبات، وتاريخ المشتريات.</li>
            <li><strong>البيانات التقنية:</strong> عنوان بروتوكول الإنترنت (IP)، ملفات تعريف الارتباط (Cookies)، ونوع المتصفح المستخدم.</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. استخدام البيانات</h2>
          <p className="text-gray-700 leading-relaxed mb-4">نستخدم البيانات التي نجمعها للأغراض التالية:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
            <li>تنفيذ الطلبات وتسهيل عملية التوصيل بالتعاون مع التجار.</li>
            <li>إدارة حسابات التجار والعملاء على المنصة.</li>
            <li>تحليل البيانات لتحسين جودة الخدمات وتجربة المستخدم.</li>
            <li>تقديم الدعم الفني وحل المشكلات التقنية.</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. مشاركة البيانات</h2>
          <p className="text-gray-700 leading-relaxed mb-4">لا نقوم ببيع بياناتك لأطراف خارجية. قد نشارك بياناتك في الحالات الضرورية التالية فقط:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
            <li><strong>التجار (مقدمي المنتجات):</strong> نشارك بياناتك (مثل الاسم ورقم الهاتف والعنوان) مع التاجر المعني لتنفيذ وتوصيل طلبك.</li>
            <li><strong>فريق تجارتك:</strong> للوصول إلى البيانات بغرض الدعم الفني والإدارة.</li>
            <li><strong>مزودي الخدمات الخارجية:</strong> مثل خدمات الاستضافة، خدمات إرسال الرسائل القصيرة (SMS)، وتطبيق واتساب لتحديثات حالة الطلب.</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. مدة الاحتفاظ بالبيانات</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            نحتفظ ببياناتك الشخصية طالما كان حسابك نشطاً أو طالما كان ذلك ضرورياً لتقديم خدماتنا، أو للامتثال لالتزاماتنا القانونية، وتسوية النزاعات، وتنفيذ اتفاقياتنا.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">5. حقوقك في حذف أو تعديل البيانات</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            يحق لك في أي وقت طلب الوصول إلى بياناتك الشخصية، أو تعديلها، أو حذفها. يمكنك القيام بذلك عبر إعدادات حسابك أو من خلال التواصل مع فريق الدعم الفني لدينا. سنتخذ كافة الإجراءات اللازمة لتنفيذ طلبك في أسرع وقت ممكن وفقاً للقانون.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">6. إجراءات الأمان</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            نتخذ إجراءات أمنية صارمة لحماية بياناتك من الوصول غير المصرح به، التعديل، الإفصاح، أو الإتلاف. يشمل ذلك استخدام تقنيات التشفير، تحديد صلاحيات الوصول، أخذ نسخ احتياطية دورية (Backups)، والاحتفاظ بسجلات النظام (Logs) لمراقبة الأمان.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">7. الرسائل التسويقية</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            تقتصر الرسائل التلقائية الأساسية على حالة الطلب (رسائل المعاملات / Transactional). لن نقوم بإرسال رسائل تسويقية لك أو نيابة عن التجار إلا بعد الحصول على موافقتك الصريحة (Opt-in)، مع توفير خيار واضح وسهل لإلغاء الاشتراك في أي وقت.
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
