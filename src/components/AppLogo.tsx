import React, { useId } from 'react';
import { APP_NAME } from '../constants';

/**
 * Brand artwork, kept in sync with the SVG masters in `assets/brand/`.
 *
 * The same shapes are exported as flat assets for places React cannot reach:
 *   assets/brand/niqu-logo.svg        -> public/logo.png          (navy, light backgrounds)
 *   assets/brand/niqu-logo-light.svg  -> public/logo-light.png    (light, dark backgrounds)
 *   assets/brand/niqu-icon.svg        -> public/favicon.png, mipmaps/ic_launcher.png, splashes
 *   assets/brand/niqu-icon-round.svg  -> mipmaps/ic_launcher_round.png
 *   assets/brand/niqu-icon-foreground.svg -> mipmaps/ic_launcher_foreground.png (adaptive)
 */

export type LogoVariant = 'navy' | 'light';

interface Gradients {
  /** Unique suffix so two logos on one page never share gradient ids. */
  u: string;
}

const BrassGradients: React.FC<Gradients> = ({ u }) => (
  <defs>
    <linearGradient id={`brass-${u}`} x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stopColor="#F6E1B0" />
      <stop offset="28%" stopColor="#E0BF74" />
      <stop offset="62%" stopColor="#B98F3C" />
      <stop offset="100%" stopColor="#7E5A20" />
    </linearGradient>
    <linearGradient id={`brassLight-${u}`} x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stopColor="#FDF3D8" />
      <stop offset="40%" stopColor="#EBCB8A" />
      <stop offset="100%" stopColor="#A97F33" />
    </linearGradient>
  </defs>
);

/** Twin brass bells, handle and striker sitting on top of the Q. */
const BrassClock: React.FC<Gradients> = ({ u }) => (
  <g>
    <path
      d="M552,166 C562,108 678,108 688,166"
      fill="none"
      stroke={`url(#brassLight-${u})`}
      strokeWidth="16"
      strokeLinecap="round"
    />
    <g transform="translate(542,224) rotate(-18)">
      <path d="M-65,0 A65,58 0 0 1 65,0 Z" fill={`url(#brass-${u})`} stroke="#8A6A2A" strokeWidth="4" />
      <rect x="-70" y="-2" width="140" height="14" rx="7" fill={`url(#brassLight-${u})`} stroke="#8A6A2A" strokeWidth="4" />
      <circle cx="0" cy="-56" r="6.5" fill={`url(#brassLight-${u})`} stroke="#8A6A2A" strokeWidth="3" />
    </g>
    <g transform="translate(698,224) rotate(18)">
      <path d="M-65,0 A65,58 0 0 1 65,0 Z" fill={`url(#brass-${u})`} stroke="#8A6A2A" strokeWidth="4" />
      <rect x="-70" y="-2" width="140" height="14" rx="7" fill={`url(#brassLight-${u})`} stroke="#8A6A2A" strokeWidth="4" />
      <circle cx="0" cy="-56" r="6.5" fill={`url(#brassLight-${u})`} stroke="#8A6A2A" strokeWidth="3" />
    </g>
    <g>
      <circle cx="620" cy="196" r="11" fill={`url(#brassLight-${u})`} stroke="#8A6A2A" strokeWidth="3.5" />
      <rect x="612" y="192" width="16" height="74" rx="7" fill={`url(#brass-${u})`} stroke="#8A6A2A" strokeWidth="3" />
    </g>
  </g>
);

/** The ringing Q: red ring, tail and sound waves. */
const RingingQ: React.FC<{ red: string }> = ({ red }) => (
  <g>
    <g stroke={red} strokeWidth="17" strokeLinecap="round" fill="none">
      <path d="M478,327 A127,127 0 0 0 478,443" />
      <path d="M440,306 A230,230 0 0 0 440,464" />
      <path d="M762,327 A127,127 0 0 1 762,443" />
      <path d="M800,306 A230,230 0 0 1 800,464" />
    </g>
    <circle cx="620" cy="385" r="112" fill="none" stroke={red} strokeWidth="46" />
    <path d="M676,452 L742,552" stroke={red} strokeWidth="44" strokeLinecap="round" fill="none" />
  </g>
);

const useGradientId = () => useId().replace(/[^a-zA-Z0-9]/g, '');

export interface AppLogoProps {
  className?: string;
  /** 'light' letters for dark surfaces (default), 'navy' letters for light surfaces. */
  variant?: LogoVariant;
  title?: string;
}

/** Full "NIQU" wordmark with the alarm clock over the Q. */
export const AppLogo: React.FC<AppLogoProps> = ({ className, variant = 'light', title = APP_NAME }) => {
  const u = useGradientId();
  const letters = variant === 'light' ? '#E9EDF3' : '#2F3B4A';
  const red = variant === 'light' ? '#EC3A33' : '#D0201F';

  return (
    <svg
      viewBox="26 100 1018 488"
      className={className}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>
      <BrassGradients u={u} />
      <g fill={letters}>
        <path d="M40,520 L40,250 L90,250 L186,452 L186,250 L236,250 L236,520 L186,520 L90,318 L90,520 Z" />
        <path d="M288,250 L352,250 L352,520 L288,520 Z" />
        <path d="M830,250 L880,250 L880,420 A50,50 0 0 0 980,420 L980,250 L1030,250 L1030,420 A100,100 0 0 1 830,420 Z" />
      </g>
      <RingingQ red={red} />
      <BrassClock u={u} />
    </svg>
  );
};

export interface AppMarkProps {
  className?: string;
  title?: string;
}

/** Square app-icon mark: the ringing Q on the brand tile. */
export const AppMark: React.FC<AppMarkProps> = ({ className, title = APP_NAME }) => {
  const u = useGradientId();

  return (
    <svg
      viewBox="0 0 1024 1024"
      className={className}
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{title}</title>
      <BrassGradients u={u} />
      <radialGradient id={`tile-${u}`} cx="50%" cy="34%" r="82%">
        <stop offset="0%" stopColor="#252D3B" />
        <stop offset="100%" stopColor="#0E1116" />
      </radialGradient>
      <rect width="1024" height="1024" rx="200" fill={`url(#tile-${u})`} />
      <g transform="translate(-294,64.5) scale(1.3)">
        <RingingQ red="#EC3A33" />
        <BrassClock u={u} />
      </g>
    </svg>
  );
};
