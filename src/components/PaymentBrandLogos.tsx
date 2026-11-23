import React from 'react';
import { cn } from '../App';

interface BrandLogoProps {
  variant?: 'icon' | 'badge' | 'horizontal';
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<BrandLogoProps['size']>, string> = {
  xs: 'w-5 h-5',
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
};

/**
 * Authentic faceted geometric origami bird mark matching bKash branding.
 * Sits cleanly on crisp light or dark surfaces.
 */
export const BkashMarkSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('shrink-0', className)}
    aria-label="bKash Logo"
  >
    {/* Back / upper primary wing */}
    <path d="M31 18L76 47L53 60L31 18Z" fill="#E2136E" />
    {/* Outer left wing fold */}
    <path d="M13 38L53 60L31 18L13 38Z" fill="#C40D5D" />
    {/* Lower wing belly facet */}
    <path d="M53 60L76 47L66 79L39 74L53 60Z" fill="#B50A55" />
    {/* Neck & upper chest triangle */}
    <path d="M76 47L93 36L82 59L66 79L76 47Z" fill="#E2136E" />
    {/* Head & sharp origami beak facing right */}
    <path d="M93 36L110 40L97 49L82 59L93 36Z" fill="#D11064" />
    {/* Lower tail ribbon fold */}
    <path d="M39 74L66 79L44 103L39 74Z" fill="#E2136E" />
    {/* Subtle origami highlight edge */}
    <path d="M53 60L76 47L64 56L53 60Z" fill="#F466A4" fillOpacity="0.45" />
  </svg>
);

/**
 * Authentic dual-ribbon emblem matching Nagad branding (#F6921E / #ED1C24).
 */
export const NagadMarkSVG: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn('shrink-0', className)}
    aria-label="Nagad Logo"
  >
    <defs>
      <linearGradient id="nagadGradA" x1="20" y1="95" x2="96" y2="25" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ED1C24" />
        <stop offset="55%" stopColor="#F15A22" />
        <stop offset="100%" stopColor="#F6921E" />
      </linearGradient>
      <linearGradient id="nagadGradB" x1="30" y1="20" x2="92" y2="85" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F9A51A" />
        <stop offset="100%" stopColor="#ED1C24" />
      </linearGradient>
    </defs>
    {/* Outer circular arc seal */}
    <path
      d="M60 15C84.85 15 105 35.15 105 60C105 84.85 84.85 105 60 105C35.15 105 15 84.85 15 60C15 44.8 22.55 31.35 34.1 23.2"
      stroke="url(#nagadGradA)"
      strokeWidth="9"
      strokeLinecap="round"
    />
    {/* Dynamic rising inner flame / stylized Bengali curve */}
    <path
      d="M36 74C38 56 49 41 67 33C60 45 58 55 62 63C66 53 74 47 84 44C77 56 77 67 83 76C72 72 63 72 54 78C46 83 39 81 36 74Z"
      fill="url(#nagadGradB)"
    />
    {/* Top floating accent spark circle */}
    <circle cx="48" cy="30" r="6.5" fill="#F6921E" />
  </svg>
);

export const BkashLogo: React.FC<BrandLogoProps> = ({
  variant = 'badge',
  className,
  size = 'md',
}) => {
  if (variant === 'icon') {
    return <BkashMarkSVG className={cn(SIZE_CLASSES[size], className)} />;
  }

  if (variant === 'horizontal') {
    return (
      <div className={cn('inline-flex items-center gap-2 shrink-0', className)}>
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center p-1 shadow-sm border border-pink-200/60">
          <BkashMarkSVG className="w-full h-full" />
        </div>
        <div className="flex flex-col leading-none text-left">
          <span className="text-[13px] font-black tracking-tight text-white">
            b<span className="text-[#FF4F9A]">Kash</span>
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-pink-300/80 mt-0.5">
            Mobile Wallet
          </span>
        </div>
      </div>
    );
  }

  // 'badge' default — clean crisp white squircle housing the real magenta origami bird
  return (
    <div
      className={cn(
        'rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm border border-pink-200/70 shrink-0',
        SIZE_CLASSES[size],
        className
      )}
    >
      <BkashMarkSVG className="w-full h-full" />
    </div>
  );
};

export const NagadLogo: React.FC<BrandLogoProps> = ({
  variant = 'badge',
  className,
  size = 'md',
}) => {
  if (variant === 'icon') {
    return <NagadMarkSVG className={cn(SIZE_CLASSES[size], className)} />;
  }

  if (variant === 'horizontal') {
    return (
      <div className={cn('inline-flex items-center gap-2 shrink-0', className)}>
        <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center p-1 shadow-sm border border-orange-200/60">
          <NagadMarkSVG className="w-full h-full" />
        </div>
        <div className="flex flex-col leading-none text-left">
          <span className="text-[13px] font-black tracking-tight text-white">
            Na<span className="text-[#F6921E]">gad</span>
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-orange-300/80 mt-0.5">
            Digital Financial
          </span>
        </div>
      </div>
    );
  }

  // 'badge' default — clean white squircle housing the authentic Nagad emblem
  return (
    <div
      className={cn(
        'rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm border border-orange-200/70 shrink-0',
        SIZE_CLASSES[size],
        className
      )}
    >
      <NagadMarkSVG className="w-full h-full" />
    </div>
  );
};
