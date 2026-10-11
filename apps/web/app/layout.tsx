import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Magazala',
  description: 'E-ticaret operasyonu, yaratıcı üretim ve ürün araştırma platformu',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
