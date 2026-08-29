import type { NextConfig } from 'next';

/**
 * Static export, because this ships to GitHub Pages next to the main site and
 * there is no Node process there to serve it.
 *
 * BASE_PATH is the Pages project-site prefix (the repository name) and the
 * mount point under it. The workflow passes it; locally it is empty and the app
 * serves from the root.
 */
const base = process.env.BASE_PATH ? `/${process.env.BASE_PATH}/experience` : '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: base,
  assetPrefix: base || undefined,
  // next/image needs a server to optimise; a static export has none.
  images: { unoptimized: true },
  // Pages serves /experience/ as a directory, so every route needs its own
  // index.html rather than a sibling .html file.
  trailingSlash: true,
  // next/image and <Link> get the prefix for free; a raw fetch for the GLB does
  // not, so the same value has to reach the client for lib/scroll.ts asset().
  env: { NEXT_PUBLIC_BASE_PATH: base },
};

export default nextConfig;
