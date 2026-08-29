import type { NextConfig } from 'next';

/**
 * Static export, because this ships to GitHub Pages next to the main site and
 * there is no Node process there to serve it.
 *
 * The app always lives under /experience/, with or without a deploy prefix.
 * BASE_PATH is the Pages project-site prefix — the repository name — which the
 * workflow passes and a local build does not.
 *
 * The /experience part is not optional when BASE_PATH is absent, which is how
 * this was first written. Next bakes absolute asset URLs into the export, so a
 * build with no basePath asks for /_next/... while the page it is on is served
 * from /experience/ — every chunk 404s and the page is blank. The asset check
 * in tools/__tests__ is what caught it.
 */
const prefix = process.env.BASE_PATH ? `/${process.env.BASE_PATH.replace(/^\/|\/$/g, '')}` : '';
const base = `${prefix}/experience`;

const nextConfig: NextConfig = {
  output: 'export',
  basePath: base,
  assetPrefix: base,
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
