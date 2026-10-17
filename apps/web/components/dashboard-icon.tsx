import type { ReactNode } from 'react';

export type DashboardIconName =
  | 'orders' | 'products' | 'stock' | 'stores' | 'warning'
  | 'warehouse' | 'activity' | 'arrow' | 'clock' | 'check';

export function DashboardIcon({ name, size = 20 }: { name: DashboardIconName; size?: number }) {
  const drawings: Record<DashboardIconName, ReactNode> = {
    orders: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6M9 8h6M9 12h6M9 16h3"/></>,
    products: <><path d="m3 7 9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10M7.5 5l9 4"/></>,
    stock: <><path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-7h6v7M8 9h.01M16 9h.01"/></>,
    stores: <><path d="M3 10h18l-2-6H5zM5 10v10h14V10M9 20v-7h6v7"/><path d="M3 10c0 2 3 3 4.5 0 1.5 3 4.5 2 4.5 0 1.5 3 4.5 2 4.5 0 1.5 3 4.5 2 4.5 0"/></>,
    warning: <><path d="M10.3 4.1 2.7 17.3A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.7L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>,
    warehouse: <><path d="m3 9 9-6 9 6v12H3zM3 9h18M8 21v-8h8v8"/></>,
    activity: <><path d="M3 12h4l3-7 4 14 3-7h4"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {drawings[name]}
  </svg>;
}
