/**
 * ThanksgivingHero — seasonal replacement for the NewHome greeting.
 *
 * Renders Tom Fabre's pilgrim turkey as the logo, a warm serif headline,
 * three layers of Lisa Paton's falling maple leaves, a warm glow, and Bashir
 * Ahmad's turkey strutting along the bottom of the pane. Animations are Lottie
 * files loaded lazily (see thanksgivingLottie.ts).
 *
 * Decorations are pointer-events: none so the composer stays usable. Under
 * prefers-reduced-motion the turkey and leaves show as still frames and the
 * walking turkey is hidden.
 */
import React, { useEffect, useRef } from 'react';
import type { AnimationItem } from 'lottie-web';
import {
  mountAnimation,
  preloadThanksgivingAssets,
  type MountOptions,
  type ThanksgivingAnimation,
} from '@/components/NewUI/home/thanksgivingLottie';

export const THANKSGIVING_PLACEHOLDER = "Ask anything… there's always room for seconds 🥧";

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Mounts one Lottie animation into a div for the lifetime of the component. */
const Lottie = ({
  name,
  className,
  style,
  options,
  stillFrame,
  label,
}: {
  name: ThanksgivingAnimation;
  className?: string;
  style?: React.CSSProperties;
  options?: MountOptions;
  /** Frame to hold when the user prefers reduced motion. */
  stillFrame: number;
  label?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    let anim: AnimationItem | null = null;
    const opts = prefersReducedMotion() ? { stillFrame } : options;
    void mountAnimation(el, name, opts, () => cancelled).then((a) => {
      if (cancelled) a?.destroy();
      else anim = a;
    });
    return () => {
      cancelled = true;
      anim?.destroy();
    };
    // Options are static per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return (
    <div
      ref={ref}
      className={className}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
};

/** Bashir Ahmad's turkey strutting along the bottom: turns at each edge, pauses now and then to peck. */
const WalkingTurkey = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const pane = el?.parentElement;
    if (!el || !pane || prefersReducedMotion()) return;
    const SIZE = 110;
    let x = 24;
    let dir = 1;
    let pause = 0;
    let last = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      const max = Math.max(0, pane.clientWidth - SIZE);
      if (pause > 0) pause -= dt;
      else {
        x += dir * dt * 0.05;
        if (x >= max) { x = max; dir = -1; pause = 900; }
        if (x <= 0) { x = 0; dir = 1; pause = 900; }
        if (Math.random() < 0.0012) pause = 1400;
      }
      el.style.transform = `translateX(${x}px) scaleX(${dir})`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div ref={ref} className="tg-walker">
      <Lottie name="turkey-walking" className="tg-fill" stillFrame={0} />
    </div>
  );
};

/** Absolutely-positioned decorations that fill the landing pane. */
export const ThanksgivingBackdrop = () => {
  useEffect(() => {
    // Warm the cache so the leaf gust can start the instant the user sends.
    preloadThanksgivingAssets();
  }, []);
  return (
    <div className="tg-backdrop" aria-hidden="true">
      <ThanksgivingStyles />
      <div className="tg-glow" />
      <Lottie name="falling-leaves" className="tg-leaves tg-leaves-1" options={{ startFrame: 60, speed: 0.8 }} stillFrame={150} />
      <Lottie name="falling-leaves" className="tg-leaves tg-leaves-2" options={{ startFrame: 150, speed: 0.65 }} stillFrame={210} />
      <Lottie name="falling-leaves" className="tg-leaves tg-leaves-3" options={{ startFrame: 220, speed: 0.55 }} stillFrame={90} />
      <WalkingTurkey />
    </div>
  );
};

/** Logo + headline, drop-in replacement for the default greeting row. */
export const ThanksgivingGreeting = () => (
  <div className="flex flex-col items-center mb-8 relative z-[1]">
    <Lottie name="turkey-pilgrim" className="tg-hero" stillFrame={60} label="Thanksgiving turkey" />
    <h1
      className="tg-title text-[40px] leading-none text-center tracking-[-0.01em]"
      style={{ fontFamily: '"Newsreader", "Georgia", serif', fontWeight: 400 }}
    >
      What&apos;s on your plate today?
    </h1>
    <p className="tg-subtitle mt-3 text-[12px] tracking-[0.2em] uppercase">
      🍂 Happy Thanksgiving from Amplify 🍂
    </p>
  </div>
);

const ThanksgivingStyles = () => (
  <style>{`
    .tg-backdrop { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; }
    .tg-fill { width: 100%; height: 100%; }

    .tg-glow { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 100%, rgba(251,191,36,.20), transparent 62%); }
    .dark .tg-glow { background: radial-gradient(ellipse at 50% 100%, rgba(234,88,12,.18), transparent 62%); }

    /* Feather the box edges so leaves fade in/out instead of being clipped. */
    .tg-leaves { position: absolute; opacity: .9;
      -webkit-mask-image: radial-gradient(closest-side, #000 62%, transparent 100%);
              mask-image: radial-gradient(closest-side, #000 62%, transparent 100%); }
    .tg-leaves-1 { left: -10%; top: -14%; width: 62vh; height: 62vh; }
    .tg-leaves-2 { right: -12%; top: 4%; width: 72vh; height: 72vh; transform: scaleX(-1); }
    .tg-leaves-3 { left: 26%; top: -26%; width: 48vh; height: 48vh; opacity: .5; filter: blur(.6px); }

    .tg-walker { position: absolute; left: 0; bottom: 4px; width: 110px; height: 110px; will-change: transform; }

    /* No negative top margin: the greeting sits in an overflow-hidden collapse wrapper and would clip the hat. */
    .tg-hero { width: 190px; height: 190px; margin: 0 0 -18px; flex-shrink: 0; }
    .tg-title { color: #9a3412; }
    .dark .tg-title { color: #fbbf24; text-shadow: 0 0 22px rgba(251,191,36,.25); }
    .tg-subtitle { color: #a16207; }
    .dark .tg-subtitle { color: rgba(253,230,138,.75); }

    /* Composer gets a warm harvest glow while in season */
    .tg-active .new-ui-composer-card { position: relative; z-index: 1; box-shadow: 0 0 0 1px rgba(217,119,6,.16), 0 0 30px -8px rgba(217,119,6,.45); }
    .tg-active .new-ui-composer-card:focus-within { box-shadow: 0 0 0 1px rgba(217,119,6,.45), 0 0 36px -6px rgba(217,119,6,.6); }

    @media (prefers-reduced-motion: reduce) {
      .tg-walker { display: none; }
    }
  `}</style>
);
