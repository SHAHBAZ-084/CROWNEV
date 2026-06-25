import { Link } from 'react-router-dom';
import { SITE_LOGO } from '../../lib/placeholders';

type LogoProps = {
  /** sm = navbar, md = sidebar, lg = footer / auth */
  size?: 'sm' | 'md' | 'lg';
  /** Wrap in home link */
  linked?: boolean;
  /** Center logo (sidebar / auth) */
  centered?: boolean;
  className?: string;
};

const sizeClass = {
  sm: 'h-14 w-auto max-w-[220px] sm:h-16 sm:max-w-[260px] lg:h-[4.5rem] lg:max-w-[300px]',
  md: 'h-[5.5rem] w-auto max-w-[300px] lg:h-[7rem] lg:max-w-[340px]',
  lg: 'h-20 w-auto max-w-[320px] lg:h-24 lg:max-w-[380px]',
} as const;

export function Logo({ size = 'sm', linked = false, centered = false, className = '' }: LogoProps) {
  const img = (
    <picture>
      <source srcSet={SITE_LOGO.srcLarge} media="(min-width: 1024px)" type="image/webp" />
      <img
        src={SITE_LOGO.src}
        alt={SITE_LOGO.alt}
        width={SITE_LOGO.width}
        height={SITE_LOGO.height}
        decoding="async"
        className={`object-contain ${centered ? 'object-center' : 'object-left'} ${sizeClass[size]} ${className}`}
      />
    </picture>
  );

  if (linked) {
    return (
      <Link to="/" className={`inline-flex shrink-0 items-center ${centered ? 'justify-center' : ''}`}>
        {img}
      </Link>
    );
  }

  return img;
}
