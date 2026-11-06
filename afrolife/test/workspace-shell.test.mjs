import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { checkWorkspaceServices, createApiMetrics } from '../src/workspace-status.ts';
import { isMiniAppAllowed, isPanelEnabled, panelFromUrl, panelUrl } from '../public/workspace-navigation.js';
import { MIN_SEARCH_QUERY_LENGTH, searchWorkspaceRecords } from '../public/workspace-search.js';
import { isGlobalBiUtcBucketBoundary, normalizeGlobalBiDashboard } from '../public/global-bi.js';
import { buildMiniAppAccessPayload } from '../public/mini-app-access.js';
import { normalizeAccountingTrendRows } from '../public/accounting-dashboard.js';
import { paginateRows } from '../public/row-pagination.js';

function collectPublicUiMessages() {
  const argumentIndexes = new Map([
    ['t', 0],
    ['node', 1],
    ['showAlert', 0],
    ['setLocalizedText', 1],
    ['setLocalizedNodeText', 1],
    ['setLocalizedAttribute', 2],
  ]);
  const messages = new Set();
  const publicDirectory = new URL('../public/', import.meta.url);

  for (const filename of readdirSync(publicDirectory).filter((name) => name.endsWith('.js'))) {
    const source = ts.createSourceFile(
      filename,
      readFileSync(new URL(filename, publicDirectory), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : null;
        const argumentIndex = argumentIndexes.get(callee);
        const argument = argumentIndex === undefined ? undefined : node.arguments[argumentIndex];
        if (argument && ts.isStringLiteralLike(argument) && argument.text.trim() && argument.text !== '⋯') {
          messages.add(argument.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return [...messages];
}

test('key app workflows are translated in every supported locale', async () => {
  const messages = [
    'AfroLife Support',
    'Role-aware assistant and peer support',
    'Your access and support options follow your AfroLife role.',
    'Online support agents: {{count}}',
    'Make me available',
    'Stop offering support',
    'My conversations',
    'Start a new support request',
    'Send request',
    'Requests awaiting support',
    'Claim conversation',
    'Conversation',
    'Message',
    'Send message',
    'Start a conversation by describing what you need.',
    'You',
    'AfroLife support',
    'Open property services',
    'Open workforce tools',
    'Open support cases',
    'Your support request is private to you and the support agent who claims it. Do not send passwords, payment card details, or authentication codes.',
    'Automated answers are not enabled in this support pilot. Existing property, workforce, and support tools remain available.',
    'Awaiting response',
    'Assigned to support',
    'Document requirements are not available yet. Try again before submitting.',
    'No identity documents are required for this account type.',
    'Your registration is pending review. Check document decisions below and replace any document returned by Compliance.',
    'All required documents are received. Compliance will review them before account activation.',
    'Choose a returned or missing document and select a replacement file.',
    'This file exceeds the 10 MB upload limit.',
    'Choose a PDF, JPEG or PNG document.',
    'Some areas could not be searched. Results may be partial.',
    'No matching records were found in the areas available to your role.',
    'Counts reflect records currently available to your account.',
    'Explore Edir membership and available benefits',
    'Open to verified AfroLife users across worker, employer, landlord, tenant, seller, and buyer services. Review active community, savings, share, and contribution options before requesting membership. Lending, insurance, and benefit payouts are not live in this pilot.',
    'EthioLife Edir membership offer',
    'Edir membership is available to registered workers, employers, landlords, tenants, sellers, buyers, and other EthioLife users after KYC has been verified. Complete KYC review to request membership.',
    'Request EthioLife Edir membership',
    'I understand this pilot records a membership request only. No dues, contributions, insurance, or payouts are collected or promised.',
    'Available Edir benefits and services',
    'Membership includes a reviewed request to join the central Edir community. The active product options below are set by EthioLife Edir administrators and may be subject to product terms and approval.',
    'Community membership and group participation are available after review. No financial products are currently open for enrollment.',
    'Insurance, lending, and benefit payouts are not currently available through this pilot. Product availability and terms can change as the program is configured.',
    'Your membership is awaiting independent review. No financial activity is enabled.',
    'You are enrolled in the central EthioLife Edir registry. Your membership does not create a deposit or payment account.',
    'Your Edir groups',
    'You are not assigned to an Edir group yet. Contact an Edir administrator.',
    'No Edir membership requests have been submitted.',
    'Umbrella Master Edir management',
    'Onboard independent Edirs and coordinate their operations. Each Edir keeps its own governance, member registry, staff assignments, financial products, and ledger. This dashboard contains cross-Edir totals only.',
    'Onboard an independent Edir',
    'Official registration and governance documents must both be verified before approval.',
    'Independent Edirs',
    'Local Edir role',
    'Separate Insurance Edir ledgers and reporting',
    'Insurance role',
    'Insurance consolidated totals',
    'Edir administration',
    'Review central membership requests, organize community groups, and inspect the append-only Edir audit trail. Money movement requires a separate approver and creates immutable double-entry ledger postings.',
    'Create a central Edir group',
    'Central groups',
    'No groups have been created.',
    'Assign Edir staff',
    'Edir role',
    'Edir accounts are not a digital wallet. This view is read-only for your balances and activity; payment and transfer rails are not connected.',
    'Financial products require independent approval before opening. Deposits and withdrawals post only after a second authorized person approves them. Amounts use ETB; lending and benefit payouts will be introduced as separately controlled stages.',
    'No financial products are available yet. An authorized financial manager must propose a product and a different reviewer must approve it.',
    'You have no Edir financial accounts.',
    'Request a withdrawal',
    'Your detailed Edir transaction activity',
    'No Edir transaction activity is linked to your membership.',
    'Propose a financial product',
    'Product type',
    'Allow withdrawals from this product after independent approval.',
    'Entity finance operations',
    'Add customer or vendor',
    'Save contact',
    'Create invoice or bill',
    'Document line',
    'The first version accepts one document line per submission; create separate documents for additional lines.',
    'Entity documents',
    'Create monthly budget',
    'Save draft',
    'Save draft budget',
    'Choose at least one picture to upload.',
    'EthioLife Edir',
    'Register entity bank account',
    'Save bank account',
    'Import bank statement CSV',
    'Import statement',
    'Prepare tax period workpaper',
    'Save filing workpaper',
    'Entity reporting basis',
    'Save reporting basis',
    'Accounting & Finance uses the same AfroLife mini-app subscription and payment review as other services. Subscription access is managed from Service subscriptions; this workspace is for accounting standards and books.',
    'Submit for approval',
    'Submit payment for review',
    'Approve budget',
    'Match & reconcile',
    'Simulate test submission (no authority filing)',
    'Request information',
    'I consent to AfroLife forwarding this information request to the Insurance service team. This is not an application, policy, quote, or coverage confirmation.',
    'Optional: I consent to sharing my name, phone number, and selected topic with one assigned AfroLife Agent for non-binding follow-up and referral to the Insurance service team. The Agent cannot advise, quote, collect premiums, submit applications, or influence underwriting or claims.',
    'Your requests and activity',
    'No Insurance information requests are linked to your account.',
    'Consent-based Agent referrals',
    'No consented Insurance referrals are assigned in your Agent scope.',
    'Brokerage lifecycle training sandbox',
    'Development-only simulated workflow using synthetic product and transaction data. It cannot contact insurers, issue real policies, move money, settle commissions, or decide real claims.',
    'I confirm that this scenario uses no real customer, policy, payment, or claims data.',
    'Edir credit policy and loan requests',
    'Each Edir proposes and independently approves its own versioned credit policy. Loan offers are interest-free and fee-free; member acceptance selects an active savings account, followed by separately approved savings-account disbursement and savings-funded principal repayments. Cash, mobile-wallet, and third-party payouts are later stages and are not simulated.',
    'Platform-wide daily disbursement limits',
    'This maker-checker control caps total posted Edir loan disbursements across all independent Edirs. Per-Edir limits remain active as additional controls.',
    'No policy is approved. Loan applications cannot be underwritten until this Edir approves its own policy.',
    'Weights must add up to 100. Interest and fees are locked at 0. Disbursement and repayment use the separately reviewed savings-account workflow.',
    'Loan requests are unavailable until an independent reviewer verifies your national ID and KYC documents.',
    'Active Edir membership is required to request a loan assessment.',
    'I accept the interest-free, fee-free principal-only loan and savings-account payout terms.',
    'Your service mini-apps',
    'Super App',
    'Accounting & Finance',
    'Manage entity books, journals, financial operations, and entity-scoped reporting.',
    'Accounting mini app →',
    'No services are assigned to your account yet.',
    'Open an available service directly. Access is based on your role and enabled features.',
    'Choose an agent',
    'Audience roles',
    'AfroLife managed listing',
    'On Android, take or choose photos and videos. Media stays private and is shown only to authorized users.',
    'Owner rent & deposit statements',
    'These read-only records show lease charges and reconciled rent/deposit receipts. They do not initiate or confirm a payout to you.',
    'Open a maintenance request',
    'Choose a property',
    'Common area / property',
    'All properties',
    'Test checkout only. No real payment is taken.',
    'Marketplace report dashboard',
    'Marketplace listing prices are not payments. Local mock mode supports a sandbox order and simulated payment for published fixed-price sales; it never charges a buyer or posts to Accounting. Real checkout, buyer memberships, wallets, loans, and purchase history remain unavailable.',
    'Your detailed listing activity',
    'No marketplace listing activity is linked to your account.',
    'Insurance report dashboard',
    'Insurance policy enrollment, claims, member wallets, and loans are not available in this platform. Existing Insurance ledgers are separate organization accounting records and do not prove personal cover or a payment balance.',
    'Agents may only make a consented, non-binding follow-up or refer a customer to the Insurance service team. Product recommendations, comparisons, quotes, premium collection, policy issuance or changes, and claims decisions are not available.',
  ];
  messages.push(...collectPublicUiMessages());
  const locales = ['am', 'om', 'ti', 'so', 'ar', 'sw'];
  const store = new Map();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
  });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages: ['en'] } });

  try {
    for (const locale of locales) {
      store.set('afrolife.locale', locale);
      const { localeNames, t } = await import(`../public/i18n.js?locale-test=${locale}`);
      assert.ok(localeNames[locale], `locale ${locale} is available`);
      for (const message of messages) {
        const translated = t(message);
        assert.ok(translated && translated !== message, `${locale} is missing: ${message}`);
      }
      const signedIn = t('Signed in as {{role}}. Your access is limited to your assigned role and territory.', { role: 'Buyer' });
      assert.ok(signedIn.includes('Buyer'));
      assert.doesNotMatch(signedIn, /\{\{\w+\}\}/);
    }
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});

test('workspace deep links retain the current URL and only resolve visible panels', () => {
  assert.equal(panelFromUrl('https://agency.test/?panel=rent', new Set(['overview', 'rent'])), 'rent');
  assert.equal(panelFromUrl('https://agency.test/?panel=launcher', new Set(['overview', 'launcher'])), 'launcher');
  assert.equal(panelFromUrl('https://agency.test/?panel=admin', new Set(['overview'])), 'overview');
  assert.equal(panelFromUrl('https://agency.test/?panel=unknown', new Set(['overview', 'rent'])), 'overview');
  assert.equal(isPanelEnabled('launcher', []), true);
  assert.equal(panelUrl('/agency?campaign=staff#main', 'rent'), '/agency?campaign=staff&panel=rent#main');
  assert.equal(panelUrl('/agency?panel=rent#main', 'overview'), '/agency#main');
  assert.equal(isPanelEnabled('admin', []), true);
  assert.equal(isPanelEnabled('rent', ['leads']), false);
  assert.equal(isMiniAppAllowed('accounting', ['accounting']), true);
  assert.equal(isMiniAppAllowed('global-bi', []), false);
  assert.equal(isMiniAppAllowed('global-bi', undefined), false);
});

test('Global BI normalization preserves real empty-state values without filling sample metrics', () => {
  assert.deepEqual(normalizeGlobalBiDashboard({
    asOf: null,
    reportingTenants: 0,
    metrics: [],
    series: [],
  }), {
    grain: null,
    targetIntervalMinutes: null,
    asOf: null,
    oldestProjectionAt: null,
    projectionState: 'unknown',
    projectorConfiguration: 'unconfirmed',
    schedulerConfiguration: 'unconfirmed',
    tenantProjectorHealth: 'unconfirmed',
    reportingTenants: 0,
    metrics: [],
    series: [],
  });
  assert.deepEqual(normalizeGlobalBiDashboard({
    asOf: '2026-10-18T10:00:00Z',
    reportingTenants: null,
    grain: '30_minutes',
    targetIntervalMinutes: 30,
    projectionState: 'recent_projection_observed',
    projectorConfiguration: 'configured',
    schedulerConfiguration: 'configured',
    tenantProjectorHealth: 'unconfirmed',
    metrics: [{ key: 'posted_volume', value: '12.50', unit: 'ETB' }, { key: 5, value: 1, unit: 'count' }],
    series: [{ period: '2026-10', metric: 'posted_volume', value: '12.50' }, { period: 1, metric: 'ignored', value: 3 }],
  }), {
    grain: '30_minutes',
    targetIntervalMinutes: 30,
    asOf: '2026-10-18T10:00:00Z',
    oldestProjectionAt: null,
    projectionState: 'recent_projection_observed',
    projectorConfiguration: 'configured',
    schedulerConfiguration: 'configured',
    tenantProjectorHealth: 'unconfirmed',
    reportingTenants: null,
    metrics: [{ key: 'posted_volume', value: '12.50', unit: 'ETB' }],
    series: [{ period: '2026-10', metric: 'posted_volume', value: '12.50' }],
  });
  assert.equal(normalizeGlobalBiDashboard({
    grain: '30_minutes',
    targetIntervalMinutes: 60,
    metrics: [],
    series: [],
  }).grain, null);
  assert.equal(normalizeGlobalBiDashboard({
    grain: '30_minutes',
    targetIntervalMinutes: 30,
    projectionState: 'unrecognized',
    tenantProjectorHealth: 'healthy',
    metrics: [],
    series: [],
  }).projectionState, 'unknown');
  assert.equal(normalizeGlobalBiDashboard({
    grain: '30_minutes',
    targetIntervalMinutes: 30,
    tenantProjectorHealth: 'healthy',
    metrics: [],
    series: [],
  }).tenantProjectorHealth, 'unconfirmed');
});

test('Global BI range boundaries are validated after local-to-UTC conversion', () => {
  assert.equal(isGlobalBiUtcBucketBoundary(new Date('2026-10-21T09:30:00+03:00')), true);
  assert.equal(isGlobalBiUtcBucketBoundary(new Date('2026-10-21T09:45:00+03:00')), false);
  assert.equal(isGlobalBiUtcBucketBoundary(new Date('2026-10-21T09:30:01Z')), false);
  assert.equal(isGlobalBiUtcBucketBoundary(new Date('invalid')), false);
});

test('mini-app access payload reset clears custom modules and custom grants are deduplicated', () => {
  assert.deepEqual(buildMiniAppAccessPayload('role_default', ['accounting']), { mode: 'role_default', modules: [] });
  assert.deepEqual(buildMiniAppAccessPayload('custom', ['accounting', 'accounting', 'global-bi']), {
    mode: 'custom',
    modules: ['accounting', 'global-bi'],
  });
});

test('accounting chart accepts only returned monthly rows and does not synthesize values', () => {
  const monthly = [
    { month: '2026-10-01', posted_journals: 4, posted_volume: '950.00' },
    { posted_journals: 3, posted_volume: '500.00' },
    null,
  ];
  assert.deepEqual(normalizeAccountingTrendRows(monthly), [monthly[0]]);
  assert.deepEqual(normalizeAccountingTrendRows(undefined), []);
});

test('global workspace search matches literal input and normalized phone digits', () => {
  const records = [
    { title: 'Property 50% complete', searchable: ['Property 50% complete'], phones: [] },
    { title: 'Tenant account', searchable: ['Tenant account'], phones: ['+251 911 234 567'] },
  ];
  assert.equal(MIN_SEARCH_QUERY_LENGTH, 2);
  assert.deepEqual(searchWorkspaceRecords('%', records), []);
  assert.equal(searchWorkspaceRecords('50%', records)[0].title, 'Property 50% complete');
  assert.equal(searchWorkspaceRecords('911234', records)[0].title, 'Tenant account');
});

test('service status distinguishes integrated, disabled, unavailable, and healthy services', async () => {
  let fetchCalls = 0;
  const statuses = await checkWorkspaceServices([
    { id: 'legacy', name: 'Legacy service', enabled: true, withoutUrl: 'integrated' },
    { id: 'off', name: 'Disabled service', enabled: false, withoutUrl: 'disabled' },
    { id: 'up', name: 'Healthy service', enabled: true, url: 'http://127.0.0.1:3300/', withoutUrl: 'disabled' },
    { id: 'down', name: 'Unavailable service', enabled: true, url: 'http://127.0.0.1:3301', withoutUrl: 'disabled' },
  ], async (url) => {
    fetchCalls += 1;
    assert.equal(String(url), fetchCalls === 1 ? 'http://127.0.0.1:3300/healthz' : 'http://127.0.0.1:3301/healthz');
    return new Response(null, { status: fetchCalls === 1 ? 200 : 503 });
  }, () => assert.fail('A non-2xx status is not a thrown network error'));

  assert.deepEqual(statuses.map(({ id, status }) => [id, status]), [
    ['legacy', 'integrated'],
    ['off', 'disabled'],
    ['up', 'available'],
    ['down', 'unavailable'],
  ]);
  assert.equal(fetchCalls, 2);
});

test('a health-check network failure is reported without exposing service details', async () => {
  const logged = [];
  const status = await checkWorkspaceServices([
    { id: 'timeout', name: 'Slow service', enabled: true, url: 'http://127.0.0.1:3302', withoutUrl: 'disabled' },
  ], async () => { throw new Error('connection refused'); }, (name) => logged.push(name));
  assert.equal(status[0].status, 'unavailable');
  assert.deepEqual(logged, ['Slow service']);
  assert.equal(JSON.stringify(status).includes('connection refused'), false);
});

test('API metrics aggregate by route template and bound stored cardinality', () => {
  const metrics = createApiMetrics(3);
  const now = new Date('2026-10-18T10:00:00.000Z');
  metrics.record('get', '/api/v1/users/:id', 200, 20, now);
  metrics.record('GET', '/api/v1/users/:id', 503, 80, now);
  metrics.record('POST', '/api/v1/auth/login', 401, 4, now);

  const snapshot = metrics.snapshot();
  assert.equal(snapshot.length, 2);
  assert.ok(snapshot.some((metric) => metric.route === 'GET /api/v1/users/:id'));
  assert.equal(snapshot.some((metric) => metric.route.includes('4c8f')), false);
  assert.deepEqual(snapshot[0], {
    route: 'GET /api/v1/users/:id',
    requests: 2,
    failures: 1,
    average_duration_ms: 50,
    max_duration_ms: 80,
    last_request_at: now.toISOString(),
  });
  metrics.record('GET', '/api/v1/other', 200, 7, now);
  assert.equal(metrics.snapshot().length, 3);
  metrics.record('GET', '/api/v1/new-route', 200, 2, now);
  assert.equal(metrics.snapshot().length, 3);
});


test('row pagination supports page sizes and clamps page boundaries', () => {
  const rows = Array.from({ length: 51 }, (_, index) => index);
  assert.deepEqual(paginateRows(rows, 10, 2), { page: 2, pageSize: 10, pageCount: 6, start: 10, end: 20 });
  assert.deepEqual(paginateRows(rows, 25, 9), { page: 3, pageSize: 25, pageCount: 3, start: 50, end: 51 });
  assert.deepEqual(paginateRows(rows, 50, 0), { page: 1, pageSize: 50, pageCount: 2, start: 0, end: 50 });
  assert.deepEqual(paginateRows(rows, 100, 1), { page: 1, pageSize: 100, pageCount: 1, start: 0, end: 51 });
  assert.deepEqual(paginateRows([], 10, 2), { page: 1, pageSize: 10, pageCount: 1, start: 0, end: 0 });
  assert.equal(paginateRows(rows, 17).pageSize, 10);
});

test('workspace and financial tables use RTL-aware logical text alignment', async () => {
  const workspaceStyles = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const financialStyles = await readFile(new URL('../public/financial-workspaces.css', import.meta.url), 'utf8');

  assert.match(workspaceStyles, /\.workspace-launch-card\s*\{[^}]*text-align:\s*start;/);
  assert.match(workspaceStyles, /\.news-feed-meta\s*\{[^}]*text-align:\s*end;/);
  assert.match(workspaceStyles, /\.maintenance-latest-update\s*\{[^}]*padding-inline-start:/);
  assert.match(workspaceStyles, /\.workspace \.empty-state\s*\{[^}]*border-inline-start:/);
  assert.match(financialStyles, /\.finance-data-table,\s*\.bi-data-table\s*\{[^}]*text-align:\s*start;/);
  assert.match(financialStyles, /\.finance-data-table caption,\s*\.bi-data-table caption\s*\{[^}]*text-align:\s*start;/);
  assert.match(financialStyles, /\.finance-chart-value,\s*\.bi-series-value\s*\{[^}]*text-align:\s*end;/);
  assert.match(financialStyles, /\.bi-series-bar\.is-negative\s*\{[^}]*margin-inline-start:/);
  assert.match(financialStyles, /\.bi-scope-banner\s*\{[^}]*border-inline-start:/);
});
