/**
 * thanksgivingLottie — lazy loader for the Thanksgiving theme's Lottie player
 * and animation files.
 *
 * The player (lottie-web light build, ~165 KB) and the three animation files in
 * /public/seasonal/thanksgiving (~680 KB total) are fetched only when the theme
 * is actually shown, so they cost nothing the rest of the year.
 *
 * Animations (free under the Lottie Simple License, lottiefiles.com/page/license):
 *   turkey-pilgrim.json  "Thanksgiving Day" by Tom Fabre
 *   turkey-walking.json  "Walking Turkey" by Bashir Ahmad
 *   falling-leaves.json  "Falling leaves" by Lisa Paton
 */
import type { AnimationItem, LottiePlayer } from 'lottie-web';

export type ThanksgivingAnimation = 'turkey-pilgrim' | 'turkey-walking' | 'falling-leaves';

const ASSET_BASE = '/seasonal/thanksgiving';

let playerPromise: Promise<LottiePlayer> | null = null;
const dataPromises = new Map<ThanksgivingAnimation, Promise<string>>();

/** Loads the Lottie player once. lottie-web touches `document` on import, so it must stay client-only. */
export function loadLottiePlayer(): Promise<LottiePlayer> {
  if (!playerPromise) {
    playerPromise = import('lottie-web/build/player/lottie_light')
      .then((m) => m.default as LottiePlayer)
      .catch((err) => {
        playerPromise = null; // allow a retry on the next mount
        throw err;
      });
  }
  return playerPromise;
}

/** Fetches an animation file once; returns raw JSON text (parsed per instance — lottie mutates its input). */
function loadAnimationText(name: ThanksgivingAnimation): Promise<string> {
  let p = dataPromises.get(name);
  if (!p) {
    p = fetch(`${ASSET_BASE}/${name}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${name}: ${r.status}`);
        return r.text();
      })
      .catch((err) => {
        dataPromises.delete(name);
        throw err;
      });
    dataPromises.set(name, p);
  }
  return p;
}

/** Warms the player and every animation so the send transition can start instantly. */
export function preloadThanksgivingAssets(): void {
  void loadLottiePlayer().catch(() => undefined);
  (['turkey-pilgrim', 'turkey-walking', 'falling-leaves'] as const).forEach((n) =>
    void loadAnimationText(n).catch(() => undefined),
  );
}

// Synchronous access for the send transition, which must not wait on the network.
let readyPlayer: LottiePlayer | null = null;
const readyText = new Map<ThanksgivingAnimation, string>();

/** Cheap readiness check (no JSON parse) for guards that only need to know whether data is available. */
export function isAnimationReady(name: ThanksgivingAnimation): boolean {
  return !!readyPlayer && readyText.has(name);
}

export function getReadyAnimationData(name: ThanksgivingAnimation): { lottie: LottiePlayer; data: unknown } | null {
  const text = readyText.get(name);
  if (!readyPlayer || !text) return null;
  return { lottie: readyPlayer, data: JSON.parse(text) };
}

export interface MountOptions {
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  /** Start part-way through, so copies of the same animation don't move in sync. */
  startFrame?: number;
  /** Hold a single still frame (used for prefers-reduced-motion). */
  stillFrame?: number;
}

/**
 * Mounts an animation into `container`. Resolves to the AnimationItem, or null
 * if the container was cancelled/unmounted or loading failed (the theme then
 * simply shows without that animation).
 */
export async function mountAnimation(
  container: HTMLElement,
  name: ThanksgivingAnimation,
  opts: MountOptions = {},
  isCancelled: () => boolean = () => false,
): Promise<AnimationItem | null> {
  try {
    const [lottie, text] = await Promise.all([loadLottiePlayer(), loadAnimationText(name)]);
    readyPlayer = lottie;
    readyText.set(name, text);
    if (isCancelled()) return null;
    const still = opts.stillFrame !== undefined;
    const anim = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: still ? false : opts.loop ?? true,
      autoplay: false,
      animationData: JSON.parse(text),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    });
    anim.addEventListener('DOMLoaded', () => {
      if (still) {
        anim.goToAndStop(opts.stillFrame!, true);
        return;
      }
      if (opts.speed) anim.setSpeed(opts.speed);
      if (opts.autoplay === false) return;
      if (opts.startFrame) anim.goToAndPlay(opts.startFrame, true);
      else anim.play();
    });
    return anim;
  } catch {
    return null;
  }
}
