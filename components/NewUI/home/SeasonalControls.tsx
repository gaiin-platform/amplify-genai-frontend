/**
 * SeasonalControls — always-visible bottom-right corner control on the landing
 * page so users can find a seasonal theme's opt-outs without hunting through
 * Settings. Shared by the Halloween and Thanksgiving themes.
 *
 * Collapsed: a small labelled pill ("🎃 Halloween effects").
 * Expanded:  a popover with two switches —
 *   • <Holiday> theme      (everything)
 *   • <Send transition>    (just the send animation; disabled while theme is off)
 *
 * The pill stays visible even after the theme is turned off, so it can be turned
 * back on from the same place.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ToggleSwitch } from '@/components/NewUI/shared/ToggleSwitch';

export interface SeasonalControlsConfig {
  /** Prefix for element ids, e.g. "hw" or "tg". */
  idPrefix: string;
  icon: string;
  /** "Halloween effects" */
  title: string;
  themeLabel: string;
  themeHint: string;
  sendLabel: string;
  sendHint: string;
  /** Accent used for the pill's border/glow, as "r,g,b". */
  accentRgb: string;
  getEnabled: (part: 'theme' | 'send') => boolean;
  setEnabled: (part: 'theme' | 'send', enabled: boolean) => void;
  changedEvent: string;
}

export const SeasonalControls: React.FC<{ config: SeasonalControlsConfig }> = ({ config }) => {
  const { idPrefix, icon, title, themeLabel, themeHint, sendLabel, sendHint, accentRgb, getEnabled, setEnabled, changedEvent } = config;
  const [open, setOpen] = useState(false);
  const [themeOn, setThemeOn] = useState(true);
  const [sendOn, setSendOn] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  // Read prefs after mount (localStorage) and stay in sync with Settings → General.
  useEffect(() => {
    const sync = () => {
      setThemeOn(getEnabled('theme'));
      setSendOn(getEnabled('send'));
    };
    sync();
    window.addEventListener(changedEvent, sync);
    return () => window.removeEventListener(changedEvent, sync);
  }, [getEnabled, changedEvent]);

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
          aria-label={title}
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
              <div id={`${idPrefix}-ctl-theme`} style={{ fontSize: 13, color: 'var(--text-primary)' }}>{themeLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{themeHint}</div>
            </div>
            <ToggleSwitch
              checked={themeOn}
              onChange={(v) => setEnabled('theme', v)}
              aria-labelledby={`${idPrefix}-ctl-theme`}
            />
          </div>
          <div style={{ ...row, opacity: themeOn ? 1 : 0.5 }}>
            <div>
              <div id={`${idPrefix}-ctl-send`} style={{ fontSize: 13, color: 'var(--text-primary)' }}>{sendLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sendHint}</div>
            </div>
            <ToggleSwitch
              checked={themeOn && sendOn}
              disabled={!themeOn}
              onChange={(v) => setEnabled('send', v)}
              aria-labelledby={`${idPrefix}-ctl-send`}
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
          border: `1px solid ${themeOn ? `rgba(${accentRgb},.45)` : 'var(--border-subtle)'}`,
          boxShadow: themeOn ? `0 0 14px -4px rgba(${accentRgb},.55)` : 'none',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
      >
        <span aria-hidden="true" style={{ filter: themeOn ? 'none' : 'grayscale(1)' }}>{icon}</span>
        {themeOn ? title : `${title}: off`}
      </button>
    </div>
  );
};
