'use client';

import Image from 'next/image';
import { ComponentProps, ReactNode, useMemo, useState } from "react";

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
}: SafeImageProps) {
  const normalizedSrc = useMemo(() => {
    const trimmedSrc = src?.toString().trim();
    return trimmedSrc ? trimmedSrc : null;
  }, [src]);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasError = normalizedSrc !== null && failedSrc === normalizedSrc;

  if (!normalizedSrc || hasError) {
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

  const isAkamaiProtected = typeof normalizedSrc === 'string' && normalizedSrc.includes('cdn.mafrservices.com');
  const isLocalImage = typeof normalizedSrc === 'string' && (normalizedSrc.includes('localhost:') || normalizedSrc.includes('127.0.0.1:'));
  const shouldUnoptimize = unoptimized || isAkamaiProtected || isLocalImage;

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
      onError={() => setFailedSrc(normalizedSrc)}
    />
  );
}
