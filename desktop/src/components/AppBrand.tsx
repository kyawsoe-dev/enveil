'use client';

import { cn } from '@/lib/utils';
import {
  APP_LOGO_MARK_SRC,
  APP_LOGO_MARK_SRC_SET,
  APP_LOGO_SRC,
  APP_LOGO_SRC_SET,
  APP_NAME,
  brandWordmarkClass,
} from '@/lib/brand';

type LogoVariant = 'full' | 'mark';
type BrandContext = 'sidebar' | 'auth' | 'default';

const LOGO_PX: Record<string, number> = {
  'h-6': 24,
  'h-7': 28,
  'h-8': 32,
  'h-9': 36,
  'h-10': 40,
  'h-11': 44,
  'h-12': 48,
  'h-14': 56,
  'h-16': 64,
  'h-20': 80,
  'h-24': 96,
  'h-28': 112,
  'h-32': 128,
  'h-40': 160,
  'h-44': 176,
  'h-48': 192,
  'h-52': 208,
};

function parseLogoPx(className: string): number {
  for (const [token, px] of Object.entries(LOGO_PX)) {
    if (className.includes(token)) return px;
  }
  return 32;
}

export function AppBrand({
  logoClassName = 'h-8 w-8',
  textClassName,
  showText = true,
  variant = 'mark',
  context = 'default',
}: {
  logoClassName?: string;
  textClassName?: string;
  showText?: boolean;
  variant?: LogoVariant;
  context?: BrandContext;
}) {
  const px = parseLogoPx(logoClassName);
  const isMark = variant === 'mark';
  const src = isMark ? APP_LOGO_MARK_SRC : APP_LOGO_SRC;
  const srcSet = isMark ? APP_LOGO_MARK_SRC_SET : APP_LOGO_SRC_SET;

  const textColorClass =
    context === 'sidebar'
      ? 'text-sidebar-foreground'
      : context === 'auth'
        ? 'text-foreground'
        : 'text-foreground';

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={cn(
          'shrink-0 overflow-hidden rounded-md ring-1 transition-[box-shadow,filter] duration-200',
          context === 'sidebar' ? 'ring-sidebar-muted' : 'ring-border/50',
          'shadow-sm shadow-black/5 dark:brightness-[1.08] dark:contrast-[1.04] dark:saturate-[1.05] dark:shadow-black/25',
          logoClassName,
        )}
      >
        <img
          src={src}
          srcSet={srcSet}
          sizes={`${px}px`}
          alt={APP_NAME}
          width={px}
          height={px}
          decoding="async"
          draggable={false}
          className="h-full w-full object-contain"
        />
      </div>
      {showText && (
        <span
          className={cn(
            brandWordmarkClass,
            textColorClass,
            'truncate text-sm transition-colors duration-200',
            textClassName,
          )}
        >
          {APP_NAME}
        </span>
      )}
    </div>
  );
}
