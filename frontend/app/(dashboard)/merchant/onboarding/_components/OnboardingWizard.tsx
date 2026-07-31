"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOnboardingProgressAction } from "@/actions/tenant-actions";
import { Tenant } from "@/types/models/tenant";
import { Logo } from "@/components/ui/Logo";
import { ChevronRight } from "lucide-react";
import LocationStep from "./LocationStep";
import DeliverySettingsStep from "./DeliverySettingsStep";
import PaymentMethodsStep from "./PaymentMethodsStep";
import AddProductsStep from "./AddProductsStep";
import ReviewProductsStep from "./ReviewProductsStep";

function getStepColors(stepId: number, currentStep: number) {
  if (stepId < currentStep) return "bg-brand-primary border-brand-primary text-white";
  if (stepId === currentStep) return "bg-white border-brand-primary text-brand-primary";
  return "bg-white border-gray-300 text-gray-400";
}

export default function MerchantOnboardingWizard({
  initialTenant,
}: {
  initialTenant: Tenant;
}) {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant>(initialTenant);
  const [currentStep, setCurrentStep] = useState(
    initialTenant.onboarding_step || 1,
  );

  // State for LocationStep to persist data when going back and forth
  const [locationData, setLocationData] = useState<{
    cityId: string;
    address: string;
  }>({
    cityId: "",
    address: "",
  });

  const isGrocery = tenant.category === "grocery";

  const allSteps = [
    { id: 1, title: "العنوان", description: "مكان المتجر لتغطية التوصيل" },
    { id: 2, title: "التوصيل", description: "مصاريف ومواعيد التوصيل" },
    { id: 3, title: "طرق الدفع", description: "المحافظ الإلكترونية وإنستاباي" },
    { id: 4, title: "إضافة المنتجات", description: "تجهيز بضاعة المتجر", groceryOnly: true },
    { id: 5, title: "مراجعة الأسعار", description: "تأكيد توافر المنتجات", groceryOnly: true },
  ];

  const steps = allSteps.filter(s => !s.groceryOnly || isGrocery);

  const handleNextStep = async () => {
    const nextStep = currentStep + 1;

    const finalStepId = steps[steps.length - 1].id;
    // If it's the final step
    if (currentStep === finalStepId) {
      await updateOnboardingProgressAction({
        onboarding_completed: true,
        onboarding_step: nextStep,
      });
      router.replace("/merchant");
      return;
    }

    await updateOnboardingProgressAction({ onboarding_step: nextStep });
    setCurrentStep(nextStep);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-white min-h-screen sm:min-h-[auto] sm:my-10 sm:rounded-2xl sm:shadow-xl sm:border border-gray-100 flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex flex-col items-center justify-between bg-white z-10 sticky top-0">
          <div className="flex gap-3">
            <Logo
              variant="icon"
              width={32}
              height={32}
              className="w-8 h-8 rounded-md"
            />
            <h1 className="font-bold text-gray-900 text-lg">إعداد المتجر</h1>
          </div>
          <div className="flex w-full justify-between mt-4">
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  onClick={handlePrevStep}
                  className="flex items-center gap-1 py-1 px-3 rounded-full hover:bg-gray-100 transition-colors text-gray-600 font-medium text-sm"
                >
                  <ChevronRight className="w-5 h-5" />
                  الخطوة السابقة
                </button>
              )}
            </div>
            <div className="text-sm font-medium text-brand-primary bg-brand-soft px-3 py-1 rounded-full">
              خطوة {currentStep} من {steps.length}
            </div>
          </div>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 hidden sm:block">
          <div className="flex justify-between items-center relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
            <div
              className="absolute top-1/2 right-0 h-0.5 bg-brand-primary -z-10 -translate-y-1/2 transition-all duration-300"
              style={{
                width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
              }}
            ></div>

            {steps.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${getStepColors(s.id, currentStep)}`}
                >
                  {s.id < currentStep ? "✓" : s.id}
                </div>
                <span
                  className={`text-xs font-semibold ${s.id <= currentStep ? "text-gray-900" : "text-gray-400"}`}
                >
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 flex flex-col bg-white">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {steps.find(s => s.id === currentStep)?.title}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {steps.find(s => s.id === currentStep)?.description}
            </p>
          </div>

          <div className="flex-1">
            {currentStep === 1 && (
              <LocationStep
                tenant={tenant}
                setTenant={setTenant}
                onNext={handleNextStep}
                locationData={locationData}
                setLocationData={setLocationData}
              />
            )}
            {currentStep === 2 && (
              <DeliverySettingsStep
                tenant={tenant}
                setTenant={setTenant}
                onNext={handleNextStep}
              />
            )}
            {currentStep === 3 && (
              <PaymentMethodsStep
                tenant={tenant}
                setTenant={setTenant}
                onNext={handleNextStep}
              />
            )}
            {currentStep === 4 && (
              <AddProductsStep
                tenant={tenant}
                setTenant={setTenant}
                onNext={handleNextStep}
              />
            )}
            {currentStep === 5 && (
              <ReviewProductsStep
                tenant={tenant}
                setTenant={setTenant}
                onNext={handleNextStep}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
