/**
 * AmplifyLogo — the one place the product mark is rendered in the New UI.
 *
 * White labeling: the mark is `NEXT_PUBLIC_CUSTOM_LOGO` (a file in `public/logos/`) when one
 * is configured, otherwise the stock Amplify mark, and the alt text / fallback tile use
 * `NEXT_PUBLIC_BRAND_NAME`. See `utils/whiteLabel/branding` and docs/WHITE_LABEL.md. The
 * slot is square, so a square or icon-style logo looks best; a wide logo is scaled to fit
 * (`object-fit: contain`), never stretched.
 *
 * Fallback order: custom logo → stock mark → one-letter tile. A broken-image icon can
 * never show.
 *
 * Two guarantees the bare `<Image src="/amplify-logo.png">` calls did not give:
 *
 *  1. It never goes through the `/_next/image` optimizer (`unoptimized`). The mark is a
 *     static file in `public/`, so the browser fetches it directly. The optimizer is the
 *     only moving part that differs between `next dev` and a production deployment
 *     (sharp, its on-disk cache, a CDN/proxy that doesn't forward `/_next/image`), and
 *     when it failed both the sidebar and the new-chat heading lost their logo at once.
 *
 *  2. A failed image is replaced by the next source, ending in a neutral tile of the same
 *     size and shape. `onError` alone is not enough: an image that fails before React
 *     hydrates never fires it, so the already-failed case (`complete && naturalWidth === 0`)
 *     is checked on mount too.
 */
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  DEFAULT_LOGO_SRC,
  getBrandInitial,
  getBrandName,
  getLogoSources,
} from '@/utils/whiteLabel/branding';

export const AMPLIFY_LOGO_SRC = DEFAULT_LOGO_SRC;

interface AmplifyLogoProps {
  /** Rendered width and height in px (the mark is square). */
  size: number;
  /** Corner radius in px for the image and its fallback. Ignored if `className` rounds it. */
  radius?: number;
  className?: string;
  /** Preload — only for the logo that is visible on first paint (e.g. login). */
  priority?: boolean;
}

export const AmplifyLogo: React.FC<AmplifyLogoProps> = ({
  size,
  radius,
  className,
  priority,
}) => {
  const sources = getLogoSources();
  const brandName = getBrandName();
  // Index of the source being tried; `sources.length` means every image failed.
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const src = sources[attempt];

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setAttempt((n) => n + 1);
  }, [attempt]);

  const style: React.CSSProperties | undefined =
    radius !== undefined ? { borderRadius: radius } : undefined;

  if (src === undefined) {
    return (
      <span
        role="img"
        aria-label={brandName}
        className={`inline-flex flex-shrink-0 items-center justify-center bg-[--accent] text-[--accent-fg] select-none ${className ?? ''}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.round(size * 0.55),
          fontWeight: 600,
          lineHeight: 1,
          ...style,
        }}
      >
        {getBrandInitial(brandName)}
      </span>
    );
  }

  return (
    <Image
      key={src}
      ref={imgRef}
      src={src}
      alt={brandName}
      width={size}
      height={size}
      unoptimized
      priority={priority}
      className={className}
      style={{ objectFit: 'contain', ...style }}
      onError={() => setAttempt((n) => n + 1)}
    />
  );
};

export default AmplifyLogo;
