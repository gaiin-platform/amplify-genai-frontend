'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef } from 'react';
import {
  ACTIVITY_EVENTS,
  ACTIVITY_WRITE_THROTTLE_MS,
  INACTIVITY_CHECK_INTERVAL_MS,
  clearLastActivity,
  isInactive,
  latestActivity,
  writeLastActivity,
} from '@/utils/app/sessionActivity';

// Signs the user out after INACTIVITY_TIMEOUT_MS without activity in *any* open tab.
//
// - Activity is shared across tabs through localStorage. signOut() clears the shared session
//   cookie (logging out every tab), so an idle background tab must not be able to sign out a
//   tab the user is actively working in.
// - Inactivity is judged by comparing wall-clock timestamps on an interval (and when the tab
//   becomes visible) rather than by one long setTimeout, so laptop sleep / throttled
//   background timers cannot delay or mis-fire the check.
export function SessionActivityTracker() {
  const { status } = useSession();
  const lastActivityRef = useRef(Date.now());
  const lastWriteRef = useRef(0);
  const signingOutRef = useRef(false);

  // Depend on the auth status, not the session object. next-auth replaces that object on every
  // poll (SessionProvider refetches every 60 s) and on every window focus, which would re-run
  // this effect on each poll.
  const isAuthenticated = status === 'authenticated';
  const isUnauthenticated = status === 'unauthenticated';

  useEffect(() => {
    // Forget stale activity once we know the user is logged out so it can't leak into a later login.
    if (isUnauthenticated) clearLastActivity(window.localStorage);
  }, [isUnauthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const storage = (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })();

    signingOutRef.current = false;

    const recordActivity = (now: number) => {
      lastActivityRef.current = now;
      lastWriteRef.current = now;
      writeLastActivity(storage, now);
    };

    const forceSignOut = () => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      console.warn('[SessionActivityTracker] Signing out after inactivity.');
      clearLastActivity(storage);
      signOut({ callbackUrl: '/?reason=inactivity' });
    };

    const checkInactivity = () => {
      if (isInactive(latestActivity(lastActivityRef.current, storage), Date.now())) forceSignOut();
    };

    const onActivity = () => {
      const now = Date.now();
      // If the user was already past the limit (e.g. returning to a long-idle tab before the
      // interval ran), sign out rather than letting this first interaction rescue the session.
      if (isInactive(latestActivity(lastActivityRef.current, storage), now)) {
        forceSignOut();
        return;
      }
      if (now - lastWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return;
      recordActivity(now);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkInactivity();
    };

    // capture: scroll doesn't bubble, so without it only page-level scrolling would register.
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, onActivity, { capture: true, passive: true })
    );
    document.addEventListener('visibilitychange', onVisibilityChange);
    const intervalId = window.setInterval(checkInactivity, INACTIVITY_CHECK_INTERVAL_MS);

    // Loading the app counts as activity.
    recordActivity(Date.now());

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, onActivity, { capture: true })
      );
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  return null; // This component doesn't render anything
}
