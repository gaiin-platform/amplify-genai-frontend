import React, { FC, useState } from 'react';
import { IconLoader2 } from '@tabler/icons-react';

// Shared building blocks for the RAG Migration admin tab.

export const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString();


export const ago = (epoch?: number | null, now?: number) => {
  if (!epoch) return 'never';
  const seconds = Math.max(0, (now ?? Date.now() / 1000) - epoch);
  if (seconds < 90) return 'just now';
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 129600) return `${Math.round(seconds / 3600)} hr ago`;
  return `${Math.round(seconds / 86400)} days ago`;
};

// ── Layout helpers ───────────────────────────────────────────────────────────

export const Card: FC<{ title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  title, subtitle, right, children,
}) => (
  <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: subtitle ? 4 : 14 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
      {right}
    </div>
    {subtitle && (
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>{subtitle}</p>
    )}
    {children}
  </div>
);

/** A closed-by-default section: a one-line summary stays visible so nothing looks empty. */
export const Collapsible: FC<{ title: string; summary?: string; defaultOpen?: boolean; children: React.ReactNode }> = ({
  title, summary, defaultOpen = false, children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)} aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left',
          padding: '14px 20px', cursor: 'pointer', background: 'var(--bg-raised)', border: 'none', color: 'var(--text-primary)',
        }}
      >
        <span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
          {summary && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{summary}</span>}
        </span>
        <span aria-hidden="true" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 20 }}>{children}</div>}
    </div>
  );
};

/** Two or three options side by side; the chosen one is filled. */
export const Tabs: FC<{ options: { value: string; label: string; hint?: string }[]; value: string; onChange: (value: string) => void }> = ({ options, value, onChange }) => (
  <div role="tablist" style={{ display: 'inline-flex', border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
    {options.map((o) => (
      <button
        key={o.value} role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)} title={o.hint}
        style={{
          padding: '7px 18px', fontSize: 13, cursor: 'pointer', border: 'none',
          background: o.value === value ? 'var(--accent)' : 'transparent', color: o.value === value ? '#fff' : 'var(--text-primary)',
          fontWeight: o.value === value ? 600 : 400,
        }}
      >
        {o.label}
      </button>
    ))}
  </div>
);

/** A short plain-words warning or heads-up at the top of a step. */
export const Notice: FC<{ children: React.ReactNode; tone?: 'info' | 'warn' }> = ({ children, tone = 'info' }) => (
  <div
    role="note"
    style={{
      margin: '0 0 14px', padding: '10px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)',
      border: `1px solid ${tone === 'warn' ? '#d97706' : 'var(--accent)'}`, borderLeftWidth: 4,
    }}
  >
    {children}
  </div>
);

/** The row of numbered stages: the current one is highlighted, finished ones are filled in, and only the current one's body is shown. */
export const StepNav: FC<{ labels: string[]; active: number; onChange: (n: number) => void }> = ({ labels, active, onChange }) => (
  <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
    {labels.map((label, index) => {
      const n = index + 1;
      const current = n === active;
      const past = n < active;
      return (
        <button
          key={label} role="tab" aria-selected={current} onClick={() => onChange(n)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 6px 8px', borderRadius: 999, cursor: 'pointer', fontSize: 13,
            border: `1px solid ${current || past ? 'var(--accent)' : 'var(--border-subtle)'}`,
            background: current ? 'var(--accent)' : 'transparent',
            color: current ? '#fff' : past ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: current ? 600 : 400,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 20, height: 20, borderRadius: 999, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: current ? 'rgba(255,255,255,0.25)' : past ? 'var(--accent)' : 'var(--border-subtle)', color: current || past ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {past ? '✓' : n}
          </span>
          {label}
        </button>
      );
    })}
  </div>
);

/** One numbered stage of a procedure: a badge, a heading and what it does, then its controls. */
export const Step: FC<{ n: number; title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }> = ({
  n, title, subtitle, right, children,
}) => (
  <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: 'var(--accent)', color: '#fff',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {n}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

export const Stat: FC<{ label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad'; loading?: boolean }> = ({ label, value, hint, tone, loading }) => (
  <div style={{ flex: '1 1 150px', minWidth: 140, padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
    <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    <div
      style={{
        fontSize: 22, fontWeight: 600, marginTop: 2,
        color: tone === 'bad' ? '#ef4444' : tone === 'warn' ? '#d97706' : tone === 'good' ? '#16a34a' : 'var(--text-primary)',
      }}
    >
      {loading ? <IconLoader2 size={20} aria-label="Loading" className="motion-safe:animate-spin" style={{ color: 'var(--text-muted)' }} /> : value}
    </div>
    {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
  </div>
);

export const Bar: FC<{ value: number; max: number; color?: string }> = ({ value, max, color }) => (
  <div style={{ height: 8, borderRadius: 4, background: 'var(--border-subtle)', overflow: 'hidden' }}>
    <div
      style={{
        height: '100%', width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`,
        background: color ?? 'var(--accent)', transition: 'width 300ms ease',
      }}
    />
  </div>
);

export const Button: FC<{
  onClick: () => void; children: React.ReactNode; disabled?: boolean; loading?: boolean;
  kind?: 'primary' | 'danger' | 'plain'; title?: string;
}> = ({ onClick, children, disabled: off, loading, kind = 'plain', title }) => {
  const disabled = off || loading;
  return (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-busy={loading || undefined}
    title={title}
    style={{
      padding: '7px 14px', fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      border: kind === 'plain' ? '1px solid var(--border-subtle)' : '1px solid transparent',
      background: kind === 'primary' ? 'var(--accent)' : kind === 'danger' ? '#dc2626' : 'transparent',
      color: kind === 'plain' ? 'var(--text-primary)' : '#fff',
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}
  >
    {loading && <IconLoader2 size={14} aria-hidden="true" className="motion-safe:animate-spin" />}
    {children}
  </button>
  );
};

export const Pill: FC<{ text: string; color: string }> = ({ text, color }) => (
  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, color: '#fff', background: color }}>{text}</span>
);

// ── Loading placeholder: the page's cards as pulsing blocks ──────────────────

const block = (width: string | number, height: number, radius = 6, opacity = 1): React.CSSProperties => ({
  width, height, borderRadius: radius, background: 'var(--border-subtle)', opacity,
});

const SkeletonCard: FC<{ rows?: number; tiles?: number }> = ({ rows = 0, tiles = 0 }) => (
  <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 20 }}>
    <div style={block(180, 14)} />
    <div style={{ ...block('70%', 10, 6, 0.6), marginTop: 10 }} />
    {tiles > 0 && (
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} style={{ flex: '1 1 150px', minWidth: 140, padding: '12px 14px', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
            <div style={block(80, 9)} />
            <div style={{ ...block(56, 22), marginTop: 8 }} />
          </div>
        ))}
      </div>
    )}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
        <div style={block(32, 32, 8)} />
        <div style={{ flex: 1 }}>
          <div style={block(`${40 + ((i * 17) % 35)}%`, 10)} />
          <div style={{ ...block('22%', 8, 6, 0.6), marginTop: 6 }} />
        </div>
        <div style={block(60, 20, 999)} />
      </div>
    ))}
  </div>
);

/** Shown while the first status request is in flight (or has failed). */
export const MigrationSkeleton: FC<{ error?: string | null }> = ({ error }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: error ? '#ef4444' : 'var(--text-secondary)', fontSize: 13 }}>
      {!error && (
        <span
          className="motion-safe:animate-pulse"
          style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', display: 'inline-block' }}
        />
      )}
      {error ?? 'Reading the RAG pipeline…'}
    </div>
    <div
      className={error ? undefined : 'motion-safe:animate-pulse motion-reduce:animate-none'}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <SkeletonCard tiles={4} />
      <SkeletonCard tiles={4} rows={2} />
      <SkeletonCard rows={4} />
      <SkeletonCard tiles={3} />
    </div>
  </div>
);
