/**
 * UIPreferenceBanner — shown once when the user hasn't yet chosen
 * between the Classic UI and the New UI.
 *
 * Behavior:
 *   - Reads localStorage key `amplify_new_ui_preference`
 *   - If not set, shows a centered modal asking the user
 *   - "Try New UI" → sets preference to 'new', sets cookie X-Amplify-UI=new, calls onSelectNew()
 *   - "Stay Classic" → sets preference to 'classic', calls onSelectClassic()
 *   - User can always switch later via Settings → Appearance
 *
 * The cookie is for future load-balancer routing:
 *   LB listener rule #3 on port 443 matches X-Amplify-UI=new
 *   and forwards to the new-UI target group.
 */
import React, { useEffect, useState } from 'react';
import { saveUserSettings, fetchUserSettings } from '@/services/settingsService';

export const UI_PREF_KEY = 'amplify_new_ui_preference';
export type UIPreference = 'new' | 'classic' | null;

export function getUIPreference(): UIPreference {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(UI_PREF_KEY);
  if (val === 'new' || val === 'classic') return val;
  return null;
}

/**
 * Persist the UI preference to:
 *   1. localStorage  (immediate, same-device)
 *   2. A cookie      (for future load-balancer routing)
 *   3. Server-side user settings (cross-device / cross-browser)
 *
 * The server save is fire-and-forget — a failure silently falls back to
 * localStorage so the user's session isn't interrupted.
 */
export async function setUIPreference(pref: 'new' | 'classic'): Promise<void> {
  // 1. Sync storage (always succeeds locally)
  localStorage.setItem(UI_PREF_KEY, pref);

  // 2. Cookie for load-balancer routing
  if (pref === 'new') {
    document.cookie = 'X-Amplify-UI=new; path=/; SameSite=Lax; max-age=31536000';
  } else {
    document.cookie = 'X-Amplify-UI=; path=/; SameSite=Lax; max-age=0';
  }

  // 3. Server-side persistence (fire-and-forget)
  try {
    // Fetch current settings first so we don't overwrite other fields
    const result = await fetchUserSettings();
    const current = result?.success && result.data ? result.data : {};
    await saveUserSettings({ ...current, uiPreference: pref });
  } catch {
    // Non-fatal — localStorage already holds the value
  }
}

interface UIPreferenceBannerProps {
  onSelectNew: () => void;
  onSelectClassic: () => void;
}

export const UIPreferenceBanner: React.FC<UIPreferenceBannerProps> = ({
  onSelectNew,
  onSelectClassic,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if no preference has been saved
    const pref = getUIPreference();
    if (!pref) setVisible(true);
  }, []);

  if (!visible) return null;

  const handleNew = () => {
    setVisible(false);
    onSelectNew();
    // Fire-and-forget — don't await so the UI switches immediately
    setUIPreference('new').catch(() => {});
  };

  const handleClassic = () => {
    setVisible(false);
    onSelectClassic();
    setUIPreference('classic').catch(() => {});
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className={`
          relative w-full max-w-[520px] mx-4
          bg-[--bg-raised] border border-[--border-subtle]
          rounded-[--radius-panel]
          shadow-[0_24px_60px_rgba(0,0,0,0.5)]
          p-8
          animate-fade-in
        `}
        style={{ transformOrigin: 'center' }}
      >
        {/* Accent mark */}
        <div className="flex items-center gap-2 mb-6">
          <span
            className="text-[22px] leading-none"
            style={{ color: 'var(--accent)' }}
          >
            ✳
          </span>
          <span
            className="text-[22px] text-[--text-primary] tracking-[-0.01em]"
            style={{ fontFamily: '"Newsreader", "Georgia", serif', fontWeight: 400 }}
          >
            Amplify
          </span>
        </div>

        <h2 className="text-[22px] font-medium text-[--text-primary] mb-3 leading-tight">
          We have a new look
        </h2>
        <p className="text-[15px] text-[--text-secondary] mb-8 leading-relaxed">
          We&apos;ve redesigned Amplify with a cleaner, more focused interface. You
          can switch back to the classic view at any time from Settings →
          Appearance.
        </p>

        {/* Comparison row — clicking a card directly selects the UI */}
        <div className="grid grid-cols-2 gap-3">
          {/* New UI preview card */}
          <div
            className="rounded-[10px] border-2 border-[--accent] bg-[--bg-app] p-4 cursor-pointer hover:bg-[--bg-hover] transition-colors"
            onClick={handleNew}
          >
            <div className="text-[13px] font-medium text-[--text-primary] mb-1">New UI</div>
            <div className="text-[12px] text-[--text-muted] leading-relaxed">
              Clean sidebar, unified navigation, modern composer
            </div>
            <div className="mt-3 text-[11px] font-medium text-[--accent] uppercase tracking-wide">
              Recommended
            </div>
          </div>

          {/* Classic preview card */}
          <div
            className="rounded-[10px] border border-[--border-subtle] bg-[--bg-app] p-4 cursor-pointer hover:bg-[--bg-hover] transition-colors"
            onClick={handleClassic}
          >
            <div className="text-[13px] font-medium text-[--text-primary] mb-1">Classic UI</div>
            <div className="text-[12px] text-[--text-muted] leading-relaxed">
              Original interface with three-tab sidebar
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UIPreferenceBanner;
