/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Use app:// protocol for Electron - this allows proper CSS/JS loading from asar
  assetPrefix: process.env.NODE_ENV === 'production' ? 'app://.' : '',
  // Disable server-side features for static export
  trailingSlash: true,
};

export default nextConfig;
