import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { miniAppByPanel, miniApps } from '../public/mini-apps/registry.js';
import { normalizeSubscriptionCatalog, subscriptionRequestPayload } from '../public/subscriptions.js';
import { getPublicSubscriptionCatalog } from '../src/subscriptions.js';

test('each Agency mini-app declares a unique module, panel, and gateway API surface', () => {
  const ids = new Set<string>();
  const panels = new Set<string>();
  for (const miniApp of miniApps) {
    assert.ok(miniApp.id);
    assert.ok(miniApp.name);
    assert.ok(miniApp.logo?.startsWith('/mini-apps/'),
      `${miniApp.id} must use a branded mini-app logo or the approved AfroLife mark`);
    const logo = readFileSync(new URL(`../public${miniApp.logo}`, import.meta.url), 'utf8');
    assert.match(logo, /<title/);
    assert.match(logo, /#174b3d/i);
    assert.match(logo, /#d7ad59/i);
    assert.ok(miniApp.description);
    assert.ok(miniApp.panels.length > 0);
    assert.ok(miniApp.api.length > 0);
    assert.equal(ids.has(miniApp.id), false, `duplicate mini-app ${miniApp.id}`);
    ids.add(miniApp.id);
    for (const panel of miniApp.panels) {
      assert.equal(panels.has(panel), false, `duplicate panel ${panel}`);
      panels.add(panel);
      assert.equal(miniAppByPanel[panel], miniApp);
    }
    for (const endpoint of miniApp.api) {
      assert.ok(endpoint.startsWith('/'), `${miniApp.id} API endpoints must be same-origin API paths`);
    }
  }
  assert.deepEqual([...ids].sort(), ['accounting', 'marketplace', 'property-management', 'staffing', 'workforce-management']);
  assert.equal(miniApps.find((miniApp) => miniApp.id === 'workforce-management')?.name, 'Workforce Management');
  assert.equal(miniAppByPanel.accounting?.id, 'accounting');
  assert.equal(miniAppByPanel.accounting?.name, 'Accounting & Finance');
  assert.equal(miniAppByPanel.accounting?.logo, '/mini-apps/accounting/logo.svg');
  assert.deepEqual(miniAppByPanel.accounting?.panels, ['accounting']);
});

test('integrated agency and community workspaces have branded logo assets', () => {
  for (const module of ['leads', 'contracts', 'commissions', 'rent', 'agents', 'edir', 'mfi', 'insurance']) {
    const logo = readFileSync(new URL(`../public/mini-apps/${module}/logo.svg`, import.meta.url), 'utf8');
    assert.match(logo, /<title/);
    assert.match(logo, /#174b3d/);
    assert.match(logo, /#d7ad59/);
  }
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /function miniAppLogo\(panel\)/);
  assert.match(app, /function decoratePublicServiceLogos\(\)/);
  assert.match(app, /service-icon service-icon-image/);
  assert.match(app, /page-mini-app-logo/);
});

test('Accounting has a central launcher entry and is removed from module views as a cross-app catalog', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(html, /data-panel="accounting"[^>]*>[\s\S]*?Accounting &amp; Finance/);
  assert.match(html, /id="return-super-app"/);
  assert.match(app, /function renderSuperAppLauncher\(\)/);
  assert.match(app, /function renderOverview\(\)/);
  assert.doesNotMatch(app, /function renderOverviewActions\(\)/);
  assert.match(app, /const accessibleModules = \[\.\.\.document\.querySelectorAll\('\.tab\[data-panel\]:not\(\[hidden\]\)'\)\]/);
  assert.match(app, /launcher: renderSuperAppLauncher/);
});

test('Accounting is included in the shared subscription request catalog and entitlement guard', () => {
  const catalog = getPublicSubscriptionCatalog().services;
  const accounting = catalog.find((service) => service.key === 'accounting');
  assert.deepEqual(accounting, {
    key: 'accounting',
    name: 'Accounting & Finance',
    monthly_fee: 1000,
    currency: 'ETB',
    payment_method: 'manual',
  });
  assert.deepEqual(normalizeSubscriptionCatalog({ services: catalog })?.find((service) => service.key === 'accounting'), {
    key: 'accounting',
    name: 'Accounting & Finance',
    monthlyEtb: 1000,
    requestKey: 'accounting',
  });
  assert.deepEqual(subscriptionRequestPayload(['accounting', 'accounting']), { services: ['accounting'] });

  const subscriptions = readFileSync(new URL('../src/subscriptions.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
  const authentication = server.indexOf('api.use(authenticate);');
  const accountingEntitlement = server.indexOf("api.use('/accounting', (req, _res, next) =>");
  assert.ok(authentication >= 0 && accountingEntitlement > authentication);
  assert.match(subscriptions, /'accounting', 'property_management'/);
  assert.match(subscriptions, /services: z\.array\(z\.enum\(serviceKeys\)\)/);
  assert.match(server, /hasMiniAppAccess\(req\.user!, 'accounting'\)/);
  assert.match(server, /service_key='accounting' AND status='active' AND active_until>now\(\)/);
  assert.match(server, /if \(!subscribed\) allowedModules = allowedModules\.filter\(\(module\) => module !== 'accounting'\)/);
  assert.match(server, /const internalAccountingGateway = process\.env\.ACCOUNTING_SERVICE_URL/);
  assert.match(server, /const subscriberAccountingGateway = process\.env\.ACCOUNTING_SUBSCRIBER_SERVICE_URL/);
  assert.match(server, /const subscriber = \['customer','property_owner'\]\.includes\(req\.user\?\.role \?\? ''\)/);
});

test('Accounting retains dedicated entity BI and reports on the existing gateway route', () => {
  const workspace = readFileSync(new URL('../public/accounting.js', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../public/accounting-dashboard.js', import.meta.url), 'utf8');
  const router = readFileSync(new URL('../services/accounting/router.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(workspace, /createAccountingTrend/);
  assert.match(workspace, /trial-balance/);
  assert.match(workspace, /income-statement/);
  assert.match(workspace, /balance-sheet/);
  assert.match(workspace, /general-ledger/);
  assert.match(dashboard, /selected entity/);
  assert.match(router, /router\.get\('\/entities\/:entityId\/dashboard'/);
  assert.match(router, /router\.get\('\/entities\/:entityId\/reports\/:report'/);
  assert.match(server, /api\.use\('\/accounting', \(req, res, next\) => \{\s*const subscriber/);
  assert.match(server, /return gateway\(req, res, next\)/);
});

test('existing rent workspace drives the approved lease lifecycle without removing the legacy API route', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const operations = readFileSync(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(app, /api\('\/leases\/workflow'/);
  assert.match(app, /lease-submit-approval/);
  assert.match(app, /lease-approve/);
  assert.match(app, /lease-signature/);
  assert.match(app, /lease-execute/);
  assert.match(app, /dataset\.form = 'lease-notice'/);
  assert.match(app, /does not verify legal service/);
  assert.match(app, /signature files are retained as evidence only/);
  assert.match(operations, /ops\.post\('\/leases', requireActivity\('property\.tenancy\.manage'\)/);
  assert.match(operations, /if \(!legacyImmediateLeasesEnabled\(process\.env\)\)/);
});

test('AfroLife identity and retained install artwork stay aligned with the brand shell', () => {
  const logo = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
  assert.match(logo, /<title[^>]*>AfroLife mark/);
  assert.doesNotMatch(logo, /<rect\b[^>]*fill="#0B2D4A"/i);
  assert.match(logo, /#00B85A/i);
  assert.match(logo, /#0066FF/i);
  assert.match(logo, /#FFB000/i);

  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'AfroLife Agency');
  assert.equal(manifest.short_name, 'AfroLife');
  assert.equal(manifest.theme_color, '#174b3d');
  assert.ok(manifest.icons.slice(0, 2).every((entry: { purpose: string }) => entry.purpose === 'any'));
  for (const size of [192, 256, 512]) {
    const iconPath = `/icons/afrolife-icon-${size}.png`;
    const icon = readFileSync(new URL(`../public${iconPath}`, import.meta.url));
    assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.ok(manifest.icons.some((entry: { src: string; sizes: string }) =>
      entry.src === iconPath && entry.sizes === `${size}x${size}`));
  }

  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /src="\/brand\/afrolife-brand-lockup\.svg"/);
  assert.match(html, /afrolife-icon-192\.png/);
  assert.match(html, /placeholder="https:\/\/afrolife-agency\.duckdns\.org"/);
  const manifestColor = html.match(/<meta name="theme-color" content="([^"]+)"/);
  assert.equal(manifestColor?.[1], manifest.theme_color);
});

test('native Android launcher and splash resources use the AfroLife brand', () => {
  const resources = new URL('../android/app/src/main/res/', import.meta.url);
  const adaptiveMark = readFileSync(new URL('drawable-v24/ic_launcher_foreground.xml', resources), 'utf8');
  const adaptiveBackground = readFileSync(new URL('values/ic_launcher_background.xml', resources), 'utf8');
  const splash = readFileSync(new URL('drawable/splash.png', resources));
  assert.match(adaptiveMark, /#FF00B85A/i);
  assert.match(adaptiveMark, /#FF0066FF/i);
  assert.match(adaptiveMark, /#FFFFB000/i);
  assert.match(adaptiveBackground, /#00000000/i);
  const manifest = readFileSync(new URL('AndroidManifest.xml', new URL('../android/app/src/main/', import.meta.url)), 'utf8');
  const appStrings = readFileSync(new URL('values/strings.xml', resources), 'utf8');
  const capacitorConfig = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  const iosInfo = readFileSync(new URL('../ios/App/App/Info.plist', import.meta.url), 'utf8');
  assert.match(appStrings, /<string name="app_name">አፍሮ-ላይፍ ኤጄንሲ \/ AfroLife Agency<\/string>/);
  assert.equal(capacitorConfig.appName, 'አፍሮ-ላይፍ ኤጄንሲ / AfroLife Agency');
  assert.match(iosInfo, /<key>CFBundleDisplayName<\/key>\s*<string>AfroLife Agency<\/string>/);
  assert.match(manifest, /android:networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(manifest, /android:allowBackup="false"/);
  const debugTrust = readFileSync(new URL('../android/app/src/debug/res/xml/network_security_config.xml', import.meta.url), 'utf8');
  assert.match(debugTrust, /<certificates src="user"\s*\/>/);
  assert.match(debugTrust, /cleartextTrafficPermitted="false"/);
  assert.equal(splash.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(splash.readUInt32BE(16), 480);
  assert.equal(splash.readUInt32BE(20), 320);
  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    const icon = readFileSync(new URL(`mipmap-${density}/ic_launcher.png`, resources));
    assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
});
