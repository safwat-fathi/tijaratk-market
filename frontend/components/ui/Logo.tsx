import Image from 'next/image';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  variant?: 'auto' | 'light' | 'dark' | 'icon' | 'icon-light' | 'icon-dark';
  width?: number;
  height?: number;
  priority?: boolean;
};

const HORIZONTAL_SOURCES = {
  light: '/tijaratk-logo-suite/horizontal-logo-light.png',
  dark: '/tijaratk-logo-suite/horizontal-logo-dark.png',
} as const;

const ICON_SOURCES = {
  light: '/tijaratk-logo-suite/app-icon-light.png',
  dark: '/tijaratk-logo-suite/app-icon-dark.png',
} as const;

/**
 * Renders exactly one image.
 *
 * The previous implementation rendered both the light and the dark asset and
 * hid one with `dark:hidden`, which downloads and decodes two files on every
 * page that shows a logo. The app declares `colorScheme: "light"` in the root
 * viewport, so `auto` resolves to the light asset; callers sitting on a dark
 * surface ask for the dark variant explicitly.
 */
export function Logo({
  className,
  variant = 'auto',
  width = 160,
  height = 48,
  priority,
}: LogoProps) {
  const isIcon = variant.startsWith('icon');
  const isDark = variant === 'dark' || variant === 'icon-dark';
  const sources = isIcon ? ICON_SOURCES : HORIZONTAL_SOURCES;

  return (
    <Image
      src={isDark ? sources.dark : sources.light}
      alt={isIcon ? 'أيقونة تطبيق تجارتك' : 'شعار تجارتك'}
      width={width}
      height={height}
      priority={priority}
      className={cn(className)}
    />
  );
}
