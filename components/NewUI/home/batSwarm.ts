/**
 * releaseBatSwarm — Halloween send transition.
 *
 * A colony of bats bursts out of the composer, sweeps across and engulfs the
 * whole viewport, then scatters off-screen to reveal the chat view.
 *
 * Mounted imperatively on document.body (not as React state) because NewHome
 * unmounts the instant the new conversation is created — the swarm has to
 * outlive it and play *over* the chat view while it mounts underneath. The
 * send itself is never delayed.
 *
 * Pure DOM + Web Animations API; no assets. pointer-events: none throughout, so
 * the swarm never blocks the UI. No-op under prefers-reduced-motion.
 */

const ROOT_ID = 'hw-bat-swarm';
const BAT_COUNT = 46;
const TOTAL_MS = 2100;

/** Same wing silhouette as the home-page bats (HalloweenHero). */
const WING =
  'M46 19 C40 11, 26 6, 4 12 C9 14, 11 18, 11 24 C15 20.5, 21 20.5, 24 26 C27 21.5, 33 21.5, 36 28 C39 24, 43 24, 46 27 Z';

const BAT_SVG = `<svg viewBox="0 0 100 46" aria-hidden="true">
  <path class="hws-wing" d="${WING}"/>
  <g transform="translate(100 0) scale(-1 1)"><path class="hws-wing" d="${WING}"/></g>
  <path d="M46.6 14 L45.8 6.5 L49.2 11.5 Z M53.4 14 L54.2 6.5 L50.8 11.5 Z"/>
  <circle cx="50" cy="15.5" r="4.6"/>
  <ellipse cx="50" cy="25" rx="5" ry="9"/>
  <circle class="hws-eye" cx="48.3" cy="15" r="0.9"/>
  <circle class="hws-eye" cx="51.7" cy="15" r="0.9"/>
</svg>`;

const STYLES = `
  #${ROOT_ID} { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; overflow: hidden; }
  /* Light theme (default): pale fog rolls in, dark bats burst through it. */
  #${ROOT_ID} {
    --hws-veil: radial-gradient(ellipse at var(--ox) var(--oy), rgba(255,247,237,.75) 0%, rgba(214,206,226,.92) 75%);
    --hws-bat-fill: #1c1424;
    --hws-bat-filter: drop-shadow(0 4px 5px rgba(40,20,60,.35));
  }
  /* Dark theme: full night blackout with moonlit bat rims. */
  .dark #${ROOT_ID} {
    --hws-veil: radial-gradient(ellipse at var(--ox) var(--oy), rgba(28,12,36,.92) 0%, rgba(8,5,12,.96) 70%);
    --hws-bat-fill: #241a30;
    --hws-bat-filter: drop-shadow(0 0 1.5px rgba(216,200,255,.5)) drop-shadow(0 4px 6px rgba(0,0,0,.5));
  }
  #${ROOT_ID} .hws-veil { position: absolute; inset: 0; opacity: 0; background: var(--hws-veil); }
  #${ROOT_ID} .hws-bat { position: absolute; left: 0; top: 0; will-change: transform, opacity; }
  #${ROOT_ID} svg { display: block; width: 100%; overflow: visible; fill: var(--hws-bat-fill);
    filter: var(--hws-bat-filter); }
  #${ROOT_ID} .hws-wing { transform-box: fill-box; transform-origin: 100% 45%;
    animation: hws-flap var(--flap) ease-in-out infinite alternate; }
  #${ROOT_ID} .hws-eye { fill: #fb923c; }
  @keyframes hws-flap { from { transform: rotate(32deg) scaleY(1); } to { transform: rotate(-26deg) scaleY(.65); } }
`;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Default launch point: centre of the landing composer, else lower-middle of the screen. */
const defaultOrigin = (): { x: number; y: number } => {
  const card = document.querySelector('.new-ui-composer-card');
  if (card) {
    const r = card.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
};

export function releaseBatSwarm(origin?: { x: number; y: number }): void {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  if (document.getElementById(ROOT_ID)) return; // already swarming
  if (typeof Element === 'undefined' || !('animate' in Element.prototype)) return;

  const { x: ox, y: oy } = origin ?? defaultOrigin();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  root.style.setProperty('--ox', `${ox}px`);
  root.style.setProperty('--oy', `${oy}px`);

  const style = document.createElement('style');
  style.textContent = STYLES;
  root.appendChild(style);

  // Dark veil: the "engulf" — swells in behind the bats, then lifts to reveal the chat.
  const veil = document.createElement('div');
  veil.className = 'hws-veil';
  root.appendChild(veil);

  document.body.appendChild(root);

  veil.animate(
    [
      { opacity: 0 },
      { opacity: 0.94, offset: 0.3 },
      { opacity: 0.94, offset: 0.48 },
      { opacity: 0 },
    ],
    { duration: TOTAL_MS, easing: 'ease-in-out', fill: 'forwards' },
  );

  // Spread mid-points on a jittered grid so the swarm covers the whole screen
  // rather than clumping.
  const cols = 8;
  const rows = Math.ceil(BAT_COUNT / cols);

  for (let i = 0; i < BAT_COUNT; i++) {
    const size = rand(46, 150);
    const bat = document.createElement('div');
    bat.className = 'hws-bat';
    bat.style.width = `${size}px`;
    bat.style.setProperty('--flap', `${rand(0.16, 0.26).toFixed(2)}s`);
    bat.innerHTML = BAT_SVG;
    root.appendChild(bat);

    const half = size / 2;
    // Start: clustered in the composer.
    const sx = ox + rand(-60, 60) - half;
    const sy = oy + rand(-20, 20) - half;
    // Mid: a cell of the coverage grid.
    const col = i % cols;
    const row = Math.floor(i / cols);
    const mx = ((col + rand(0.1, 0.9)) / cols) * vw - half;
    const my = ((row + rand(0.1, 0.9)) / rows) * vh - half;
    // Exit: fling outward, away from the origin, well past the viewport edge.
    const angle = Math.atan2(my + half - oy, mx + half - ox) + rand(-0.5, 0.5);
    const dist = Math.max(vw, vh) * rand(0.8, 1.2);
    const ex = mx + Math.cos(angle) * dist;
    const ey = my + Math.sin(angle) * dist - rand(80, 260); // bats climb as they leave

    const tilt = rand(-25, 25);
    const delay = rand(0, 260);
    const duration = TOTAL_MS - delay - rand(0, 200);

    bat.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(.15) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${(sx + mx) / 2}px, ${(sy + my) / 2 - 60}px) scale(.7) rotate(${tilt}deg)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${mx}px, ${my}px) scale(1.15) rotate(${-tilt / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${mx + rand(-40, 40)}px, ${my + rand(-30, 30)}px) scale(1.2) rotate(${tilt / 2}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${ex}px, ${ey}px) scale(.8) rotate(${tilt}deg)`, opacity: 0.9 },
      ],
      { duration, delay, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'both' },
    );
  }

  window.setTimeout(() => root.remove(), TOTAL_MS + 150);
}
