import type { ReactNode } from 'react';

export type DashboardIconName =
  | 'orders' | 'products' | 'stock' | 'stores' | 'warning'
  | 'warehouse' | 'activity' | 'arrow' | 'clock' | 'check'
  | 'dashboard' | 'barcode' | 'exchange' | 'workflow' | 'folder' | 'file'
  | 'sparkles' | 'search' | 'bell' | 'wallet' | 'help' | 'users'
  | 'layers' | 'server' | 'cpu' | 'route' | 'clipboard' | 'settings';

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
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="8" height="7" rx="1.5"/></>,
    barcode: <><path d="M4 5v14M7 5v14M11 5v14M15 5v14M17 5v14M20 5v14"/><path d="M3 3h4M17 3h4M3 21h4M17 21h4"/></>,
    exchange: <><path d="M4 7h15l-4-4M19 7l-4 4M20 17H5l4-4M5 17l4 4"/></>,
    workflow: <><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h5a4 4 0 0 1 4 4v5M15 18H9a4 4 0 0 1-4-4v-5"/></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    file: <><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 12h6M9 16h6"/></>,
    sparkles: <><path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9zM19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M8 10.5h5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9zM10 21h4"/></>,
    wallet: <><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M3 9V5a2 2 0 0 1 2-2h13M16 13h5v4h-5a2 2 0 0 1 0-4z"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.4 1.6c-1.1 1-1.9 1.3-1.9 3.1M12 17h.01"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
    server: <><rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></>,
    cpu: <><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 10h4v4h-4zM4 9h3M4 15h3M17 9h3M17 15h3M9 4v3M15 4v3M9 17v3M15 17v3"/></>,
    route: <><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 6h8"/></>,
    clipboard: <><rect x="4" y="5" width="16" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M8 12h8M8 16h5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M10 3h4l.6 2.5 2 .9 2.3-1.2 2.3 3.5-2 1.7v2.2l2 1.7-2.3 3.5-2.3-1.2-2 .9L14 21h-4l-.6-2.5-2-.9-2.3 1.2-2.3-3.5 2-1.7v-2.2l-2-1.7 2.3-3.5 2.3 1.2 2-.9z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {drawings[name]}
  </svg>;
}
