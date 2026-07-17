"use client";

import { useState, useRef } from "react";
import {
  UploadCloud,
  CheckCircle2,
  ChevronDown,
  FileText,
} from "lucide-react";

interface PrescriptionUploadFormProps {
  onFileChange?: (hasFile: boolean) => void;
}

export default function PrescriptionUploadForm({
  onFileChange,
}: PrescriptionUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      onFileChange?.(true);
    } else {
      setFile(null);
      onFileChange?.(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      onFileChange?.(true);
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
      }
    }
  };

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      data-customer-tour="prescription"
      className="mt-4 rounded-lg border border-brand-border bg-white p-5 shadow-soft transition-[box-shadow] focus-within:ring-4 focus-within:ring-brand-accent/15"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-brand-soft/50 p-2.5 text-brand-primary">
            <FileText size={22} />
          </div>
          <div className="flex flex-col text-right">
            <h2 className="text-xl font-bold text-brand-text">اطلب بالروشتة</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              صور الروشتة وارفعها وهنجهزلك طلبك
            </p>
          </div>
        </div>
        <ChevronDown
          className={`text-brand-text transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={24}
        />
      </button>

      {isOpen && (
        <div className="mt-6 border-t border-brand-border pt-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="mb-8 animate-in fade-in duration-300">
              {/* Form Container */}
              <div className="bg-white rounded-[20px] p-6 shadow-soft border border-brand-border/40">
                <div className="space-y-6">
                  {/* Dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground px-1">
                      في حالة عدم التوفر
                    </label>
                    <select
                      name="unavailabilityOption"
                      className="w-full bg-(--brand-soft)/30 border-none rounded-xl h-12 px-4 text-base text-(--brand-text) focus:ring-2 focus:ring-(--brand-accent) transition-all"
                    >
                      <option value="call">اتصل بي للاستشارة</option>
                      <option value="alternative">أرسل البديل المتاح</option>
                      <option value="cancel">إلغاء المنتج</option>
                    </select>
                  </div>

                  {/* Upload Area */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground px-1">
                      تحميل الوصفة الطبية
                    </label>
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                      className={`group relative w-full border-2 border-dashed rounded-[20px] p-8 flex flex-col items-center justify-center cursor-pointer transition-all active:scale-[0.98] ${
                        isDragOver || file
                          ? "bg-(--brand-soft)/50 border-(--brand-accent)"
                          : "bg-(--brand-soft)/20 border-(--brand-accent)/30 hover:bg-(--brand-soft)/40 hover:border-(--brand-accent)"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        name="prescription_file"
                        accept="image/*,.pdf"
                        capture="environment"
                        className="hidden"
                        type="file"
                        onChange={handleFileChange}
                        required={!file}
                      />
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                        <UploadCloud className="text-(--brand-accent) h-8 w-8" />
                      </div>
                      <p className="text-base font-semibold text-(--brand-text) mb-1 text-center">
                        {file ? file.name : "اضغط لالتقاط صورة أو تحميل ملف"}
                      </p>
                      {!file && (
                        <p className="text-xs text-muted-foreground text-center px-2">
                          استخدم كاميرا الهاتف أو ارفع صورة (JPG, PNG) أو PDF
                        </p>
                      )}
                      {file && (
                        <div className="mt-3 text-(--brand-accent) font-medium flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5" />
                          <span>تم اختيار الملف</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Extra Help Card */}
            </div>
        </div>
      )}
    </div>
  );
}
