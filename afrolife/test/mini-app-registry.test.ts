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
    assert.match(logo, /viewBox="0 0 96 96"/);
    assert.match(logo, /<rect width="96" height="96" rx="22" fill="#174b3d"\/>/);
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
    assert.match(logo, /viewBox="0 0 96 96"/);
    assert.match(logo, /<rect width="96" height="96" rx="22" fill="#174b3d"\/>/);
    assert.match(logo, /#174b3d/);
    assert.match(logo, /#d7ad59/);
  }
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /function miniAppLogo\(panel\)/);
  assert.match(app, /function decoratePublicServiceLogos\(\)/);
  assert.match(app, /service-icon service-icon-image/);
  assert.match(app, /\['Agent services', miniAppLogo\('agents'\)\]/);
  assert.match(app, /service-launcher-logo/);
  assert.match(app, /page-mini-app-logo/);
});

test('signed-in launcher cards expose the shared module accent and logo hooks', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  const launcher = app.slice(app.indexOf('function renderSuperAppLauncher()'), app.indexOf('function decoratePublicServiceLogos()'));

  assert.match(launcher, /'service-card workspace-launch-card service-launcher-card'/);
  assert.match(launcher, /card\.dataset\.panel = panel;/);
  assert.match(launcher, /const accessibleModules = \[\.\.\.document\.querySelectorAll\('\.tab\[data-panel\]:not\(\[hidden\]\)'\)\]/);
  assert.match(styles, /\.service-launcher-card\[data-panel\]\s*\{[^}]*border-block-start:\s*3px solid var\(--mini-app-accent\);/);
  assert.match(styles, /\.service-launcher-card\[data-panel\]\s+\.service-launcher-logo/);
});

test('Accounting has a central launcher entry and is removed from module views as a cross-app catalog', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(html, /data-panel="accounting"[^>]*>[\s\S]*?Accounting &amp; Finance/);
  assert.match(html, /id="return-super-app"/);
  assert.match(app, /function renderSuperAppLauncher\(\)/);
  assert.match(app, /function applyMiniAppNavigationScope\(\)/);
  assert.match(app, /function isCrossMiniAppPanel\(panel\)/);
  assert.match(app, /navigateToPanel\('launcher'/);
  assert.match(app, /function renderOverview\(\)/);
  assert.doesNotMatch(app, /function renderOverviewActions\(\)/);
  assert.match(app, /const accessibleModules = \[\.\.\.document\.querySelectorAll\('\.tab\[data-panel\]:not\(\[hidden\]\)'\)\]/);
  assert.match(app, /launcher: renderSuperAppLauncher/);
});

test('Cross-mini-app navigation scopes are enforced', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /function renderOverviewActions\(\)/);
  assert.match(app, /function applyMiniAppNavigationScope\(\)/);
  assert.match(app, /function isCrossMiniAppPanel\(panel\)/);
  assert.match(app, /if \(isCrossMiniAppPanel\(panel\)\) \{\s*navigateToPanel\('launcher'/);
  assert.match(app, /launcher: renderSuperAppLauncher/);
});

test('Accounting is included in the existing subscription request catalog and entitlement guard', () => {
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
  const accountingEntitlement = server.indexOf("api.use('/accounting', requirePlatformTenantService('accounting'), (req, _res, next) =>");
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

test('Accounting retains entity-scoped BI and reports on the existing gateway route', () => {
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

test('AfroSherik identity and install artwork stay aligned with the brand shell', () => {
  const logo = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
  assert.match(logo, /<title[^>]*>AfroSherik mark/);
  assert.match(logo, /#174b3d/i);
  assert.match(logo, /#d7ad59/i);

  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'AfroSherik | አፍሮ-ሸሪክ');
  assert.equal(manifest.short_name, 'AfroSherik');
  assert.equal(manifest.background_color, '#FAF8F1');
  assert.equal(manifest.theme_color, '#174b3d');
  assert.equal(manifest.icons.length, 3);
  assert.ok(manifest.icons.every((entry: { purpose: string; type: string }) =>
    entry.purpose === 'any' && entry.type === 'image/png'));
  for (const size of [192, 256, 512]) {
    const iconPath = `/icons/afrosherik-icon-${size}.png`;
    const icon = readFileSync(new URL(`../public${iconPath}`, import.meta.url));
    assert.equal(icon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.ok(manifest.icons.some((entry: { src: string; sizes: string }) =>
      entry.src === iconPath && entry.sizes === `${size}x${size}`));
  }

  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<title>AfroSherik \| አፍሮ-ሸሪክ<\/title>/);
  assert.match(html, /<h2>Apply to join AfroSherik<\/h2>/);
  assert.match(html, /Access is limited to approved AfroSherik accounts\./);
  assert.match(html, /src="\/brand\/afrosherik-brand-lockup\.png" alt="AfroSherik — Connect · Access · Thrive"/);
  assert.match(html, /rel="icon" href="\/icons\/afrosherik-icon-192\.png" type="image\/png"/);
  assert.doesNotMatch(html, /AfroLife Agency|AFROLIFE AGENCY|afrolife-brand/i);
  for (const assetPath of [
    '../public/brand/afrosherik-brand-lockup.png',
    '../public/brand/afrosherik-campaign-hero.png',
    '../public/icons/afrosherik-icon-192.png',
    '../public/icons/afrosherik-icon-256.png',
    '../public/icons/afrosherik-icon-512.png',
  ]) assert.ok(readFileSync(new URL(assetPath, import.meta.url)).length > 0, `${assetPath} should exist`);
  assert.match(html, /placeholder="https:\/\/www\.afrolife\.com\.et"/);
  const manifestColor = html.match(/<meta name="theme-color" content="([^"]+)"/);
  assert.equal(manifestColor?.[1], manifest.theme_color);

  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /--brand-green:\s*#174b3d/i);
  assert.match(styles, /--opportunity-yellow:\s*#d7ad59/i);
});

test('native Android and iOS launchers use the AfroSherik app name', () => {
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
  assert.match(appStrings, /<string name="app_name">AfroSherik \| አፍሮ-ሸሪክ<\/string>/);
  assert.equal(capacitorConfig.appName, 'AfroSherik | አፍሮ-ሸሪክ');
  assert.match(iosInfo, /<key>CFBundleDisplayName<\/key>\s*<string>AfroSherik<\/string>/);
  for (const configPath of [
    '../android/app/src/main/assets/capacitor.config.json',
    '../ios/App/App/capacitor.config.json',
  ]) {
    const nativeConfig = JSON.parse(readFileSync(new URL(configPath, import.meta.url), 'utf8'));
    assert.equal(nativeConfig.appId, capacitorConfig.appId);
    assert.equal(nativeConfig.appName, capacitorConfig.appName);
  }
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
