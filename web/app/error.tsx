'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#333', maxWidth: 600 }}>
      <h1 style={{ color: '#c00' }}>Something went wrong</h1>
      <p>{error.message}</p>
      <button
        onClick={reset}
        style={{ padding: '10px 20px', marginTop: 16, cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  );
}
