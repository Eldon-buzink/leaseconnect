import { NextResponse } from 'next/server';

// Minimal 1x1 transparent GIF so /favicon.ico doesn't 404
const FAVICON_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export function GET() {
  return new NextResponse(FAVICON_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
