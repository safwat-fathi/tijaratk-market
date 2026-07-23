"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import {
  importManagedProductSpreadsheetAction,
  previewManagedProductImportAction,
} from "@/actions/admin-server";
import {
  PRODUCT_IMPORT_FIELDS,
  type ProductImportField,
  type ProductImportMapping,
  type ProductImportPreview,
  type ProductImportSummary,
} from "@/types/models/product-import";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const PRODUCT_IMPORT_FIELD_OPTIONS: Array<{
  key: ProductImportField;
  label: string;
  required: boolean;
}> = [
  { key: PRODUCT_IMPORT_FIELDS.NAME, label: "اسم المنتج", required: true },
  {
    key: PRODUCT_IMPORT_FIELDS.CURRENT_PRICE,
    label: "السعر الحالي",
    required: true,
  },
  { key: PRODUCT_IMPORT_FIELDS.CATEGORY, label: "التصنيف", required: false },
  {
    key: PRODUCT_IMPORT_FIELDS.IMAGE_URL,
    label: "رابط الصورة",
    required: false,
  },
  {
    key: PRODUCT_IMPORT_FIELDS.IS_AVAILABLE,
    label: "الإتاحة",
    required: false,
  },
];

const HEADER_ALIASES: Record<ProductImportField, string[]> = {
  name: ["name", "productname", "itemname", "اسم", "اسمالمنتج", "المنتج"],
  current_price: [
    "price",
    "currentprice",
    "productprice",
    "السعر",
    "السعرالحالي",
  ],
  category: ["category", "productcategory", "التصنيف", "الفئة"],
  image_url: [
    "image",
    "imageurl",
    "productimage",
    "رابطالصورة",
    "الصورة",
  ],
  is_available: [
    "isavailable",
    "available",
    "availability",
    "متاح",
    "الإتاحة",
    "الاتاحة",
  ],
};

type WizardStep = "upload" | "map" | "review" | "result";
type ImportResultTone = "success" | "warning" | "error";

const RESULT_PRESENTATION: Record<
  ImportResultTone,
  {
    title: string;
    containerClassName: string;
    iconClassName: string;
    titleClassName: string;
    descriptionClassName: string;
  }
> = {
  success: {
    title: "اكتمل استيراد الملف",
    containerClassName: "border-emerald-200 bg-emerald-50",
    iconClassName: "text-emerald-600",
    titleClassName: "text-emerald-900",
    descriptionClassName: "text-emerald-800",
  },
  warning: {
    title: "اكتمل الاستيراد جزئيًا",
    containerClassName: "border-amber-200 bg-amber-50",
    iconClassName: "text-amber-600",
    titleClassName: "text-amber-900",
    descriptionClassName: "text-amber-800",
  },
  error: {
    title: "لم يتم استيراد أي صف",
    containerClassName: "border-red-200 bg-red-50",
    iconClassName: "text-red-600",
    titleClassName: "text-red-900",
    descriptionClassName: "text-red-800",
  },
};

type ProductImportWizardProps = {
  isOpen: boolean;
  tenantId: number;
  tenantName: string;
  canMapAvailability: boolean;
  onClose: () => void;
};

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^[\uFEFF\u200B]/, "")
    .replace(/[\s_-]+/g, "");

const buildSuggestedMapping = (
  preview: ProductImportPreview,
  canMapAvailability: boolean,
): Partial<ProductImportMapping> => {
  const mapping: Partial<ProductImportMapping> = {};
  const usedIndexes = new Set<number>();

  for (const field of PRODUCT_IMPORT_FIELD_OPTIONS) {
    if (
      field.key === PRODUCT_IMPORT_FIELDS.IS_AVAILABLE &&
      !canMapAvailability
    ) {
      continue;
    }

    const aliases = new Set(HEADER_ALIASES[field.key]);
    const column = preview.columns.find(
      (candidate) =>
        !usedIndexes.has(candidate.index) &&
        aliases.has(normalizeHeader(candidate.label)),
    );
    if (column) {
      mapping[field.key] = column.index;
      usedIndexes.add(column.index);
    }
  }

  return mapping;
};

const formatCell = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
};

const getMappingError = (
  mapping: Partial<ProductImportMapping>,
): string | null => {
  if (mapping.name === undefined || mapping.current_price === undefined) {
    return "يجب تعيين عمودي اسم المنتج والسعر الحالي.";
  }

  const indexes = Object.values(mapping).filter(
    (value): value is number => value !== undefined,
  );
  if (new Set(indexes).size !== indexes.length) {
    return "لا يمكن استخدام نفس عمود الملف لأكثر من حقل.";
  }

  return null;
};

export default function ProductImportWizard({
  isOpen,
  tenantId,
  tenantName,
  canMapAvailability,
  onClose,
}: ProductImportWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [mapping, setMapping] = useState<Partial<ProductImportMapping>>({});
  const [result, setResult] = useState<ProductImportSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleFields = useMemo(
    () =>
      PRODUCT_IMPORT_FIELD_OPTIONS.filter(
        (field) =>
          field.key !== PRODUCT_IMPORT_FIELDS.IS_AVAILABLE ||
          canMapAvailability,
      ),
    [canMapAvailability],
  );
  const mappedFields = useMemo(
    () =>
      visibleFields.filter(
        (field) => mapping[field.key] !== undefined,
      ),
    [mapping, visibleFields],
  );
  const mappingError = getMappingError(mapping);
  const importedRows = result
    ? result.created_rows + result.updated_rows
    : 0;
  const resultTone: ImportResultTone =
    result && result.failed_rows === 0
      ? "success"
      : importedRows > 0
        ? "warning"
        : "error";
  const resultPresentation = RESULT_PRESENTATION[resultTone];

  const resetAndClose = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setMessage(null);
    onClose();
  };

  const handleFileChange = (selectedFile: File | null) => {
    setMessage(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setStep("upload");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "xlsx") {
      setFile(null);
      setMessage("الصيغة غير مدعومة. استخدم CSV أو XLSX.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setMessage("حجم الملف أكبر من الحد الأقصى 5 ميجابايت.");
      return;
    }

    setFile(selectedFile);
  };

  const handlePreview = () => {
    if (!file) {
      setMessage("اختر ملف المنتجات أولًا.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const payload = new FormData();
      payload.set("file", file);
      const response = await previewManagedProductImportAction(
        tenantId,
        payload,
      );
      if (!response.success || !response.data) {
        setMessage(response.message || "تعذر قراءة الملف.");
        return;
      }

      setPreview(response.data);
      setMapping(
        buildSuggestedMapping(response.data, canMapAvailability),
      );
      setStep("map");
    });
  };

  const handleMappingChange = (
    field: ProductImportField,
    value: string,
  ) => {
    setMessage(null);
    setMapping((current) => {
      const next = { ...current };
      delete next[field];
      if (!value) return next;

      const index = Number(value);
      for (const candidate of PRODUCT_IMPORT_FIELD_OPTIONS) {
        if (candidate.key !== field && next[candidate.key] === index) {
          delete next[candidate.key];
        }
      }
      next[field] = index;
      return next;
    });
  };

  const handleImport = () => {
    if (!file || !preview || mappingError) {
      setMessage(mappingError || "بيانات الاستيراد غير مكتملة.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const payload = new FormData();
      payload.set("file", file);
      payload.set("mapping", JSON.stringify(mapping));
      const response = await importManagedProductSpreadsheetAction(
        tenantId,
        payload,
      );
      if (!response.success || !response.data) {
        setMessage(response.message || "تعذر استيراد المنتجات.");
        return;
      }

      setResult(response.data);
      setStep("result");
      router.refresh();
    });
  };

  const stepNumber =
    step === "upload" ? 1 : step === "map" ? 2 : step === "review" ? 3 : 4;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={resetAndClose}
      title="استيراد منتجات المتجر"
      desktopDialog
      className="sm:max-w-4xl"
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          {step === "upload" ? (
            <>
              <Button variant="outline" onClick={resetAndClose}>
                إلغاء
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!file || isPending}
              >
                {isPending ? "جاري قراءة الملف..." : "متابعة لتعيين الأعمدة"}
              </Button>
            </>
          ) : null}
          {step === "map" ? (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                disabled={isPending}
              >
                السابق
              </Button>
              <Button
                onClick={() => setStep("review")}
                disabled={Boolean(mappingError)}
              >
                مراجعة الاستيراد
              </Button>
            </>
          ) : null}
          {step === "review" ? (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("map")}
                disabled={isPending}
              >
                السابق
              </Button>
              <Button onClick={handleImport} disabled={isPending}>
                {isPending ? "جاري الاستيراد..." : "تأكيد الاستيراد"}
              </Button>
            </>
          ) : null}
          {step === "result" ? (
            <Button onClick={resetAndClose} className="ms-auto">
              إغلاق
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm text-gray-600">
            المتجر: <span className="font-semibold text-gray-900">{tenantName}</span>
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2" aria-label={`الخطوة ${stepNumber} من 4`}>
            {["رفع الملف", "تعيين الأعمدة", "المراجعة", "النتيجة"].map(
              (label, index) => {
                const position = index + 1;
                const isCurrent = position === stepNumber;
                const isComplete = position < stepNumber;
                return (
                  <div key={label} className="space-y-1">
                    <div
                      className={`h-1.5 rounded-full ${
                        isCurrent || isComplete
                          ? "bg-brand-primary"
                          : "bg-gray-200"
                      }`}
                    />
                    <p
                      className={`text-xs ${
                        isCurrent
                          ? "font-semibold text-brand-primary"
                          : "text-gray-500"
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {message ? (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{message}</p>
          </div>
        ) : null}

        {step === "upload" ? (
          <div className="space-y-4">
            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center transition hover:border-brand-accent hover:bg-brand-soft/30">
              <FileSpreadsheet
                className="mx-auto size-10 text-brand-primary"
                aria-hidden="true"
              />
              <span className="mt-3 block font-semibold text-gray-900">
                اختر ملف CSV أو XLSX
              </span>
              <span className="mt-1 block text-sm text-gray-500">
                الحد الأقصى 5 ميجابايت و5,000 صف
              </span>
              <input
                type="file"
                accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0] || null)
                }
              />
            </label>
            {file ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-semibold text-emerald-900">{file.name}</p>
                <p className="mt-1 text-emerald-700">
                  {(file.size / 1024).toFixed(1)} كيلوبايت
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "map" && preview ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              تم العثور على {preview.total_rows} صف
              {preview.sheet_name ? ` في ورقة ${preview.sheet_name}` : ""}.
              راجع التعيين المقترح أو غيّره.
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {visibleFields.map((field) => (
                <label
                  key={field.key}
                  className="space-y-1 rounded-lg border border-gray-200 p-3"
                >
                  <span className="flex items-center gap-1 text-sm font-semibold text-gray-800">
                    {field.label}
                    {field.required ? (
                      <span className="text-red-600" aria-label="مطلوب">
                        *
                      </span>
                    ) : null}
                  </span>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(event) =>
                      handleMappingChange(field.key, event.target.value)
                    }
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                  >
                    <option value="">غير معيّن</option>
                    {preview.columns.map((column) => (
                      <option key={column.index} value={column.index}>
                        {column.label}
                        {column.examples.length > 0
                          ? ` — ${column.examples
                              .map(formatCell)
                              .join("، ")}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {mappingError ? (
              <p className="text-sm text-red-700">{mappingError}</p>
            ) : null}
          </div>
        ) : null}

        {step === "review" && preview ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              سيتم إنشاء المنتجات الجديدة وتحديث المنتجات المطابقة بالاسم.
              القيم الاختيارية الفارغة لن تمسح بيانات المنتجات الموجودة.
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-right text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    {mappedFields.map((field) => (
                      <th key={field.key} className="px-3 py-2">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {preview.sample_rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td className="px-3 py-2 text-gray-500">
                        {rowIndex + 1}
                      </td>
                      {mappedFields.map((field) => (
                        <td key={field.key} className="px-3 py-2 text-gray-800">
                          {formatCell(row[mapping[field.key] as number])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500">
              المعروض أول {preview.sample_rows.length} صف فقط من أصل{" "}
              {preview.total_rows}.
            </p>
          </div>
        ) : null}

        {step === "result" && result ? (
          <div className="space-y-4">
            <div
              className={`flex gap-3 rounded-xl border p-4 ${resultPresentation.containerClassName}`}
            >
              {resultTone === "success" ? (
                <CheckCircle2
                  className={`mt-0.5 size-6 shrink-0 ${resultPresentation.iconClassName}`}
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className={`mt-0.5 size-6 shrink-0 ${resultPresentation.iconClassName}`}
                  aria-hidden="true"
                />
              )}
              <div>
                <h3
                  className={`font-bold ${resultPresentation.titleClassName}`}
                >
                  {resultPresentation.title}
                </h3>
                <p
                  className={`mt-1 text-sm ${resultPresentation.descriptionClassName}`}
                >
                  تم إنشاء {result.created_rows} وتحديث {result.updated_rows} من
                  أصل {result.total_rows} صف.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-2xl font-bold text-gray-900">
                  {result.created_rows}
                </p>
                <p className="text-xs text-gray-500">جديد</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-2xl font-bold text-gray-900">
                  {result.updated_rows}
                </p>
                <p className="text-xs text-gray-500">محدّث</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-2xl font-bold text-red-700">
                  {result.failed_rows}
                </p>
                <p className="text-xs text-gray-500">فشل</p>
              </div>
            </div>

            {result.errors.length > 0 ? (
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  أخطاء الصفوف
                </h3>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-red-200">
                  <ul className="divide-y divide-red-100 bg-red-50 text-sm text-red-800">
                    {result.errors.map((error, index) => (
                      <li
                        key={`${error.row_number}-${error.field}-${index}`}
                        className="px-3 py-2"
                      >
                        صف {error.row_number}: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
