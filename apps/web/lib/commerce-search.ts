/** Single contract for bounded, tenant-scoped commerce lookup and shareable URLs. */
export function parseCommerceSearch(raw: string | null | undefined): string {
  return typeof raw === 'string' ? raw.trim().slice(0, 80) : '';
}

export function orderSearchCondition(search: string) {
  if (!search) return {};
  return { OR: [
    { orderNumber: { contains: search, mode: 'insensitive' as const } },
    { customerReference: { contains: search, mode: 'insensitive' as const } },
  ] };
}

export function productSearchCondition(search: string) {
  if (!search) return {};
  return { OR: [
    { name: { contains: search, mode: 'insensitive' as const } },
    { internalSku: { contains: search, mode: 'insensitive' as const } },
    { internalBarcode: { contains: search, mode: 'insensitive' as const } },
  ] };
}

export function parseProductStatus(raw: string | null | undefined): 'DRAFT' | 'ACTIVE' | undefined {
  return raw === 'DRAFT' || raw === 'ACTIVE' ? raw : undefined;
}

export function commercePageUrl(
  path: '/commerce/orders' | '/commerce/products',
  page: number,
  filters: { status?: string; q?: string } = {},
): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return path + (query ? '?' + query : '');
}
