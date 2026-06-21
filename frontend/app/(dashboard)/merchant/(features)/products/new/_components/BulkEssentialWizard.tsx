"use client";

import { useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { bulkAddEssentialItemsAction } from "@/actions/product-actions";

// The categories matching exactly the CSV analysis
const ESSENTIAL_CATEGORIES = [
  { id: "cooking", enTitle: "Cooking Ingredients", arTitle: "مكونات الطبخ", label: "مكونات الطبخ (Cooking Ingredients)", count: 627 },
  {
    id: "biscuits",
    enTitle: "Biscuits, Crackers & Cakes",
    arTitle: "بسكويت، كراكرز وكيك",
    label: "بسكويت، كراكرز وكيك (Biscuits, Crackers & Cakes)",
    count: 639,
  },
  {
    id: "chocolate",
    enTitle: "Chocolate & Confectionery",
    arTitle: "الشوكولاته والمعجنات",
    label: "الشوكولاته والمعجنات (Chocolate & Confectionery)",
    count: 661,
  },
  { id: "chips", enTitle: "Chips, Dips & Snacks", arTitle: "شيبس ومقبلات", label: "شيبس ومقبلات (Chips, Dips & Snacks)", count: 296 },
  {
    id: "rice",
    enTitle: "Rice, Pasta & Pulses",
    arTitle: "أرز , مكرونة والبقوليات",
    label: "أرز , مكرونة والبقوليات (Rice, Pasta & Pulses)",
    count: 276,
  },
  { id: "jams", enTitle: "Jams, Honey & Spreads", arTitle: "مربي، عسل وغيرها", label: "مربي، عسل وغيرها (Jams, Honey & Spreads)", count: 271 },
  {
    id: "sugar",
    enTitle: "Sugar & Home Baking",
    arTitle: "السكر و مستلزمات الخبز",
    label: "السكر و مستلزمات الخبز (Sugar & Home Baking)",
    count: 251,
  },
  {
    id: "condiments",
    enTitle: "Condiments, Dressings & Marinades",
    arTitle: "توابل، صلصات و خل",
    label: "توابل، صلصات و خل (Condiments, Dressings & Marinades)",
    count: 202,
  },
];

const FUN_LOADING_TEXTS = [
  "بنضيف الشيبسي والمقرمشات...",
  "بنجيب الزيت والسكر...",
  "بنرص المكرونة والأرز...",
  "خلاص بنخلص...",
];

type BulkEssentialWizardProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function BulkEssentialWizard({
  isOpen,
  onClose,
  onSuccess,
}: BulkEssentialWizardProps) {
  const [step, setStep] = useState<
    "intro" | "categories" | "loading" | "success"
  >("intro");
  const [selectedCategories, setSelectedCategories] = useState<
    Record<string, boolean>
  >(
    ESSENTIAL_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {}),
  );
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  const handleNext = () => setStep("categories");

  const handleToggleCategory = (id: string) => {
    setSelectedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStartImport = async () => {
    setStep("loading");

    // Mocking the loading process with text changes
    let textIndex = 0;
    const intervalId = setInterval(() => {
      textIndex++;
      if (textIndex < FUN_LOADING_TEXTS.length) {
        setLoadingTextIndex(textIndex);
      }
    }, 1500);

    try {
      const selectedArabicCategories = ESSENTIAL_CATEGORIES.filter(
        (cat) => selectedCategories[cat.id]
      ).map((cat) => cat.arTitle);

      const result = await bulkAddEssentialItemsAction(selectedArabicCategories);

      if (result?.success) {
        setStep("success");
      } else {
        alert(result?.message || "حدث خطأ أثناء الإضافة");
        setStep("categories");
      }
    } catch (error) {
      alert("حدث خطأ أثناء الإضافة");
      setStep("categories");
    } finally {
      clearInterval(intervalId);
    }
  };

  const handleFinish = () => {
    // Reset state for next time
    setTimeout(() => {
      setStep("intro");
      setLoadingTextIndex(0);
    }, 500);
    onSuccess();
    onClose();
  };

  // Close handler that intercepts during loading
  const handleClose = () => {
    if (step === "loading") return; // Prevent closing while loading
    // Reset state if closed manually
    if (step === "success") {
      handleFinish();
    } else {
      setTimeout(() => setStep("intro"), 500);
      onClose();
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      title="التشكيلة الأساسية"
      onClose={handleClose}
    >
      <div className="space-y-6 pt-2 pb-6">
        {step === "intro" && (
          <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-20 h-20 bg-brand-soft rounded-full flex items-center justify-center mb-2">
              <span className="text-4xl">🛒</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              {" "}
              إضافة تشكيلة كاملة بضغطة زر!
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              وفر ساعات من إدخال البيانات! جهزنالك قائمة بأهم وأشهر المنتجات
              الأساسية بأسعار استرشادية، جاهزين للإضافة لمحلك بضغطة واحدة.
            </p>

            <div className="grid grid-cols-4 gap-3 w-full py-4 opacity-70">
              <div className="bg-gray-100 p-2 rounded-lg text-center text-xs font-semibold">
                شيبسي
              </div>
              <div className="bg-gray-100 p-2 rounded-lg text-center text-xs font-semibold">
                كريستال
              </div>
              <div className="bg-gray-100 p-2 rounded-lg text-center text-xs font-semibold">
                الملكة
              </div>
              <div className="bg-gray-100 p-2 rounded-lg text-center text-xs font-semibold">
                مولتو
              </div>
            </div>

            <Button onClick={handleNext} className="w-full mt-2" size="lg">
              التالي
            </Button>
          </div>
        )}

        {step === "categories" && (
          <div className="flex flex-col space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                اختيار الأقسام
              </h3>
              <p className="text-sm text-gray-500">
                لو مش بتبيع قسم معين، تقدر تلغيه من هنا.
              </p>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 pb-4">
              {ESSENTIAL_CATEGORIES.map((cat) => (
                <label
                  key={cat.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedCategories[cat.id]
                      ? "border-brand-primary bg-brand-soft/20"
                      : "border-gray-200 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-900">
                      {cat.label.split("(")[0]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {cat.count} منتج
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedCategories[cat.id]}
                    onChange={() => handleToggleCategory(cat.id)}
                    className="h-5 w-5 accent-brand-primary rounded"
                  />
                </label>
              ))}
            </div>

            <div className="pt-2">
              <Button onClick={handleStartImport} className="w-full" size="lg">
                اعتماد وإضافة المنتجات
              </Button>
              <button
                onClick={() => setStep("intro")}
                className="w-full mt-3 text-sm font-semibold text-gray-500 hover:text-gray-900"
              >
                رجوع
              </button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center space-y-6 py-12 animate-in fade-in duration-500">
            <div className="relative flex items-center justify-center w-24 h-24">
              <div className="absolute inset-0 border-4 border-brand-soft rounded-full"></div>
              <div className="absolute inset-0 border-4 border-brand-primary rounded-full border-t-transparent animate-spin"></div>
              <span className="text-3xl animate-pulse">🛒</span>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-gray-900">
                جاري إضافة التشكيلة ...
              </h3>
              <p className="text-sm text-brand-primary font-medium transition-all duration-300">
                {FUN_LOADING_TEXTS[loadingTextIndex]}
              </p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center text-center space-y-6 py-6 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2 animate-bounce">
              <svg
                className="w-12 h-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gray-900">ألف مبروك!</h3>
              <p className="text-lg text-gray-600 font-medium">
                إنت دلوقتي جاهز لإستقبال الطلبات
              </p>
            </div>

            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm flex items-start text-right w-full">
              <svg
                className="w-5 h-5 shrink-0 ml-2 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>
                المنتجات انضافت بأسعار استرشادية، ومميزة بكلمة{" "}
                <strong>"راجع السعر"</strong> عشان تقدر تعدلها حسب محلك براحتك.
              </p>
            </div>

            <Button onClick={handleFinish} className="w-full" size="lg">
              عرض المنتجات
            </Button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
