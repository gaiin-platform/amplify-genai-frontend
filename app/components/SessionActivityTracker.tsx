'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef } from 'react';

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour of inactivity

export function SessionActivityTracker() {
  const { data: session } = useSession();
  const lastActivityRef = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Depend on "is there a session", not the session object. next-auth replaces that object on
  // every poll (SessionProvider refetches every 60 s) and on every window focus, which re-ran
  // this effect and restarted the inactivity timer, so the one-hour logout could never fire
  // while the tab could poll.
  const hasSession = Boolean(session);

  useEffect(() => {
    if (!hasSession) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();

      // Clear old timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        signOut({ callbackUrl: '/?reason=inactivity' });
      }, INACTIVITY_TIMEOUT);
    };

    // Track user activity events
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hasSession]);

  return null; // This component doesn't render anything
}
