'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useRef } from 'react';

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour of inactivity

export function SessionActivityTracker() {
  const { data: session } = useSession();
  const lastActivityRef = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!session) return;

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
  }, [session]);

  return null; // This component doesn't render anything
}
