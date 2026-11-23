/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useId } from 'react';

interface EmblemProps {
  className?: string;
  size?: number;
}

/**
 * Sovereign Gold Tier Emblem - 18K Satin Champagne Bullion Guilloche & Sovereign Crest
 */
export const GoldTierEmblem: React.FC<EmblemProps> = ({ className = '', size = 24 }) => {
  const uid = useId().replace(/:/g, '');
  const outerId = `goldOuter-${uid}`;
  const innerId = `goldInner-${uid}`;
  const glowId = `goldGlow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={outerId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FAF0D7" />
          <stop offset="35%" stopColor="#DFC07C" />
          <stop offset="70%" stopColor="#B89246" />
          <stop offset="100%" stopColor="#7C5E24" />
        </linearGradient>
        <linearGradient id={innerId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="45%" stopColor="#E6CC91" />
          <stop offset="100%" stopColor="#9C7834" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F5E6C4" stopOpacity="0.45" />
          <stop offset="65%" stopColor="#C49F54" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#7C5E24" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${glowId})`} />
      <circle cx="24" cy="24" r="20.5" stroke={`url(#${outerId})`} strokeWidth="1" opacity="0.7" />
      <circle cx="24" cy="24" r="18.2" stroke={`url(#${outerId})`} strokeWidth="0.6" strokeDasharray="1.5 2" opacity="0.55" />
      {/* 8-Pointed Precision Compass Star */}
      <path
        d="M24 7L26.5 17.5L37 15L30.2 23.2L37 31.4L26.5 28.9L24 39.4L21.5 28.9L11 31.4L17.8 23.2L11 15L21.5 17.5Z"
        fill={`url(#${outerId})`}
        opacity="0.22"
      />
      <path
        d="M24 10L25.8 18.2L34 15.8L28.8 22.8L34 29.8L25.8 27.4L24 35.6L22.2 27.4L14 29.8L19.2 22.8L14 15.8L22.2 18.2Z"
        stroke={`url(#${innerId})`}
        strokeWidth="1"
        fill="none"
      />
      {/* Sovereign Shield with Crown */}
      <path
        d="M24 15.5L30.2 18.6V24.8C30.2 28.4 27.6 31.4 24 32.5C20.4 31.4 17.8 28.4 17.8 24.8V18.6L24 15.5Z"
        fill="#16130D"
        stroke={`url(#${innerId})`}
        strokeWidth="1.25"
      />
      <path
        d="M20.4 24.5L21.7 21.4L24 23L26.3 21.4L27.6 24.5H20.4Z"
        fill={`url(#${innerId})`}
      />
      <circle cx="21.7" cy="20.6" r="0.65" fill="#FAF0D7" />
      <circle cx="24" cy="20" r="0.75" fill="#FAF0D7" />
      <circle cx="26.3" cy="20.6" r="0.65" fill="#FAF0D7" />
      <rect x="20.4" y="25.3" width="7.2" height="1" rx="0.5" fill={`url(#${innerId})`} />
    </svg>
  );
};

/**
 * Executive Silver Tier Emblem - Brushed Rhodium Hexagon & Faceted Prism
 */
export const SilverTierEmblem: React.FC<EmblemProps> = ({ className = '', size = 24 }) => {
  const uid = useId().replace(/:/g, '');
  const outerId = `silverOuter-${uid}`;
  const innerId = `silverInner-${uid}`;
  const glowId = `silverGlow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={outerId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#E2E8F0" />
          <stop offset="75%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id={innerId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="50%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F8FAFC" stopOpacity="0.45" />
          <stop offset="70%" stopColor="#94A3B8" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#475569" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${glowId})`} />
      <circle cx="24" cy="24" r="20.5" stroke={`url(#${outerId})`} strokeWidth="1" opacity="0.55" strokeDasharray="2 2" />
      <path
        d="M24 6L38.8 14.5V31.5L24 40L9.2 31.5V14.5L24 6Z"
        stroke={`url(#${outerId})`}
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M24 9.5L35.5 16.2V29.8L24 36.5L12.5 29.8V16.2L24 9.5Z"
        stroke={`url(#${innerId})`}
        strokeWidth="0.75"
        fill="#0F1521"
        fillOpacity="0.7"
      />
      <path
        d="M24 13.5L31.5 23.5L24 33.5L16.5 23.5L24 13.5Z"
        fill={`url(#${outerId})`}
        fillOpacity="0.22"
        stroke={`url(#${outerId})`}
        strokeWidth="1.15"
      />
      <path d="M24 13.5V33.5 M16.5 23.5H31.5 M24 18.2L28.2 23.5L24 28.8L19.8 23.5Z" stroke="#FFFFFF" strokeWidth="0.75" opacity="0.85" />
      <circle cx="24" cy="23.5" r="1.4" fill="#FFFFFF" />
    </svg>
  );
};

/**
 * Bronze Tier Emblem - Warm Burnished Copper Medallion
 */
export const BronzeTierEmblem: React.FC<EmblemProps> = ({ className = '', size = 24 }) => {
  const uid = useId().replace(/:/g, '');
  const outerId = `bronzeOuter-${uid}`;
  const innerId = `bronzeInner-${uid}`;
  const glowId = `bronzeGlow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={outerId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F2D2B8" />
          <stop offset="40%" stopColor="#D39D73" />
          <stop offset="75%" stopColor="#A66D44" />
          <stop offset="100%" stopColor="#6D4123" />
        </linearGradient>
        <linearGradient id={innerId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FAE5D3" />
          <stop offset="50%" stopColor="#CFA07A" />
          <stop offset="100%" stopColor="#85512F" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#D39D73" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#85512F" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#16100C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${glowId})`} />
      <circle cx="24" cy="24" r="20.5" stroke={`url(#${outerId})`} strokeWidth="1.1" opacity="0.75" />
      <circle cx="24" cy="24" r="18" stroke={`url(#${outerId})`} strokeWidth="0.7" strokeDasharray="1.5 2" opacity="0.55" />
      <circle cx="24" cy="24" r="16" fill="#16110E" stroke={`url(#${innerId})`} strokeWidth="1" />
      <path
        d="M17.5 16.5H30.5V18.8C29.2 18.8 28.6 19.6 28.6 20.2H19.4C19.4 19.6 18.8 18.8 17.5 18.8V16.5Z"
        fill={`url(#${outerId})`}
      />
      <rect x="20" y="20.6" width="2" height="8.2" rx="0.4" fill={`url(#${outerId})`} />
      <rect x="23" y="20.6" width="2" height="8.2" rx="0.4" fill="#F2D2B8" />
      <rect x="26" y="20.6" width="2" height="8.2" rx="0.4" fill={`url(#${outerId})`} />
      <path d="M18 29.4H30V31.6H18V29.4Z" fill={`url(#${outerId})`} />
    </svg>
  );
};

/**
 * Standard Reserve Tier Emblem - Clean Private-Bank Steel Portico
 */
export const StandardTierEmblem: React.FC<EmblemProps> = ({ className = '', size = 24 }) => {
  const uid = useId().replace(/:/g, '');
  const stdId = `stdGrad-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={stdId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="50%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20.5" stroke={`url(#${stdId})`} strokeWidth="1" opacity="0.55" strokeDasharray="2 2" />
      <circle cx="24" cy="24" r="17.5" fill="#0B1222" stroke={`url(#${stdId})`} strokeWidth="1" />
      <path d="M24 14.2L16.2 19H31.8L24 14.2Z" fill={`url(#${stdId})`} />
      <rect x="18.2" y="20.4" width="2" height="8" rx="0.4" fill={`url(#${stdId})`} />
      <rect x="21.2" y="20.4" width="2" height="8" rx="0.4" fill="#BFDBFE" />
      <rect x="24.8" y="20.4" width="2" height="8" rx="0.4" fill="#BFDBFE" />
      <rect x="27.8" y="20.4" width="2" height="8" rx="0.4" fill={`url(#${stdId})`} />
      <rect x="15.8" y="29.4" width="16.4" height="2" rx="0.5" fill={`url(#${stdId})`} />
    </svg>
  );
};

/**
 * Dynamic Tier Emblem Dispatcher
 */
export const TierEmblem: React.FC<{
  tier?: 'gold' | 'silver' | 'bronze' | 'standard' | string | null;
  className?: string;
  size?: number;
}> = ({ tier, className = '', size = 24 }) => {
  const norm = (tier || 'standard').toLowerCase();
  if (norm === 'gold') return <GoldTierEmblem className={className} size={size} />;
  if (norm === 'silver') return <SilverTierEmblem className={className} size={size} />;
  if (norm === 'bronze') return <BronzeTierEmblem className={className} size={size} />;
  return <StandardTierEmblem className={className} size={size} />;
};
