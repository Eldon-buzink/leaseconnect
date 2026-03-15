'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export function Nav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const isDashboard = pathname === '/';
  const isCars = isDashboard && (view !== 'review');
  const isReview = isDashboard && view === 'review';

  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="site-nav-inner">
        <Link href="/" className="site-nav-brand">
          Leaseconnect
        </Link>
        <div className="site-nav-main">
          <Link
            href="/"
            className={`site-nav-link ${isCars ? 'active' : ''}`}
          >
            Inventory
          </Link>
          <Link
            href="/?view=review"
            className={`site-nav-link ${isReview ? 'active' : ''}`}
          >
            Review queue
          </Link>
        </div>
        <div className="site-nav-actions">
          <span className="site-nav-placeholder" title="Coming soon">
            Import
          </span>
          <span className="site-nav-placeholder" title="Coming soon">
            Export
          </span>
          <span className="site-nav-placeholder" title="Coming soon">
            Account
          </span>
        </div>
      </div>
    </nav>
  );
}
