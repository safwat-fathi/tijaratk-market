'use client';

import { ComponentProps, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SafeImage from './SafeImage';

type ImageThumbnailProps = ComponentProps<typeof SafeImage> & {
  thumbnailWrapperClassName?: string;
};

export default function ImageThumbnail({ thumbnailWrapperClassName, ...props }: ImageThumbnailProps) {
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isEnlarged) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isEnlarged]);

  const hasValidSrc = typeof props.src === 'string' && props.src.trim().length > 0;

  return (
    <>
      <div 
        role={hasValidSrc ? 'button' : undefined}
        tabIndex={hasValidSrc ? 0 : undefined}
        onClick={(e) => {
          if (hasValidSrc) {
            e.preventDefault();
            e.stopPropagation();
            setIsEnlarged(true);
          }
        }}
        onKeyDown={(e) => {
          if (hasValidSrc && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            e.stopPropagation();
            setIsEnlarged(true);
          }
        }}
        className={`relative inline-block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${hasValidSrc ? 'cursor-zoom-in' : 'cursor-default'} ${thumbnailWrapperClassName || ''}`}
      >
        <SafeImage {...props} />
      </div>

      {mounted && isEnlarged && hasValidSrc && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm transition-all"
          onClick={(e) => {
            e.stopPropagation();
            setIsEnlarged(false);
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEnlarged(false);
            }}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/20"
            aria-label="إغلاق"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
          <img
            src={props.src as string}
            alt={props.alt || ''}
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
}
