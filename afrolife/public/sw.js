const CACHE = 'afrolife-shell-v37';
const SHELL = ['/', '/styles.css', '/financial-workspaces.css', '/app.js', '/api-errors.js', '/mfi.js', '/accounting.js', '/accounting-dashboard.js', '/accounting-operations.js', '/global-bi.js', '/tenant-data-admin.js', '/mini-app-access.js', '/edir.js', '/privacy.js', '/i18n.js', '/workspace-navigation.js', '/workspace-search.js', '/manifest.webmanifest', '/icon.svg', '/icons/afrosherik-icon-192.png', '/icons/afrosherik-icon-256.png', '/icons/afrosherik-icon-512.png', '/brand/afrosherik-brand-lockup.png', '/brand/afrosherik-campaign-hero.png',
  '/mini-apps/registry.js', '/mini-apps/accounting/manifest.js', '/mini-apps/workforce-management/manifest.js', '/mini-apps/staffing/manifest.js', '/mini-apps/property-management/manifest.js', '/mini-apps/marketplace/manifest.js',
  '/mini-apps/marketplace/logo.svg', '/mini-apps/property-management/logo.svg', '/mini-apps/staffing/logo.svg', '/mini-apps/workforce-management/logo.svg',
  '/mini-apps/leads/logo.svg', '/mini-apps/contracts/logo.svg', '/mini-apps/commissions/logo.svg', '/mini-apps/rent/logo.svg', '/mini-apps/agents/logo.svg',
  '/mini-apps/edir/logo.svg', '/mini-apps/mfi/logo.svg', '/mini-apps/insurance/logo.svg'];
const SHELL_PATHS = new Set(SHELL);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('afrolife-shell-') && key !== CACHE).map((key) => caches.delete(key)),
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search
      || request.headers.has('authorization') || request.headers.has('range')) return;

  // Only the public application shell may be cached. Member, identity,
  // financial, and document routes are deliberately network-only.
  const path = url.pathname;
  if (!SHELL_PATHS.has(path)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      const cacheControl = response.headers.get('cache-control') ?? '';
      if (response.ok && !/\b(private|no-store)\b/i.test(cacheControl)) {
        await cache.put(path, response.clone());
      }
      return response;
    } catch {
      return (await cache.match(path)) ?? Response.error();
    }
  })());
});
