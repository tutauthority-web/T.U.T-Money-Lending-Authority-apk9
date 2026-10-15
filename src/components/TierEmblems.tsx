/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';

interface EmblemProps {
  className?: string;
  size?: number;
}

/**
 * Sovereign Gold Tier Emblem - Bespoke 8-point guilloche star & imperial sovereign crest
 */
export const GoldTierEmblem: React.FC<EmblemProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
  >
    <defs>
      <linearGradient id="goldOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="35%" stopColor="#F59E0B" />
        <stop offset="70%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#92400E" />
      </linearGradient>
      <linearGradient id="goldInnerGrad" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="40%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <radialGradient id="goldCenterGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.9" />
        <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#B45309" stopOpacity="0" />
      </radialGradient>
    </defs>
    {/* Outer subtle glow */}
    <circle cx="24" cy="24" r="22" fill="url(#goldCenterGlow)" />
    {/* Precision concentric rings */}
    <circle cx="24" cy="24" r="21" stroke="url(#goldOuterGrad)" strokeWidth="1.2" strokeDasharray="1.5 1.5" opacity="0.75" />
    <circle cx="24" cy="24" r="19" stroke="url(#goldOuterGrad)" strokeWidth="1.2" />
    <circle cx="24" cy="24" r="17.2" stroke="url(#goldOuterGrad)" strokeWidth="0.6" opacity="0.6" />
    {/* 8-Pointed Sovereign Star */}
    <path
      d="M24 6L26.8 17.2L38 14L30.8 23.2L38 32.4L26.8 29.2L24 40.4L21.2 29.2L10 32.4L17.2 23.2L10 14L21.2 17.2Z"
      fill="url(#goldOuterGrad)"
      opacity="0.3"
    />
    <path
      d="M24 9.5L25.9 18.1L34.5 15.5L29 22.5L34.5 29.5L25.9 26.9L24 35.5L22.1 26.9L13.5 29.5L19 22.5L13.5 15.5L22.1 18.1Z"
      stroke="url(#goldInnerGrad)"
      strokeWidth="1.2"
      fill="none"
    />
    {/* Inner Sovereign Shield with Crown Geometry */}
    <path
      d="M24 16L30 19V25C30 28.5 27.5 31.5 24 32.5C20.5 31.5 18 28.5 18 25V19L24 16Z"
      fill="#1C1405"
      stroke="url(#goldInnerGrad)"
      strokeWidth="1.4"
    />
    {/* Crown Monogram Linework */}
    <path
      d="M20.5 24.5L21.8 21.5L24 23L26.2 21.5L27.5 24.5H20.5Z"
      fill="url(#goldInnerGrad)"
    />
    <circle cx="21.8" cy="20.8" r="0.7" fill="#FFFBEB" />
    <circle cx="24" cy="20.2" r="0.8" fill="#FFFBEB" />
    <circle cx="26.2" cy="20.8" r="0.7" fill="#FFFBEB" />
    <rect x="20.5" y="25.2" width="7" height="1" rx="0.5" fill="url(#goldInnerGrad)" />
  </svg>
);

/**
 * Executive Silver Tier Emblem - Architectural precision titanium/rhodium hexagon & faceted star
 */
export const SilverTierEmblem: React.FC<EmblemProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
  >
    <defs>
      <linearGradient id="silverOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="40%" stopColor="#E2E8F0" />
        <stop offset="70%" stopColor="#94A3B8" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>
      <linearGradient id="silverInnerGrad" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#F8FAFC" />
        <stop offset="50%" stopColor="#CBD5E1" />
        <stop offset="100%" stopColor="#64748B" />
      </linearGradient>
      <radialGradient id="silverCenterGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#F8FAFC" stopOpacity="0.8" />
        <stop offset="70%" stopColor="#94A3B8" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#475569" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="url(#silverCenterGlow)" />
    <circle cx="24" cy="24" r="21" stroke="url(#silverOuterGrad)" strokeWidth="1.2" opacity="0.6" strokeDasharray="2 2" />
    {/* Hexagonal Precision Framework */}
    <path
      d="M24 5L39.5 14V32L24 41L8.5 32V14L24 5Z"
      stroke="url(#silverOuterGrad)"
      strokeWidth="1.3"
      fill="none"
    />
    <path
      d="M24 9L36 16V30L24 37L12 30V16L24 9Z"
      stroke="url(#silverInnerGrad)"
      strokeWidth="0.8"
      strokeDasharray="1 1.5"
      fill="#0B1322"
      fillOpacity="0.6"
    />
    {/* Rhodium Diamond Core */}
    <path
      d="M24 13L32 23.5L24 34L16 23.5L24 13Z"
      fill="url(#silverOuterGrad)"
      fillOpacity="0.25"
      stroke="url(#silverOuterGrad)"
      strokeWidth="1.2"
    />
    {/* Polished Facet Refraction Lines */}
    <path d="M24 13V34 M16 23.5H32 M24 18L28.5 23.5L24 29L19.5 23.5Z" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.9" />
    <circle cx="24" cy="23.5" r="1.5" fill="#FFFFFF" />
  </svg>
);

/**
 * Bronze Basic Tier Emblem - Classic architectural vault medallion matching the basic dark card
 */
export const BronzeTierEmblem: React.FC<EmblemProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
  >
    <defs>
      <linearGradient id="bronzeOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#93C5FD" />
        <stop offset="40%" stopColor="#60A5FA" />
        <stop offset="75%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1E3A8A" />
      </linearGradient>
      <linearGradient id="bronzeInnerGrad" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#DBEAFE" />
        <stop offset="50%" stopColor="#93C5FD" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
      <radialGradient id="bronzeCenterGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.4" />
        <stop offset="70%" stopColor="#1E3A8A" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#0B132B" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="url(#bronzeCenterGlow)" />
    {/* Clean Precision Medallion Bezel */}
    <circle cx="24" cy="24" r="21" stroke="url(#bronzeOuterGrad)" strokeWidth="1.2" opacity="0.8" />
    <circle cx="24" cy="24" r="18.5" stroke="url(#bronzeOuterGrad)" strokeWidth="0.8" strokeDasharray="1.5 2" opacity="0.6" />
    <circle cx="24" cy="24" r="16.5" fill="#070D1E" stroke="url(#bronzeInnerGrad)" strokeWidth="1.1" />
    {/* Architectural Classical Column / Vault Gate Monogram */}
    {/* Capital */}
    <path
      d="M17.5 16H30.5V18.5C29 18.5 28.5 19.5 28.5 20H19.5C19.5 19.5 19 18.5 17.5 18.5V16Z"
      fill="url(#bronzeOuterGrad)"
      stroke="url(#bronzeInnerGrad)"
      strokeWidth="0.7"
    />
    {/* Twin Scrolls */}
    <circle cx="18" cy="18" r="1.3" fill="#DBEAFE" />
    <circle cx="30" cy="18" r="1.3" fill="#DBEAFE" />
    {/* Fluted Pillars */}
    <rect x="20" y="20.5" width="2" height="8.5" rx="0.4" fill="url(#bronzeOuterGrad)" />
    <rect x="23" y="20.5" width="2" height="8.5" rx="0.4" fill="#DBEAFE" />
    <rect x="26" y="20.5" width="2" height="8.5" rx="0.4" fill="url(#bronzeOuterGrad)" />
    {/* Base Plinth */}
    <path
      d="M18 29.5H30V32H18V29.5Z"
      fill="url(#bronzeOuterGrad)"
      stroke="url(#bronzeInnerGrad)"
      strokeWidth="0.8"
    />
  </svg>
);

/**
 * Standard Reserve Tier Emblem - Clean classical Treasury Portico in steel-blue obsidian
 */
export const StandardTierEmblem: React.FC<EmblemProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline-block shrink-0 ${className}`}
  >
    <defs>
      <linearGradient id="stdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#93C5FD" />
        <stop offset="50%" stopColor="#3B82F6" />
        <stop offset="100%" stopColor="#1E3A8A" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="21" stroke="url(#stdGrad)" strokeWidth="1.2" opacity="0.6" strokeDasharray="2 2" />
    <circle cx="24" cy="24" r="18" fill="#080F24" stroke="url(#stdGrad)" strokeWidth="1" />
    {/* Classical Pediment & Columns */}
    <path d="M24 14L16 19H32L24 14Z" fill="url(#stdGrad)" />
    <rect x="18" y="20.5" width="2" height="8" rx="0.4" fill="url(#stdGrad)" />
    <rect x="21" y="20.5" width="2" height="8" rx="0.4" fill="#BFDBFE" />
    <rect x="25" y="20.5" width="2" height="8" rx="0.4" fill="#BFDBFE" />
    <rect x="28" y="20.5" width="2" height="8" rx="0.4" fill="url(#stdGrad)" />
    <rect x="15.5" y="29.5" width="17" height="2" rx="0.5" fill="url(#stdGrad)" />
  </svg>
);

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
