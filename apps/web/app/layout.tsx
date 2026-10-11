import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '../components/app-shell';

export const metadata: Metadata = {
  title: 'Mağazala',
  description: 'E-ticaret operasyon, ürün araştırma ve yaratıcı üretim platformu.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body><AppShell>{children}</AppShell></body></html>;
}
