import Image from 'next/image';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  variant?: 'auto' | 'light' | 'dark' | 'icon' | 'icon-light' | 'icon-dark';
  width?: number;
  height?: number;
};

export function Logo({ className, variant = 'auto', width = 160, height = 48 }: LogoProps) {
  // 'auto' uses tailwind dark mode classes to swap automatically
  // 'light' forces the logo for light backgrounds (horizontal-logo-light.png)
  // 'dark' forces the logo for dark backgrounds (horizontal-logo-dark.png)
  // 'icon' shows the app icon

  if (variant === 'icon') {
    return (
      <>
        <Image 
          src="/tijaratk-logo-suite/app-icon-light.png" 
          alt="Tijaratk App Icon" 
          width={width} 
          height={height} 
          className={cn("dark:hidden", className)} 
        />
        <Image 
          src="/tijaratk-logo-suite/app-icon-dark.png" 
          alt="Tijaratk App Icon" 
          width={width} 
          height={height} 
          className={cn("hidden dark:block", className)} 
        />
      </>
    );
  }

  if (variant === 'icon-light' || variant === 'icon-dark') {
    return (
      <Image
        src={`/tijaratk-logo-suite/app-icon-${variant === 'icon-light' ? 'light' : 'dark'}.png`}
        alt="Tijaratk App Icon"
        width={width}
        height={height}
        className={className}
      />
    );
  }

  if (variant === 'light') {
    // For light background
    return (
      <Image 
        src="/tijaratk-logo-suite/horizontal-logo-light.png" 
        alt="Tijaratk Logo" 
        width={width} 
        height={height} 
        className={className} 
      />
    );
  }

  if (variant === 'dark') {
    // For dark background
    return (
      <Image 
        src="/tijaratk-logo-suite/horizontal-logo-dark.png" 
        alt="Tijaratk Logo" 
        width={width} 
        height={height} 
        className={className} 
      />
    );
  }

  // 'auto'
  return (
    <>
      <Image 
        src="/tijaratk-logo-suite/horizontal-logo-light.png" 
        alt="Tijaratk Logo" 
        width={width} 
        height={height} 
        className={cn("dark:hidden", className)} 
      />
      <Image 
        src="/tijaratk-logo-suite/horizontal-logo-dark.png" 
        alt="Tijaratk Logo" 
        width={width} 
        height={height} 
        className={cn("hidden dark:block", className)} 
      />
    </>
  );
}
