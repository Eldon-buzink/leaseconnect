import type { Metadata } from 'next';
import './globals.css';
import { Nav } from './components/Nav';

export const metadata: Metadata = {
  title: 'Leaseconnect - Vehicle Matching Dashboard',
  description: 'Dashboard for viewing and managing vehicle offer matches',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, minHeight: '100vh', background: '#f5f5f5', color: '#111' }}>
        <Nav />
        <div id="root-app" style={{ minHeight: '100vh' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
