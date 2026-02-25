'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 40, fontFamily: 'sans-serif', color: '#333' }}>
        <h1 style={{ color: '#c00' }}>Application error</h1>
        <p>{error.message}</p>
        <button onClick={reset} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
