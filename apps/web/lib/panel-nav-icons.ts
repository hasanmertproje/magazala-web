import type { DashboardIconName } from '../components/dashboard-icon';

export const panelIconNames: Readonly<Record<string, DashboardIconName>> = {
  '/dashboard': 'dashboard',
  '/commerce/stores': 'stores',
  '/commerce/orders': 'orders',
  '/commerce/products': 'products',
  '/commerce/inventory': 'warehouse',
  '/commerce/barcodes': 'barcode',
  '/commerce/import-export': 'exchange',
  '/automation/workflows': 'workflow',
  '/workspace/projects': 'folder',
  '/workspace/assets': 'file',
  '/create/design-studio': 'sparkles',
  '/create/product-intelligence': 'search',
  '/notifications': 'bell',
  '/billing': 'wallet',
  '/help/info': 'help',
  '/admin/workspaces': 'users',
  '/admin/users': 'users',
  '/admin/packages': 'layers',
  '/admin/providers': 'server',
  '/admin/models': 'cpu',
  '/admin/router': 'route',
  '/admin/requirements': 'clipboard',
  '/admin/system': 'settings',
};

export function panelIconForPath(path: string): DashboardIconName | undefined {
  return panelIconNames[path];
}
