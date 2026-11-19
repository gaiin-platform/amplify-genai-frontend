/**
 * releaseLeafGust — Thanksgiving send transition.
 *
 * A warm haze rolls in from the composer, a gust of large maple leaves blows
 * across the whole viewport, and the walking turkey hurries through the middle
 * chasing them. Everything then clears to reveal the chat view.
 *
 * Mounted imperatively on document.body (not as React state) because NewHome
 * unmounts the instant the new conversation is created — the gust has to
 * outlive it and play *over* the chat view while it mounts underneath. The send
 * itself is never delayed: if the animation files aren't cached yet, the gust
 * is skipped rather than waited for.
 *
 * pointer-events: none throughout. No-op under prefers-reduced-motion.
 */
import type { AnimationItem } from 'lottie-web';
import { getReadyAnimationData, type ThanksgivingAnimation } from '@/components/NewUI/home/thanksgivingLottie';

const ROOT_ID = 'tg-leaf-gust';
const TOTAL_MS = 2600;

const STYLES = `
  #${ROOT_ID} { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; overflow: hidden;
    --tgg-a: rgba(255,244,222,.94); --tgg-b: rgba(253,214,160,.94); }
  .dark #${ROOT_ID} { --tgg-a: rgba(58,28,10,.95); --tgg-b: rgba(22,11,5,.97); }
  #${ROOT_ID} .tgg-veil { position: absolute; inset: 0; opacity: 0;
    background: radial-gradient(ellipse at var(--ox) var(--oy), var(--tgg-a), var(--tgg-b) 75%); }
  #${ROOT_ID} .tgg-layer, #${ROOT_ID} .tgg-runner { position: absolute; will-change: transform, opacity; }
  #${ROOT_ID} .tgg-layer { left: 50%; top: 50%; }
  #${ROOT_ID} .tgg-runner { left: 0; top: 50%; }
`;

/** Big copies of the falling-leaves animation, tilted and blown left → right. */
const LAYERS = [
  { scale: 1.5, rot: -28, delay: 0, opacity: 1, speed: 2.6, frame: 120 },
  { scale: 1.15, rot: -22, delay: 90, opacity: 1, speed: 3.0, frame: 200 },
  { scale: 0.85, rot: -34, delay: 160, opacity: 0.95, speed: 3.4, frame: 40 },
  { scale: 1.9, rot: -18, delay: 60, opacity: 0.9, speed: 2.2, frame: 260, blur: 1.5 },
  { scale: 0.6, rot: -30, delay: 220, opacity: 0.8, speed: 3.8, frame: 160 },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Default launch point: centre of the landing composer, else lower-middle of the screen. */
const defaultOrigin = (): { x: number; y: number } => {
  const card = document.querySelector('.new-ui-composer-card');
  if (card) {
    const r = card.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
};

export function releaseLeafGust(origin?: { x: number; y: number }): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  if (document.getElementById(ROOT_ID)) return; // already gusting
  if (typeof Element === 'undefined' || !('animate' in Element.prototype)) return;
  // Never wait on the network during a send.
  if (!getReadyAnimationData('falling-leaves')) return;

  const { x: ox, y: oy } = origin ?? defaultOrigin();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const vmax = Math.max(vw, vh);
  const anims: AnimationItem[] = [];

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('--ox', `${ox}px`);
  root.style.setProperty('--oy', `${oy}px`);
  const style = document.createElement('style');
  style.textContent = STYLES;
  root.appendChild(style);
  const veil = document.createElement('div');
  veil.className = 'tgg-veil';
  root.appendChild(veil);
  document.body.appendChild(root);

  const play = (name: ThanksgivingAnimation, el: HTMLElement, speed: number, frame = 0) => {
    const ready = getReadyAnimationData(name);
    if (!ready) return;
    const a = ready.lottie.loadAnimation({
      container: el, renderer: 'svg', loop: true, autoplay: false, animationData: ready.data,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    });
    a.addEventListener('DOMLoaded', () => { a.setSpeed(speed); a.goToAndPlay(frame, true); });
    anims.push(a);
  };

  veil.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.32 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }],
    { duration: TOTAL_MS, easing: 'ease-in-out', fill: 'forwards' },
  );

  LAYERS.forEach((L) => {
    const size = vmax * L.scale;
    const el = document.createElement('div');
    el.className = 'tgg-layer';
    Object.assign(el.style, {
      width: `${size}px`, height: `${size}px`, marginLeft: `${-size / 2}px`, marginTop: `${-size / 2}px`, opacity: '0',
    });
    if (L.blur) el.style.filter = `blur(${L.blur}px)`;
    root.appendChild(el);
    play('falling-leaves', el, L.speed, L.frame);
    el.animate(
      [
        { transform: `translate(${-vmax * 0.9}px, ${vmax * 0.12}px) rotate(${L.rot}deg)`, opacity: 0 },
        { opacity: L.opacity, offset: 0.2 },
        { transform: `translate(0, 0) rotate(${L.rot}deg)`, opacity: L.opacity, offset: 0.5 },
        { opacity: L.opacity, offset: 0.72 },
        { transform: `translate(${vmax * 0.95}px, ${-vmax * 0.1}px) rotate(${L.rot}deg)`, opacity: 0 },
      ],
      { duration: TOTAL_MS - L.delay, delay: L.delay, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' },
    );
  });

  // The walking turkey hurries across, chasing the leaves.
  if (getReadyAnimationData('turkey-walking')) {
    const rw = Math.min(vh * 0.46, 420);
    const run = document.createElement('div');
    run.className = 'tgg-runner';
    Object.assign(run.style, { width: `${rw}px`, height: `${rw}px`, marginTop: `${-rw / 2}px` });
    root.appendChild(run);
    play('turkey-walking', run, 2.4);
    run.animate(
      [
        { transform: `translate(${-rw}px, 40px)` },
        { transform: `translate(${vw * 0.5 - rw / 2}px, 0px)`, offset: 0.5 },
        { transform: `translate(${vw + rw}px, -30px)` },
      ],
      { duration: TOTAL_MS, easing: 'cubic-bezier(.4,.1,.5,.9)', fill: 'both' },
    );
  }

  window.setTimeout(() => {
    anims.forEach((a) => a.destroy());
    root.remove();
  }, TOTAL_MS + 150);
}
