import { esc, attr } from './layout.mjs';

/**
 * A static 301-equivalent: canonical + refresh + script, so a legacy URL keeps
 * resolving on any plain static host without server rules.
 */
export function renderRedirect({ site, to }) {
  const target = `${site.brand.url}${to}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting… – ${esc(site.brand.name)}</title>
<link rel="canonical" href="${attr(target)}">
<meta name="robots" content="noindex, follow">
<meta http-equiv="refresh" content="0; url=${attr(to)}">
<script>location.replace(${JSON.stringify(to)});</script>
</head>
<body>
<p>This page has moved to <a href="${attr(to)}">${esc(to)}</a>.</p>
</body>
</html>
`;
}
