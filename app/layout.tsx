import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Nav } from './components/Nav';

export const metadata: Metadata = {
  title: 'Leaseconnect - Vehicle Matching Dashboard',
  description: 'Dashboard for viewing and managing vehicle offer matches',
};

function NavFallback() {
  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="site-nav-inner">
        <span className="site-nav-brand">Leaseconnect</span>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="app-body">
        <Suspense fallback={<NavFallback />}>
          <Nav />
        </Suspense>
        <div id="root-app" className="app-shell">
          <main className="app-main">
            <div className="app-container">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
