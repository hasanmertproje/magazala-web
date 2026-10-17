'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Refresh real server aggregates, never synthesize or animate changing metrics. */
export function DashboardRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    const intervalId = window.setInterval(refreshIfVisible, 60_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [router]);
  return null;
}
