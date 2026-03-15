/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Read NEXT_PUBLIC_* directly from environment (.env.local).
}

module.exports = nextConfig

