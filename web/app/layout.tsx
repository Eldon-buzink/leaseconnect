import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Leaseconnect - Vehicle Matching Dashboard',
  description: 'Dashboard for viewing and managing vehicle offer matches',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
