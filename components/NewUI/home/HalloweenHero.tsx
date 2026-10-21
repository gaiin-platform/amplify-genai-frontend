/**
 * HalloweenHero — seasonal replacement for the NewHome greeting.
 *
 * Renders a glowing jack-o'-lantern logo, a spooky headline, drifting bats,
 * a corner cobweb and low-lying fog. Everything is pure SVG/CSS (no assets),
 * pointer-events are disabled on decorations so the composer stays usable,
 * and all motion is disabled under prefers-reduced-motion.
 */
import React from 'react';

/**
 * Master gate for ALL Halloween UI (theme, controls pill, settings rows, bat swarm).
 * Driven by the `halloween` feature flag (admin → Feature Flags). Unset/false = OFF,
 * so nothing renders until the flag is explicitly enabled.
 */
export const isHalloweenSeason = (featureFlags?: { [key: string]: boolean } | null) =>
  featureFlags?.halloween === true;

export const HALLOWEEN_PLACEHOLDER = 'Ask anything… if you dare 🕯️';

const JackOLantern = ({ size = 56 }: { size?: number }) => (
  <svg
    className="hw-pumpkin"
    width={size}
    height={size}
    viewBox="0 0 64 64"
    role="img"
    aria-label="Amplify jack-o'-lantern"
  >
    <defs>
      <radialGradient id="hw-pumpkin-body" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#ffb347" />
        <stop offset="60%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#9a3412" />
      </radialGradient>
      <radialGradient id="hw-candle" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fff7c2" />
        <stop offset="55%" stopColor="#fde047" />
        <stop offset="100%" stopColor="#f59e0b" />
      </radialGradient>
    </defs>
    {/* stem */}
    <path d="M30 10 C30 4, 36 2, 38 5 C35 6, 34 9, 34 13 Z" fill="#4d7c0f" />
    {/* body: three overlapping lobes */}
    <ellipse cx="20" cy="37" rx="14" ry="19" fill="url(#hw-pumpkin-body)" />
    <ellipse cx="44" cy="37" rx="14" ry="19" fill="url(#hw-pumpkin-body)" />
    <ellipse cx="32" cy="37" rx="15" ry="21" fill="url(#hw-pumpkin-body)" />
    <path d="M32 17 C27 26, 27 48, 32 57" stroke="#9a3412" strokeOpacity="0.45" fill="none" />
    {/* carved face (lit from inside) */}
    <g className="hw-face" fill="url(#hw-candle)">
      <path d="M18 31 L25 26 L27 34 Z" />
      <path d="M46 31 L39 26 L37 34 Z" />
      <path d="M30 37 L32 33 L34 37 Z" />
      <path d="M16 41 C22 50, 42 50, 48 41 L43 43 L40 40 L36 44 L32 41 L28 44 L24 40 L21 43 Z" />
    </g>
  </svg>
);

/** Left wing, hinged at the shoulder (right edge of its bbox). Mirrored for the right wing. */
const BAT_WING =
  'M46 19 C40 11, 26 6, 4 12 C9 14, 11 18, 11 24 C15 20.5, 21 20.5, 24 26 C27 21.5, 33 21.5, 36 28 C39 24, 43 24, 46 27 Z';

const Bat = ({ className }: { className: string }) => (
  <div className={`hw-bat-track ${className}`}>
    <div className="hw-bat-fly">
      <div className="hw-bat-bob">
        <svg className="hw-bat" viewBox="0 0 100 46" aria-hidden="true">
          <path className="hw-wing" d={BAT_WING} />
          <g transform="translate(100 0) scale(-1 1)">
            <path className="hw-wing" d={BAT_WING} />
          </g>
          {/* ears, head, body */}
          <path d="M46.6 14 L45.8 6.5 L49.2 11.5 Z M53.4 14 L54.2 6.5 L50.8 11.5 Z" />
          <circle cx="50" cy="15.5" r="4.6" />
          <ellipse cx="50" cy="25" rx="5" ry="9" />
          {/* tiny ember eyes */}
          <circle cx="48.3" cy="15" r="0.9" className="hw-bat-eye" />
          <circle cx="51.7" cy="15" r="0.9" className="hw-bat-eye" />
        </svg>
      </div>
    </div>
  </div>
);

const Cobweb = () => (
  <svg className="hw-web" viewBox="0 0 160 160" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1" fill="none">
      <path d="M160 0 L0 160 M160 0 L60 160 M160 0 L110 160 M160 0 L0 60 M160 0 L0 110" />
      <path d="M130 0 Q138 22 160 30" />
      <path d="M95 0 Q110 50 160 65" />
      <path d="M58 0 Q80 80 160 102" />
      <path d="M20 0 Q50 110 160 140" />
    </g>
    {/* dangling spider */}
    <g className="hw-spider">
      <line x1="118" y1="0" x2="118" y2="70" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="118" cy="74" r="5" fill="currentColor" />
      <path
        d="M113 72 l-6 -4 M113 75 l-7 0 M113 78 l-6 4 M123 72 l6 -4 M123 75 l7 0 M123 78 l6 4"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </g>
  </svg>
);

/** Absolutely-positioned decorations that fill the landing pane. */
export const HalloweenBackdrop = () => (
  <div className="hw-backdrop" aria-hidden="true">
    <HalloweenStyles />
    <div className="hw-moon" />
    <Cobweb />
    <Bat className="hw-bat-1" />
    <Bat className="hw-bat-2" />
    <Bat className="hw-bat-3" />
    <div className="hw-fog hw-fog-1" />
    <div className="hw-fog hw-fog-2" />
  </div>
);

/** Logo + headline, drop-in replacement for the default greeting row. */
export const HalloweenGreeting = () => (
  <div className="flex flex-col items-center mb-8 relative z-[1]">
    <div className="flex items-center gap-3 justify-center">
      <JackOLantern />
      <h1
        className="hw-title text-[42px] leading-none text-center"
        style={{ fontFamily: '"Creepster", "Chiller", "Newsreader", Georgia, serif', fontWeight: 400 }}
      >
        What shall we conjure?
      </h1>
    </div>
    <p className="hw-subtitle mt-3 text-[13px] tracking-[0.18em] uppercase">
      🦇 Happy Halloween from Amplify 🦇
    </p>
  </div>
);

const HalloweenStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Creepster&display=swap');

    /* Theme-aware decoration colours. Light theme is the default; .dark (set on
       <html> by the app theme) overrides. */
    .hw-backdrop {
      position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0;
      --hw-bat-fill: #1c1424;
      --hw-bat-shadow: drop-shadow(0 3px 4px rgba(0,0,0,.28));
      --hw-web-color: rgba(40, 30, 50, .38);
    }
    .dark .hw-backdrop {
      /* Dusky violet silhouette + cool moonlit rim so bats read on #151515 */
      --hw-bat-fill: #4a3d5c;
      --hw-bat-shadow: drop-shadow(0 0 1.5px rgba(216, 200, 255, .55)) drop-shadow(0 0 8px rgba(167, 139, 250, .35));
      --hw-web-color: rgba(255, 255, 255, .16);
    }

    .hw-moon {
      position: absolute; top: 7%; right: 9%; width: 110px; height: 110px; border-radius: 50%;
      background: radial-gradient(circle at 38% 38%, #fff9e6 0%, #f5e6b8 45%, #d6c28a 100%);
      box-shadow: 0 0 60px 18px rgba(253, 230, 138, 0.18);
      opacity: 0.55;
    }
    .hw-moon::after { /* craters */
      content: ''; position: absolute; inset: 0; border-radius: 50%;
      background:
        radial-gradient(circle at 65% 30%, rgba(160,140,90,.35) 0 8px, transparent 9px),
        radial-gradient(circle at 35% 65%, rgba(160,140,90,.3) 0 12px, transparent 13px),
        radial-gradient(circle at 70% 70%, rgba(160,140,90,.25) 0 6px, transparent 7px);
    }

    .hw-web { position: absolute; top: 0; right: 0; width: 170px; height: 170px; color: var(--hw-web-color); }
    .hw-spider { transform-origin: 118px 0; animation: hw-dangle 5s ease-in-out infinite; }

    /* Bats: track (vertical lane) > fly (horizontal travel) > bob (sine-ish lift + tilt) > svg (flap) */
    .hw-bat-track { position: absolute; left: 0; right: 0; height: 0; }
    .hw-bat-fly { width: 100%; transform: translateX(-12%); animation: hw-fly var(--fly, 22s) linear infinite var(--delay, 0s); }
    .hw-bat-bob { width: var(--size, 56px); animation: hw-glide var(--bob, 2.8s) ease-in-out infinite; }
    .hw-bat { display: block; width: 100%; overflow: visible; fill: var(--hw-bat-fill); filter: var(--hw-bat-shadow); }
    .hw-wing {
      transform-box: fill-box; transform-origin: 100% 45%;
      animation: hw-flap var(--flap, .32s) ease-in-out infinite alternate;
    }
    .hw-bat-eye { fill: #fb923c; }

    .hw-bat-1 { top: 16%; --size: 58px; --fly: 19s; --delay: -4s;  --flap: .3s;  --bob: 2.6s; }
    .hw-bat-2 { top: 34%; --size: 38px; --fly: 26s; --delay: -15s; --flap: .26s; --bob: 2.1s; opacity: .8; }
    .hw-bat-3 { top: 9%;  --size: 28px; --fly: 34s; --delay: -24s; --flap: .22s; --bob: 3.4s; opacity: .55; filter: blur(.4px); }

    .hw-fog {
      position: absolute; left: -50%; width: 200%; height: 220px; bottom: -60px;
      background: radial-gradient(ellipse at center, rgba(200,200,215,.10) 0%, transparent 65%);
      filter: blur(18px);
    }
    .hw-fog-1 { animation: hw-drift 28s ease-in-out infinite alternate; }
    .hw-fog-2 { bottom: -20px; opacity: .7; animation: hw-drift 36s ease-in-out infinite alternate-reverse; }

    .hw-pumpkin { flex-shrink: 0; filter: drop-shadow(0 0 14px rgba(249,115,22,.55)); animation: hw-bob 4s ease-in-out infinite; }
    .hw-face { animation: hw-flicker 2.4s steps(1) infinite; }

    .hw-title {
      color: #fb923c;
      text-shadow: 0 0 6px rgba(249,115,22,.55), 0 0 22px rgba(234,88,12,.35), 0 2px 0 #431407;
      letter-spacing: 0.02em;
      animation: hw-glow 3.2s ease-in-out infinite;
    }
    .hw-subtitle { color: rgba(196, 181, 253, .75); text-shadow: 0 0 10px rgba(139,92,246,.45); }
    /* Composer gets an eerie ember edge while in season */
    .hw-active .new-ui-composer-card { position: relative; z-index: 1; box-shadow: 0 0 0 1px rgba(249,115,22,.18), 0 0 28px -6px rgba(249,115,22,.35); }
    .hw-active .new-ui-composer-card:focus-within { box-shadow: 0 0 0 1px rgba(249,115,22,.45), 0 0 34px -4px rgba(249,115,22,.5); }

    /* wing up (tip raised) -> wing down (tip lowered, foreshortened) */
    @keyframes hw-flap {
      from { transform: rotate(30deg) scaleY(1); }
      to   { transform: rotate(-24deg) scaleY(.7); }
    }
    @keyframes hw-fly { from { transform: translateX(-12%); } to { transform: translateX(108%); } }
    @keyframes hw-glide {
      0%   { transform: translateY(0) rotate(4deg); }
      25%  { transform: translateY(-16px) rotate(-3deg); }
      50%  { transform: translateY(-4px) rotate(5deg); }
      75%  { transform: translateY(12px) rotate(-2deg); }
      100% { transform: translateY(0) rotate(4deg); }
    }
    @keyframes hw-drift { from { transform: translateX(-8%); } to { transform: translateX(8%); } }
    @keyframes hw-dangle { 0%,100% { transform: rotate(-4deg) scaleY(1); } 50% { transform: rotate(4deg) scaleY(1.12); } }
    @keyframes hw-bob { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-4px) rotate(3deg); } }
    @keyframes hw-flicker { 0%,100% { opacity: 1; } 8% { opacity: .55; } 10% { opacity: 1; } 47% { opacity: .8; } 50% { opacity: .4; } 52% { opacity: 1; } 81% { opacity: .7; } }
    @keyframes hw-glow {
      0%,100% { text-shadow: 0 0 6px rgba(249,115,22,.55), 0 0 22px rgba(234,88,12,.35), 0 2px 0 #431407; }
      50%     { text-shadow: 0 0 10px rgba(249,115,22,.8), 0 0 36px rgba(234,88,12,.55), 0 2px 0 #431407; }
    }

    @media (prefers-reduced-motion: reduce) {
      .hw-backdrop *, .hw-pumpkin, .hw-face, .hw-title { animation: none !important; }
      .hw-bat-track { display: none; }
    }
  `}</style>
);
