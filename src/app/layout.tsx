import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'VEX — Sound in Play', description: 'An instrumental music studio for your tennis universe. Explore 24 presets, three Pixazo models, and endless new directions.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
