'use client';

import Image from 'next/image';
import { ComponentProps, ReactNode, useMemo, useState } from "react";
import {
  isAllowedImageSource,
  shouldBypassImageOptimization,
} from "@/lib/image-source-policy";

type SafeImageProps = Omit<ComponentProps<typeof Image>, "src"> & {
	src?: ComponentProps<typeof Image>["src"] | null;
	fallback: ReactNode;
	containerClassName?: string;
  imageClassName?: string;
  draggable?: boolean;
};

export default function SafeImage({
  src,
  alt,
  width,
  height,
  fallback,
  containerClassName,
  imageClassName,
  unoptimized,
  priority,
  sizes,
  loading,
  quality,
  draggable,
  onError,
  ...imageProps
}: SafeImageProps) {
  const normalizedSrc = useMemo(() => {
    if (typeof src !== "string") return src || null;

    const trimmedSrc = src.trim();
    return trimmedSrc || null;
  }, [src]);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const normalizedStringSrc =
    typeof normalizedSrc === "string" ? normalizedSrc : null;
  const hasError =
    normalizedStringSrc !== null && failedSrc === normalizedStringSrc;
  const isAllowedSource =
    normalizedStringSrc === null || isAllowedImageSource(normalizedStringSrc);

  if (!normalizedSrc || hasError || !isAllowedSource) {
    if (containerClassName) {
      return (
        <div className={containerClassName}>
          <span className="sr-only">{alt}</span>
          {fallback}
        </div>
      );
    }

    return (
      <>
        <span className="sr-only">{alt}</span>
        {fallback}
      </>
    );
  }

  const shouldUnoptimize =
    unoptimized ||
    (normalizedStringSrc !== null &&
      shouldBypassImageOptimization(normalizedStringSrc));

  return (
    <Image
      src={normalizedSrc}
      alt={alt}
      width={width}
      height={height}
      className={imageClassName}
      unoptimized={shouldUnoptimize}
      priority={priority}
      sizes={sizes}
      loading={loading}
      quality={quality}
      draggable={draggable}
      onError={(event) => {
        if (normalizedStringSrc) setFailedSrc(normalizedStringSrc);
        onError?.(event);
      }}
      {...imageProps}
    />
  );
}
