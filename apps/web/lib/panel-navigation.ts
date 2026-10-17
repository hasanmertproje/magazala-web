/**
 * Panel-specific navigation is deliberately independent of the user's role.
 * Super admins may enter a workspace, but its sidebar must never inherit admin routes.
 */
export const workspaceNavigationSections = [
  ['Genel', [['Kontrol Paneli', '/dashboard']]],
  ['Mağaza Yönetimi', [
    ['Mağazalar ve Entegrasyonlar', '/commerce/stores'],
    ['Siparişler', '/commerce/orders'],
    ['Ürün Kataloğu', '/commerce/products'],
    ['Stok ve Depo', '/commerce/inventory'],
    ['Barkod ve SKU', '/commerce/barcodes'],
    ['Veri Aktarımı', '/commerce/import-export'],
  ]],
  ['Operasyon', [
    ['İş Akışları', '/automation/workflows'],
    ['Projeler', '/workspace/projects'],
    ['Dosyalar', '/workspace/assets'],
  ]],
  ['Eklentiler', [
    ['Görsel Stüdyosu', '/create/design-studio'],
    ['Ürün Araştırması', '/create/product-intelligence'],
  ]],
  ['Hesap ve Destek', [
    ['Bildirimler', '/notifications'],
    ['Paketim ve Kredilerim', '/billing'],
    ['Yardım', '/help/info'],
  ]],
] as const;

export const adminNavigationSections = [
  ['Platform', [
    ['Müşteriler', '/admin/workspaces'],
    ['Kullanıcılar', '/admin/users'],
    ['Paketler ve Krediler', '/admin/packages'],
  ]],
  ['Sağlayıcı Yönetimi', [
    ['Model Sağlayıcıları', '/admin/providers'],
    ['Modeller', '/admin/models'],
    ['Model Yönlendirme', '/admin/router'],
  ]],
  ['Sistem', [
    ['Geliştirme Talepleri', '/admin/requirements'],
    ['Sistem Durumu', '/admin/system'],
  ]],
] as const;

export function navigationForPanel(panel: 'admin' | 'workspace') {
  return panel === 'admin' ? adminNavigationSections : workspaceNavigationSections;
}
