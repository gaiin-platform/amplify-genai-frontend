/**
 * HalloweenControls — always-visible bottom-right corner control on the landing
 * page (October only) so users can find the Halloween opt-outs without hunting
 * through Settings.
 *
 * Collapsed: a small labelled pill ("🎃 Halloween effects").
 * Expanded:  a popover with two switches —
 *   • Halloween theme  (everything)
 *   • Bat swarm on send (just the send transition; disabled while theme is off)
 *
 * The pill stays visible even after the theme is turned off, so it can be turned
 * back on from the same place.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';
import {
  getHalloweenPartEnabled,
  setHalloweenPartEnabled,
  USER_HALLOWEEN_EFFECTS_CHANGED_EVENT,
} from '@/components/NewUI/shared/userHalloweenEffects';

export const HalloweenControls: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [themeOn, setThemeOn] = useState(true);
  const [swarmOn, setSwarmOn] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  // Read prefs after mount (localStorage) and stay in sync with Settings → General.
  useEffect(() => {
    const sync = () => {
      setThemeOn(getHalloweenPartEnabled('theme'));
      setSwarmOn(getHalloweenPartEnabled('swarm'));
    };
    sync();
    window.addEventListener(USER_HALLOWEEN_EFFECTS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(USER_HALLOWEEN_EFFECTS_CHANGED_EVENT, sync);
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '10px 0',
  };

  return (
    <div
      ref={rootRef}
      className="absolute bottom-4 right-4 z-[2] flex flex-col items-end gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Halloween effects"
          style={{
            width: 280,
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: '6px 14px',
            boxShadow: '0 10px 30px -10px rgba(0,0,0,.35)',
          }}
        >
          <div style={{ ...row, borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
              <div id="hw-ctl-theme" style={{ fontSize: 13, color: 'var(--text-primary)' }}>Halloween theme</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Pumpkin, bats, cobweb and fog
              </div>
            </div>
            <ToggleSwitch
              checked={themeOn}
              onChange={(v) => setHalloweenPartEnabled('theme', v)}
              aria-labelledby="hw-ctl-theme"
            />
          </div>
          <div style={{ ...row, opacity: themeOn ? 1 : 0.5 }}>
            <div>
              <div id="hw-ctl-swarm" style={{ fontSize: 13, color: 'var(--text-primary)' }}>Bat swarm on send</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Bats fly across when you send
              </div>
            </div>
            <ToggleSwitch
              checked={themeOn && swarmOn}
              disabled={!themeOn}
              onChange={(v) => setHalloweenPartEnabled('swarm', v)}
              aria-labelledby="hw-ctl-swarm"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          fontSize: 12,
          borderRadius: 9999,
          cursor: 'pointer',
          color: 'var(--text-secondary, var(--text-primary))',
          background: 'var(--bg-raised)',
          border: `1px solid ${themeOn ? 'rgba(249,115,22,.45)' : 'var(--border-subtle)'}`,
          boxShadow: themeOn ? '0 0 14px -4px rgba(249,115,22,.55)' : 'none',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
      >
        <span aria-hidden="true" style={{ filter: themeOn ? 'none' : 'grayscale(1)' }}>🎃</span>
        {themeOn ? 'Halloween effects' : 'Halloween effects: off'}
      </button>
    </div>
  );
};
