import { DashboardIcon } from './dashboard-icon';
import { panelIconForPath } from '../lib/panel-nav-icons';

export function PanelNavIcon({ href }: { href: string }) {
  const name=panelIconForPath(href);
  return <span className="nav-icon" aria-hidden="true">{name ? <DashboardIcon name={name} size={17}/> : null}</span>;
}
