'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Shared behavior for the two already-separated panel shells.
 * Focus stays inside an open mobile drawer, Escape closes it, and background
 * scrolling is suspended without touching authentication or navigation data.
 */
export function useMobileSidebar(pathname: string) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    panel?.querySelector<HTMLButtonElement>('.sidebar-close')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((node) => node.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const media = window.matchMedia('(min-width: 901px)');
    const onWideViewport = () => { if (media.matches) setOpen(false); };
    media.addEventListener('change', onWideViewport);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      media.removeEventListener('change', onWideViewport);
      document.body.style.overflow = previousOverflow;
      // A closed mobile dialog returns keyboard focus to its trigger.
      if (document.activeElement && panel?.contains(document.activeElement)) {
        triggerRef.current?.focus();
      }
    };
  }, [open]);

  return { open, setOpen, triggerRef, panelRef };
}
