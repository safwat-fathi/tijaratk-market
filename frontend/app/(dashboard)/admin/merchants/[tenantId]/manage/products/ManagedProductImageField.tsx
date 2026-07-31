"use client";

import { useEffect, useState } from "react";
import ImageThumbnail from "@/components/ui/ImageThumbnail";
import {
  hasAllowedProductImageFormat,
  resolveImageUrl,
} from "@/app/(dashboard)/merchant/(features)/products/new/_utils/product-onboarding";
import {
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
  MAX_PRODUCT_IMAGE_SIZE_MB,
} from "@/app/(dashboard)/merchant/(features)/products/new/_utils/product-onboarding.constants";

type ManagedProductImageFieldProps = {
  /** Stored image of the product being edited. Omit on the create form. */
  currentImageUrl?: string | null;
};

/**
 * Product image picker shared by the managed add and edit forms. Validates size
 * and format locally so oversized uploads fail before hitting the server action
 * body limit.
 */
export default function ManagedProductImageField({
  currentImageUrl,
}: ManagedProductImageFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storedImageUrl = resolveImageUrl(currentImageUrl);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setError(null);

    if (selectedFile && selectedFile.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      setPreview(null);
      event.target.value = "";
      setError(
        `حجم الصورة كبير. الحد الأقصى ${MAX_PRODUCT_IMAGE_SIZE_MB} ميجابايت.`,
      );
      return;
    }

    if (selectedFile && !hasAllowedProductImageFormat(selectedFile)) {
      setPreview(null);
      event.target.value = "";
      setError(
        "صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP أو HEIC أو HEIF.",
      );
      return;
    }

    setPreview(selectedFile ? URL.createObjectURL(selectedFile) : null);
  };

  const shownImageUrl = preview || storedImageUrl;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">صورة المنتج</label>

      {shownImageUrl ? (
        <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50/60 p-3">
          <ImageThumbnail
            src={shownImageUrl}
            alt="صورة المنتج"
            width={48}
            height={48}
            sizes="48px"
            disableEnlarge={true}
            imageClassName="h-12 w-12 rounded-md object-cover ring-1 ring-gray-200"
            fallback={
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-sm">
                🛒
              </span>
            }
          />
          {storedImageUrl && !preview ? (
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                name="clear_image"
                type="checkbox"
                value="true"
                className="h-4 w-4 rounded border-gray-300"
              />
              إزالة الصورة الحالية
            </label>
          ) : (
            <span className="text-xs text-gray-500">
              {preview ? "سيتم حفظ هذه الصورة" : null}
            </span>
          )}
        </div>
      ) : null}

      <input
        name="file"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleChange}
        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 file:ms-3 file:rounded-md file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white"
      />
      <p className="text-xs text-gray-500">
        JPG أو PNG أو WEBP أو HEIC حتى {MAX_PRODUCT_IMAGE_SIZE_MB} ميجابايت.
      </p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
