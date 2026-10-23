/**
 * AmplifyLogo — the one place the Amplify mark is rendered in the New UI.
 *
 * Two guarantees the bare `<Image src="/amplify-logo.png">` calls did not give:
 *
 *  1. It never goes through the `/_next/image` optimizer (`unoptimized`). The mark is a
 *     static file in `public/`, so the browser fetches it directly. The optimizer is the
 *     only moving part that differs between `next dev` and a production deployment
 *     (sharp, its on-disk cache, a CDN/proxy that doesn't forward `/_next/image`), and
 *     when it failed both the sidebar and the new-chat heading lost their logo at once.
 *
 *  2. A broken-image icon can never show. If the file fails to load, a neutral "A" tile
 *     of the same size and shape is rendered instead. `onError` alone is not enough:
 *     an image that fails before React hydrates never fires it, so the already-failed
 *     case (`complete && naturalWidth === 0`) is checked on mount too.
 */
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export const AMPLIFY_LOGO_SRC = '/amplify-logo.png';

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
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  const style: React.CSSProperties | undefined =
    radius !== undefined ? { borderRadius: radius } : undefined;

  if (failed) {
    return (
      <span
        role="img"
        aria-label="Amplify"
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
        A
      </span>
    );
  }

  return (
    <Image
      ref={imgRef}
      src={AMPLIFY_LOGO_SRC}
      alt="Amplify"
      width={size}
      height={size}
      unoptimized
      priority={priority}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
};

export default AmplifyLogo;
