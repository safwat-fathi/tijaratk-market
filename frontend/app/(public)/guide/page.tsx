import { Card } from "@/components/ui/Card";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: "كيف تستخدم تجارتك ماركت؟ - دليل المستخدم",
	description: "خطوات بسيطة توضح لك كيفية استخدام تطبيق تجارتك ماركت للطلب بسهولة",
};

export default function GuidePage() {
	return (
		<div className="mx-auto w-full max-w-md pb-20 pt-4">
			<div className="mb-6 px-2 text-center">
				<h1 className="text-3xl font-bold text-brand">كيف تستخدم تجارتك ماركت؟</h1>
				<p className="mt-2 text-muted-foreground">
					دليل سريع يوضح لك كيفية البحث، الطلب، ومتابعة طلباتك خطوة بخطوة.
				</p>
			</div>

			{/* Sticky Navigation */}
			<nav className="sticky top-0 z-50 mb-8 overflow-x-auto whitespace-nowrap border-b bg-background/95 py-3 shadow-sm backdrop-blur">
				<div className="flex gap-3 px-2">
					<a
						href="#getting-started"
						className="rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
					>
						البداية والتصفح
					</a>
					<a
						href="#finding-products"
						className="rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
					>
						البحث عن المنتجات
					</a>
					<a
						href="#ordering"
						className="rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
					>
						الطلب والدفع
					</a>
					<a
						href="#tracking"
						className="rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
					>
						متابعة الطلب
					</a>
				</div>
			</nav>

			{/* Content */}
			<div className="space-y-12 px-2">
				{/* Section 1: Getting Started */}
				<section id="getting-started" className="scroll-mt-20 space-y-6">
					<h2 className="border-b pb-2 text-xl font-bold text-foreground">
						البداية والتصفح
					</h2>

					<TopicCard
						title="كيف تبحث عن منطقتك؟"
						description="في الصفحة الرئيسية، استخدم شريط البحث لاختيار منطقتك السكنية حتى نتمكن من عرض السوبر ماركت والصيدليات المتاحة للتوصيل إليك."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Search+Area"
					/>

					<TopicCard
						title="ما هو زر المساعدة في الأعلى؟"
						description="علامة الاستفهام (?) الموجودة في الشريط العلوي تتيح لك الوصول السريع إلى الدعم الفني أو الأسئلة الشائعة في أي وقت."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Help+Button"
					/>

					<TopicCard
						title="كيف تثبت الموقع كتطبيق على هاتفك؟"
						description="يمكنك تثبيت الموقع كتطبيق على هاتفك الذكي للوصول السريع. فقط اضغط على أيقونة التنزيل بجوار شريط العنوان في متصفحك أو من القائمة."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Install+App"
					/>
				</section>

				{/* Section 2: Finding Products */}
				<section id="finding-products" className="scroll-mt-20 space-y-6">
					<h2 className="border-b pb-2 text-xl font-bold text-foreground">
						البحث عن المنتجات
					</h2>

					<TopicCard
						title="شرح أقسام صفحة المتجر"
						description="عند دخولك لأي متجر، ستجد المنتجات مقسمة في تبويبات واضحة (مثل: خضروات، بقوليات، عناية شخصية) لتسهيل الوصول لما تحتاجه."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Store+Sections"
					/>

					<TopicCard
						title="كيف تبحث عن منتج معين؟"
						description="استخدم شريط البحث المخصص داخل صفحة المتجر للعثور على منتجك المفضل بسرعة دون الحاجة لتصفح كل الأقسام."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Product+Search"
					/>
				</section>

				{/* Section 3: Ordering & Checkout */}
				<section id="ordering" className="scroll-mt-20 space-y-6">
					<h2 className="border-b pb-2 text-xl font-bold text-foreground">
						الطلب والدفع
					</h2>

					<TopicCard
						title="الطلب بالنص الحر (مش لاقي المنتج؟)"
						description="إذا لم تجد المنتج الذي تبحث عنه، يمكنك كتابة اسمه في قسم الطلب الحر وسنقوم بإبلاغ التاجر بتوفيره لك."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Free+Text+Order"
					/>

					<TopicCard
						title="هل يمكنني دمج الطلب الحر مع منتجات السلة؟"
						description="نعم! يمكنك اختيار منتجات من القائمة المتاحة وإضافة طلبات أخرى غير موجودة في النص الحر وإرسالهم معاً في طلب واحد."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Mixed+Order"
					/>

					<TopicCard
						title="ما هو الطلب المجدول؟"
						description="حتى لو كان المتجر مغلقاً، يمكنك حجز موعد توصيل للطلب لاحقاً. اختر التاريخ والوقت المناسب لك من نافذة المواعيد المتاحة."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Scheduled+Order"
					/>

					<TopicCard
						title="تفاصيل نموذج إتمام الطلب"
						description="قبل التأكيد، يمكنك مراجعة سلتك، تعديل الكميات، وإضافة ملاحظات خاصة لكل صنف (مثل: طازج، بدون كيس)."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Order+Form"
					/>

					<TopicCard
						title="طرق الدفع المتاحة"
						description="يمكنك الدفع بأكثر من طريقة مثل المحافظ الإلكترونية، إنستاباي، أو الدفع عند الاستلام. كل متجر يحدد الطرق المتاحة لديه."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Payment+Methods"
					/>
				</section>

				{/* Section 4: After Ordering */}
				<section id="tracking" className="scroll-mt-20 space-y-6">
					<h2 className="border-b pb-2 text-xl font-bold text-foreground">
						متابعة الطلب
					</h2>

					<TopicCard
						title="ما هو كود العميل؟"
						description="بعد إتمام الطلب سيظهر لك 'كود العميل'. احتفظ بهذا الكود لأنك ستحتاجه لمتابعة حالة طلبك من أي جهاز أو متصفح آخر."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Customer+Code"
					/>

					<TopicCard
						title="كيف تتبع حالة طلبك؟"
						description="من خلال صفحة 'متابعة الطلب'، أدخل كود العميل ورقم هاتفك لرؤية حالة طلبك الحالية سواء كانت قيد المراجعة أو في الطريق إليك."
						imageUrl="https://placehold.co/400x800/e8f5ed/0f5a3d?text=Track+Order"
					/>
				</section>
			</div>
		</div>
	);
}

function TopicCard({
	title,
	description,
	imageUrl,
}: {
	title: string;
	description: string;
	imageUrl: string;
}) {
	return (
		<Card className="overflow-hidden bg-card/50">
			<div className="space-y-4">
				<div>
					<h3 className="text-lg font-bold text-foreground">{title}</h3>
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				</div>

				{/* Mobile Mockup Wrapper */}
				<div className="mx-auto w-[240px] overflow-hidden rounded-[2rem] border-8 border-slate-800 bg-slate-800 shadow-xl sm:w-[280px]">
					{/* IMPORTANT: Replace imageUrl with your actual local image path later e.g. "/images/guide/screen1.png" */}
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={imageUrl} alt={title} className="h-full w-full object-cover" />
				</div>
			</div>
		</Card>
	);
}
