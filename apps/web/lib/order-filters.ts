import { commercePageUrl } from './commerce-search';

/** Shared URL filters used by both the order page and its JSON API. */
export const ORDER_STATUSES = ['NEW', 'CONFIRMED', 'PACKING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
type Status = (typeof ORDER_STATUSES)[number];
export type OrderFilter = Status | 'OPEN' | undefined;
export const OPEN_ORDER_STATUSES: readonly Status[] = ['NEW', 'CONFIRMED', 'PACKING'];

export function parseOrderFilter(raw: string | null | undefined): OrderFilter {
  if (raw === 'OPEN') return 'OPEN';
  return ORDER_STATUSES.find((status) => status === raw);
}

export function orderStatusCondition(filter: OrderFilter):
  { status: Status | { in: Status[] } } | Record<string, never> {
  if (!filter) return {};
  if (filter === 'OPEN') return { status: { in: [...OPEN_ORDER_STATUSES] } };
  return { status: filter };
}

/** Bounded, strict numeric URL page; out-of-range pages are clamped to the final populated page. */
export function parsePage(raw: string | null | undefined): number {
  if (!raw || !/^[1-9]\d{0,6}$/.test(raw)) return 1;
  return Math.min(Number(raw), 1_000_000);
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
}

export function orderPageUrl(filter: OrderFilter, page: number, search = ''): string {
  return commercePageUrl('/commerce/orders', page, { status: filter, q: search });
}
