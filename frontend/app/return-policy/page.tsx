import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import {
  createPublicMetadata,
  getPublicMarketingPage,
} from "@/lib/marketing-seo";

export const metadata: Metadata = createPublicMetadata(
  getPublicMarketingPage("/return-policy"),
);

export default function ReturnPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col font-sans bg-[#F7F8F6]">
      <PublicHeader />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 prose prose-lg prose-slate rtl:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-[#0F5A3D] mb-8">
            سياسة الاسترجاع والاستبدال ومسؤولية المستهلك
          </h1>
          
          <p className="text-gray-700 leading-relaxed mb-6">
            منصة <strong>تجارتك</strong> هي وسيط تقني يربط بين العملاء والتجار (السوبر ماركت، الصيدليات، وغيرها). نهدف لتسهيل عملية الطلب وإدارتها بفاعلية، ولكننا لسنا البائع الفعلي للمنتجات.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. مسؤولية التاجر</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            التاجر (البائع) هو المسؤول الأول والوحيد عن تنفيذ سياسة الإرجاع والاستبدال وفقاً لقانون حماية المستهلك المصري. عند تقديم طلب، سيتم عرض معلومات التاجر بوضوح (اسم التاجر، رقم التواصل، السعر، مصاريف التوصيل، حالة الطلب) لضمان الشفافية.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. حق الاسترجاع والاستبدال العام</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            يمنح قانون حماية المستهلك في مصر المستهلك حق الاستبدال أو الاسترجاع خلال 14 يوماً من تاريخ استلام المنتج في الحالات العامة، ومدة أطول تصل إلى 30 يوماً في حالة وجود عيب صناعة أو عدم مطابقة للمواصفات، وذلك شريطة أن يكون المنتج بحالته الأصلية.
          </p>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. استثناءات الاسترجاع (المنتجات الغذائية والطبية)</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            نظراً لطبيعة المتاجر التي تقدم خدماتها عبر منصتنا (مثل السوبر ماركت والصيدليات)، هناك استثناءات هامة لحق الاسترجاع والاستبدال:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
            <li><strong>المنتجات الغذائية والطازجة:</strong> السلع سريعة التلف (مثل الخضروات، الفواكه، المخبوزات، الألبان واللحوم الطازجة) لا تخضع لسياسة الاسترجاع بمجرد استلامها وقبولها من قبل العميل، إلا في حالة تلفها قبل التسليم.</li>
            <li><strong>المنتجات المفتوحة أو المستخدمة:</strong> أي منتج تم فتحه أو استخدامه أو إتلاف غلافه الأصلي لا يمكن إرجاعه.</li>
            <li><strong>المنتجات الطبية والصيدلانية:</strong> تخضع الأدوية والمنتجات الطبية لقوانين وزارة الصحة، وفي الغالب لا يمكن استرجاعها أو استبدالها بعد خروجها من الصيدلية حرصاً على الصحة العامة، ويتحمل التاجر (الصيدلية) مسؤولية تطبيق هذه القوانين.</li>
          </ul>

          <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">4. كيفية طلب الإرجاع</h2>
          <p className="text-gray-700 leading-relaxed mb-6">
            لطلب إرجاع أو استبدال منتج، يجب على العميل التواصل مباشرة مع التاجر الذي تم الشراء منه عبر بيانات التواصل الموضحة في تفاصيل الطلب، وذلك خلال المدة القانونية المحددة.
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
