export interface InternalSkuOptions {
  prefix?: string;
  sequence: number;
  width?: number;
}

export function createInternalSku({ prefix = 'PRD', sequence, width = 6 }: InternalSkuOptions): string {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new Error('INVALID_SKU_SEQUENCE');
  const normalizedPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!normalizedPrefix) throw new Error('INVALID_SKU_PREFIX');
  return `${normalizedPrefix}-${String(sequence).padStart(width, '0')}`;
}

/**
 * Internal-only barcode value. This is not GTIN/EAN and must never be presented as one.
 * Check digit is Mod-10 over a private numeric namespace.
 */
export function createInternalBarcode(namespace: number, sequence: number): string {
  if (!Number.isSafeInteger(namespace) || namespace < 1 || namespace > 999) throw new Error('INVALID_NAMESPACE');
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999999999) throw new Error('INVALID_SEQUENCE');
  const body = `${String(namespace).padStart(3, '0')}${String(sequence).padStart(9, '0')}`;
  const digits = body.split('').map(Number);
  const sum = digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return `${body}${check}`;
}
