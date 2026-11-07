import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  marketplaceDashboardMetrics,
  workforceDashboardMetrics,
  staffingDashboardMetrics,
  propertyDashboardMetrics,
  propertyOwnerDashboardMetrics,
  agentDashboardMetrics,
} from '../public/dashboard-metrics.js';
import {
  canChangeServer,
  DEFAULT_NATIVE_API_ORIGIN,
  edirApplicationDocumentPath,
  missingSignupDocuments,
  nativeApiOrigin,
  signupRequiredDocuments,
} from '../public/registration-flows.js';
import {
  normalizeMySubscriptions,
  normalizeSubscriptionCatalog,
  PUBLIC_SUBSCRIPTION_SERVICES,
  subscriptionRequestPayload,
} from '../public/subscriptions.js';
import { propertyOfferTerms } from '../public/property-offers.js';
import { marketplaceListingPayload } from '../public/marketplace-form.js';
import { filterWorkerActivityReports, workerActivityReportsCsv } from '../public/worker-activity-reports.js';

test('submit buttons are handled by the delegated form workflow, not click actions', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const clickHandler = app.slice(app.indexOf("document.addEventListener('click', async (event) => {"));
  const actionLookup = clickHandler.indexOf("const action = event.target.closest('button[data-action]');");
  const mfaAction = clickHandler.indexOf("if (name === 'mfa-setup')");
  assert.ok(actionLookup >= 0);
  assert.ok(mfaAction > actionLookup);
  assert.match(clickHandler.slice(actionLookup, mfaAction), /action\.type === 'submit'/);
  assert.match(app, /document\.addEventListener\('submit', \(event\) => \{/);
});

test('signup uploads enforce configured KYC documents and limit server changes to super admins', () => {
  const options = { kyc_requirements: { customer: ['national_id'], worker: ['national_id', 'police_clearance'] } };
  assert.deepEqual(signupRequiredDocuments(options, 'worker'), ['national_id', 'police_clearance']);
  assert.equal(signupRequiredDocuments(options, 'unknown'), null);
  assert.deepEqual(missingSignupDocuments(['national_id', 'police_clearance'], (kind) =>
    kind === 'national_id' ? { name: 'id.png' } : null), ['police_clearance']);
  assert.equal(canChangeServer('super_admin'), true);
  assert.equal(canChangeServer('finance'), false);
  assert.equal(DEFAULT_NATIVE_API_ORIGIN, '');
  assert.equal(nativeApiOrigin(null), '');
  assert.equal(nativeApiOrigin('https://integrating-devices-executive-springs.trycloudflare.com'), '');
  assert.equal(nativeApiOrigin(' https://api.example.com '), 'https://api.example.com');
  assert.equal(nativeApiOrigin(' '), '');
  assert.equal(edirApplicationDocumentPath('application/1', 'legal_registration'),
    '/edir/public/registration-applications/application%2F1/documents/legal_registration');
});

test('pending signup resumes the visible document-upload follow-up flow', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const openSignup = app.slice(app.indexOf('function openSignup('), app.indexOf('function showSignupFollowupMode('));
  const loadFollowup = app.slice(app.indexOf('async function loadSignupFollowup('), app.indexOf('async function uploadSignupReplacement('));

  assert.match(openSignup, /showSignupFollowupMode\(\);[\s\S]*setLocalizedText\(\$\('#signup-success'\), 'A registration is already pending\.[\s\S]*void loadSignupFollowup\(\);/);
  assert.match(loadFollowup, /const needsReplacement = Boolean\(select\.options\.length\);/);
  assert.match(loadFollowup, /\$\('#signup-followup-form'\)\.hidden = !needsReplacement;/);
  assert.match(loadFollowup, /select\.required = needsReplacement;/);
  assert.match(loadFollowup, /\$\('#signup-followup-form \[name="file"\]'\)\.required = needsReplacement;/);
});

test('public signup branding and worker-interest copy stay localized', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');

  assert.match(html, /<p class="eyebrow">AFROSHERIK REGISTRATION<\/p>/);
  assert.match(html, /<h2>Apply to join AfroSherik<\/h2>/);
  assert.doesNotMatch(html, /ETHIOLIFE REGISTRATION|Apply to join AfroLife/);
  for (const message of [
    'AFROSHERIK REGISTRATION',
    'Ask about worker savings options',
    'Request information about currently configured worker savings services. No match or pension contribution is promised.',
    'For workers seeking an Option A placement with the Enterprise service pathway. Enrollment, employer terms, pension matching and Edir benefits require confirmation before activation.',
    'Ask about future insurance services',
    'Insurance is not active in the current Edir pilot.',
    'Ask about future household protection',
    'Household cover is not active in the current AfroLife service.',
    'These are non-binding requests for information. Selecting a benefit does not enroll you, collect money or start insurance coverage.',
  ]) {
    assert.match(i18n, new RegExp(`'${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*\\{\\s*am:\\s*'[^']+'`));
  }
});

test('mini-app dashboards summarize only supplied, authorized panel data', () => {
  assert.deepEqual(workforceDashboardMetrics([{ verification: 'verified' }, { verification: 'pending' }]), {
    total: 2,
    byVerification: [{ label: 'verified', count: 1 }, { label: 'pending', count: 1 }],
  });

  assert.deepEqual(staffingDashboardMetrics([{ status: 'open' }, { status: 'open' }]), {
    total: 2,
    byStatus: [{ label: 'open', count: 2 }],
  });
  assert.deepEqual(marketplaceDashboardMetrics([
    { status: 'published', created_by: 'user-1' },
    { status: 'pending_review', seller_user_id: 'user-2' },
  ], 'user-1'), {
    totalListings: 2,
    publishedListings: 1,
    ownedListings: 1,
    byStatus: [{ label: 'published', count: 1 }, { label: 'pending_review', count: 1 }],
  });
  assert.deepEqual(propertyDashboardMetrics([
    { status: 'active', units: [{}, {}] },
    { status: 'draft', units: [] },
  ]), {
    totalListings: 2,
    totalUnits: 2,
    byStatus: [{ label: 'active', count: 1 }, { label: 'draft', count: 1 }],
  });
  assert.deepEqual(propertyOwnerDashboardMetrics(
    [{ units: [{ occupancy: 'occupied' }, { occupancy: 'vacant' }] }],
    [{ status: 'active', rent_reconciled: '1200.00', rent_pending_reconciliation: '200.00' }],
    [{ status: 'open' }, { status: 'done' }],
  ), {
    properties: 1,
    units: 2,
    occupiedUnits: 1,
    vacantUnits: 1,
    activeLeases: 1,
    rentReconciled: 1200,
    rentPendingReconciliation: 200,
    openMaintenance: 1,
  });
  assert.deepEqual(agentDashboardMetrics(
    [{ status: 'new' }, { status: 'converted' }],
    [{ verification: 'pending' }, { verification: 'verified' }],
    [{ status: 'open' }, { status: 'matched' }],
    [
      { status: 'qualified', amount: '50' },
      { status: 'approved', amount: '125.25', held_status: 'held', held_amount: '25.25' },
    ],
  ), {
    leads: 2,
    followUpLeads: 1,
    workers: 2,
    workersAwaitingVerification: 1,
    openStaffingRequests: 1,
    commissionsAwaitingReview: 1,
    approvedCommissionAmount: 125.25,
    heldCommissionAmount: 25.25,
  });
});

test('property listing terms expose sale prices and the lowest available unit rent', () => {
  assert.deepEqual(propertyOfferTerms({
    listing_mode: 'sale',
    sale_price: '2500000',
    units: [{ rent: 12000 }],
  }), [{ type: 'sale', amount: 2500000 }]);
  assert.deepEqual(propertyOfferTerms({
    listing_mode: 'rent',
    rent_period: 'month',
    units: [{ rent: 18000 }, { rent: 12500 }, { rent: null }],
  }), [{ type: 'rent', amount: 12500, period: 'month' }]);
  assert.deepEqual(propertyOfferTerms({
    listing_mode: 'sale_or_rent',
    sale_price: 3000000,
    units: [{ rent: 15000 }],
  }), [
    { type: 'sale', amount: 3000000 },
    { type: 'rent', amount: 15000, period: 'month' },
  ]);
});

test('marketplace payloads omit rental periods unless the listing is a rental', () => {
  const sale = marketplaceListingPayload({
    domain: 'products',
    category_key: 'electronics',
    title: 'Phone',
    description: 'A working phone for sale.',
    transaction_mode: 'sale',
    price: '12000',
    rent_period: 'month',
    condition: 'good',
    territory_id: '4',
    seller_user_id: '',
  });
  assert.equal(sale.price, 12000);
  assert.equal(sale.territory_id, 4);
  assert.equal('rent_period' in sale, false);
  assert.equal('seller_user_id' in sale, false);
  const rental = marketplaceListingPayload({
    domain: 'equipment',
    category_key: 'tools',
    title: 'Generator',
    description: 'Generator available for rent.',
    transaction_mode: 'rental',
    rent_period: 'week',
    territory_id: '7',
  });
  assert.equal(rental.rent_period, 'week');
});

test('worker portal exposes workforce self-service and ordered offline clock sync', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/workforce-operations.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../migrations/095_workforce_workflows.sql', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(app, /\/workforce\/shifts\/mine/);
  assert.match(app, /\/workforce\/leave\/mine/);
  assert.match(app, /workforce-clock-queue:/);
  assert.match(app, /Clock-event sync stopped to preserve event order/);
  assert.match(app, /body: JSON\.stringify\(\{\s*event_type: event\.event_type/);
  assert.match(app, /My shifts and attendance/);
  assert.match(app, /Leave and availability/);
  assert.match(i18n, /'My shifts and attendance',\s*'[^']+',\s*'[^']+',\s*'[^']+'/);
  assert.match(api, /workforceOperations\.post\('\/workforce\/shifts\/:id\/clock-events'/);
  assert.match(migration, /UNIQUE \(recorded_by, client_event_id\)/);
  assert.match(api, /workforceOperations\.post\('\/workforce\/shifts\/:id\/approve-time'/);
  assert.match(migration, /CREATE TABLE workforce_payroll_export_payloads/);
  assert.match(migration, /workforce_payroll_export_payloads_manager_all/);
  assert.match(migration, /workforce_clock_events_immutable/);
  const exportMetadata = migration.split('CREATE TABLE workforce_payroll_exports')[1]
    .split('CREATE TABLE workforce_payroll_export_items')[0];
  assert.doesNotMatch(exportMetadata, /encrypted_payload/);
  assert.match(migration, /UPDATE workforce_shifts SET status='cancelled'[\s\S]*?UPDATE staffing_engagements SET status='completed'/);
  assert.match(server, /api\.use\('\/workforce', requirePlatformTenantService\('workforce'\), requireMiniAppAccess\('workers'\)\)/);
  assert.match(server, /api\.use\('\/workforce', workerManagementGateway\)/);
});

test('worker activity reports can be filtered and exported as spreadsheet-safe CSV', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const reports = [
    {
      engagement_id: 'engagement-1',
      period_start: '2026-03-01',
      period_end: '2026-03-07',
      quantity: '5',
      worker_amount: '2500.00',
      description: '=HYPERLINK("https://example.invalid")',
      status: 'submitted',
      review_reason: null,
    },
    {
      engagement_id: 'engagement-1',
      period_start: '2026-03-08',
      period_end: '2026-03-14',
      quantity: '4',
      worker_amount: '2000.00',
      description: 'Completed weekly work',
      status: 'approved',
      review_reason: 'Reviewed',
    },
  ];
  const engagements = [{
    id: 'engagement-1',
    employer_client: 'Employer, Inc.',
    worker_type: 'hourly_professional',
    billing_unit: 'hour',
  }];
  const filtered = filterWorkerActivityReports(reports, {
    startDate: '2026-03-05',
    endDate: '2026-03-14',
    status: 'approved',
  });
  assert.deepEqual(filtered, [reports[1]]);
  assert.deepEqual(
    filterWorkerActivityReports(reports, { startDate: '2026-03-05', endDate: '2026-03-10' }),
    reports,
  );

  const csv = workerActivityReportsCsv(reports, engagements);
  assert.match(csv, /Employer, Inc\./);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /"Employer, Inc\."/);
  assert.match(csv, /Worker amount ETB/);
  assert.match(app, /worker-report-filters/);
  assert.match(app, /worker-report-export/);
  assert.match(app, /Filters and exports include the 200 most recent reports currently loaded/);
});

test('maintenance workflow surfaces independent completion review', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/ops.ts', import.meta.url), 'utf8');
  assert.match(app, /Submit for review/);
  assert.match(app, /mayReviewMaintenance/);
  assert.match(app, /Complete work|Return for rework/);
  assert.match(api, /ops\.post\('\/maintenance\/:id\/update'/);
  assert.match(api, /Only a maintenance reviewer can approve completion/);
  assert.match(api, /Completion review must be performed by someone other than the person who submitted the work/);
});

test('property vendor portal exposes assigned work only and requires scanned evidence', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const portal = readFileSync(new URL('../src/property-vendor-portal.ts', import.meta.url), 'utf8');
  const accounting = readFileSync(new URL('../src/property-vendor-accounting.ts', import.meta.url), 'utf8');
  const scanner = readFileSync(new URL('../src/clamav.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(app,/Vendor maintenance workspace/);
  assert.match(app,/maintenance-vendor-accept/);
  assert.match(app,/maintenance-vendor-complete/);
  assert.match(app,/Vendor additional-cost and invoice review/);
  assert.match(app,/maintenance-invoice-mismatch/);
  assert.match(app,/Overdue maintenance SLA queue/);
  assert.match(app,/Webhook notification delivery/);
  assert.match(app,/View handoff history/);
  assert.match(portal,/membership\.user_id=\$2 AND membership\.active/);
  assert.match(portal,/Upload at least one malware-scanned completion photo/);
  assert.match(accounting,/Resolve the invoice-to-work mismatch/);
  assert.match(scanner,/zINSTREAM/);
  assert.match(server,/api\.post\('\/maintenance\/vendor\/:id\/evidence', express\.raw/);
});

test('account security exposes session listing and session revocation', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const admin = readFileSync(new URL('../src/admin.ts', import.meta.url), 'utf8');
  assert.match(app, /load\('authSessions', '\/auth\/sessions'\)/);
  assert.match(app, /Signed-in sessions/);
  assert.match(app, /data-action|revoke-session/);
  assert.match(admin, /adminRouter\.get\('\/auth\/sessions'/);
  assert.match(admin, /adminRouter\.delete\('\/auth\/sessions\/:sessionId'/);
  assert.match(admin, /WHERE id=\$1 AND user_id=\$2 AND revoked_at IS NULL AND expires_at>now\(\)/);
  assert.match(admin, /session_revoked/);
});

test('V11 support journey exposes case intake while protecting sensitive details with independent approval', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const ops = readFileSync(new URL('../src/ops.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../migrations/097_support_cases.sql', import.meta.url), 'utf8');
  const accessHardening = readFileSync(new URL('../migrations/098_support_case_access_hardening.sql', import.meta.url), 'utf8');
  const appealReview = readFileSync(new URL('../migrations/099_support_case_appeal_review.sql', import.meta.url), 'utf8');
  assert.match(html,/data-panel="support"/);
  assert.match(app,/support-case-create/);
  assert.match(app,/support-access-request/);
  assert.match(app,/support-access-decision/);
  assert.match(app,/support-case-resolve/);
  assert.match(app,/support-case-appeal-review/);
  assert.match(app,/Appeal review queue/);
  assert.match(ops,/ops\.post\('\/support\/cases'/);
  assert.match(ops,/ops\.post\('\/support\/cases\/:id\/access-requests'/);
  assert.match(ops,/ops\.post\('\/support\/access-requests\/:id\/decision'/);
  assert.match(ops,/ops\.post\('\/support\/cases\/:id\/appeal-review'/);
  assert.match(ops,/agent complaint/i);
  assert.match(ops,/Financial and legal corrections must reference their formal workflow/);
  assert.match(migration,/support_cases_owner_read/);
  assert.match(migration,/support_case_access_review/);
  assert.match(accessHardening,/support_cases_authorized_read/);
  assert.match(appealReview,/support_case_appeal_reviews_independent_insert/);
});

test('checkboxes and radios override full-width text-field sizing', () => {
  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /input\[type="checkbox"\][\s\S]*?width:\s*18px;[\s\S]*?height:\s*18px;[\s\S]*?min-height:\s*18px;[\s\S]*?padding:\s*0;/);
  assert.match(styles, /input\[type="radio"\]\s*\{\s*border-radius:\s*50%;\s*\}/);
});

test('dynamically created labels retain their source text when the locale changes', async () => {
  const descriptors = new Map(['localStorage', 'navigator', 'NodeFilter', 'document'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]));
  let changeLocale;
  const selector = {
    value: 'en',
    addEventListener(_event, callback) { changeLocale = callback; },
  };
  const sourceNode = { nodeValue: 'Overview', parentElement: { tagName: 'BUTTON' } };
  const textNodes = [sourceNode];
  let link;
  let labelText;
  const root = { querySelectorAll: () => link ? [link] : [] };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'en', setItem: () => {} } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { languages: ['en'] } });
  Object.defineProperty(globalThis, 'NodeFilter', { configurable: true, value: { SHOW_TEXT: 4 } });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: root,
      documentElement: {},
      querySelector: () => selector,
      createTreeWalker: () => {
        let index = 0;
        return { nextNode: () => textNodes[index++] ?? null };
      },
    },
  });
  try {
    const {
      getLocalizedNodeSource,
      initializeLocale,
      setLocalizedAttribute,
      setLocalizedNodeText,
      translateContent,
    } = await import(`../public/i18n.js?locale-test=${Date.now()}`);
    const renderLink = () => {
      link = {
        attributes: {},
        hasAttribute(attribute) { return attribute in this.attributes; },
        getAttribute(attribute) { return this.attributes[attribute]; },
        setAttribute(attribute, value) { this.attributes[attribute] = value; },
      };
      labelText = { nodeValue: '', parentElement: { tagName: 'SPAN' } };
      textNodes.push(labelText);
      const sourceLabel = getLocalizedNodeSource(sourceNode).trim();
      setLocalizedNodeText(labelText, sourceLabel);
      setLocalizedAttribute(link, 'aria-label', sourceLabel);
    };
    initializeLocale(renderLink);
    renderLink();
    selector.value = 'am';
    changeLocale();
    assert.equal(labelText.nodeValue, 'አጠቃላይ እይታ');
    assert.equal(link.getAttribute('aria-label'), 'አጠቃላይ እይታ');
    selector.value = 'om';
    changeLocale();
    assert.equal(labelText.nodeValue, 'Cuunfaa');
    assert.equal(link.getAttribute('aria-label'), 'Cuunfaa');
    selector.value = 'am';
    changeLocale();
    assert.equal(labelText.nodeValue, 'አጠቃላይ እይታ');
    assert.equal(link.getAttribute('aria-label'), 'አጠቃላይ እይታ');
    const accountingText = { nodeValue: 'Chart of accounts', parentElement: { tagName: 'H2' } };
    textNodes.push(accountingText);
    const workerPaymentText = { nodeValue: 'Worker payment records', parentElement: { tagName: 'H2' } };
    textNodes.push(workerPaymentText);
    translateContent(root);
    assert.equal(accountingText.nodeValue, 'የሂሳብ መዝገብ ዝርዝር');
    assert.equal(workerPaymentText.nodeValue, 'የሠራተኛ ክፍያ መዝገቦች');
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('public signup actions open generic registration and allow returning to sign-in', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="public-create-account"[^>]*>Create account<\/button>/);
  assert.match(html, /id="create-account"[^>]*>Create account<\/button>/);
  assert.match(app, /#public-create-account'\)\.addEventListener\('click', \(\) => openSignup\(false\)\)/);
  assert.match(app, /#create-account'\)\.addEventListener\('click', \(\) => openSignup\(false\)\)/);
  assert.match(html, /id="show-login"[^>]*>Already have an account\? Sign in<\/button>/);
});

test('hidden signup document-replacement controls do not block initial registration', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const followup = html.match(/<div id="signup-followup-form"[\s\S]*?<\/div>/)?.[0];
  assert.ok(followup, 'the document replacement form should exist');
  assert.doesNotMatch(followup, /\brequired\b/);
  assert.match(app, /const needsReplacement = Boolean\(select\.options\.length\);[\s\S]*?select\.required = needsReplacement;[\s\S]*?#signup-followup-form \[name="file"\]'\)\.required = needsReplacement;/);
  assert.match(app, /#signup-followup-form'\)\.hidden = true;[\s\S]*?select\.required = false;[\s\S]*?#signup-followup-form \[name="file"\]'\)\.required = false;/);
});

test('marketplace forms submit through the form handler without breaking click actions', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const submitStart = app.indexOf('async function submitForm(form) {');
  const submitEnd = app.indexOf('\nasync function showCandidates', submitStart);
  const clickStart = app.indexOf("document.addEventListener('click', async (event) => {");
  const clickEnd = app.indexOf("$('#login-form')", clickStart);
  assert.ok(submitStart >= 0 && submitEnd > submitStart, 'the form submit handler should be present');
  assert.ok(clickStart >= 0 && clickEnd > clickStart, 'the delegated click handler should be present');
  const submitHandler = app.slice(submitStart, submitEnd);
  const clickHandler = app.slice(clickStart, clickEnd);
  for (const formName of ['marketplace', 'marketplace-existing-media', 'marketplace-config']) {
    assert.ok(submitHandler.includes(`form.dataset.form === '${formName}'`), `${formName} should be handled on submit`);
  }
  assert.match(submitHandler, /sessionStorage\.getItem\(TOKEN_KEY\)/);
  assert.doesNotMatch(submitHandler, /state\.token/);
  assert.doesNotMatch(clickHandler, /\bform\./);
  assert.match(clickHandler, /name === 'user-documents'/);
});

test('authenticator setup is handled before unrelated form actions', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const clickHandler = app.slice(app.indexOf("document.addEventListener('click', async (event) => {"));
  const actionLookup = clickHandler.indexOf("const action = event.target.closest('button[data-action]');");
  const mfaAction = clickHandler.indexOf("if (name === 'mfa-setup')");
  assert.ok(actionLookup >= 0);
  assert.ok(mfaAction > actionLookup);
  assert.match(clickHandler.slice(actionLookup, mfaAction), /action\.type === 'submit'/);
});

test('agent signup accepts typed territory names and offers seeded Ethiopian regions', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../migrations/096_ethiopian_territory_regions.sql', import.meta.url), 'utf8');
  assert.match(html, /id="signup-territory-search" type="text" list="signup-territory-options"[^>]*placeholder="Start typing an area name"/);
  assert.match(html, /Choose a region or type a territory name/);
  const translations = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.match(translations, /'Choose a region or type a territory name\.':/);
  assert.match(app, /const matches = territories\.filter\(\(area\) => \[/);
  assert.match(app, /area\.name,\s*\]\.some\(\(label\) => label\.localeCompare\(value, undefined, \{ sensitivity: 'base' \}\) === 0\)\)/);
  assert.match(migration, /ON CONFLICT \(parent_id, name\) DO NOTHING/);
  for (const region of ['Afar', 'Amhara', 'Benishangul-Gumuz', 'Central Ethiopia', 'Dire Dawa', 'Gambela', 'Harari', 'Oromia', 'Sidama', 'Somali', 'South Ethiopia', 'Southwest Ethiopia Peoples', 'Tigray']) {
    assert.ok(migration.includes(`('${region}')`), `territory seed should include ${region}`);
  }
});

test('AfroSherik sign-in uses the supplied campaign and brand artwork', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  const logo = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
  const hero = readFileSync(new URL('../public/brand/afrosherik-campaign-hero.png', import.meta.url));
  const pngDimensions = (image) => {
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    return [image.readUInt32BE(16), image.readUInt32BE(20)];
  };
  assert.match(html, /<a class="brand" href="\/"[^>]*>\s*<img src="\/icon\.svg" alt="" width="512" height="512">\s*<span class="brand-copy">[\s\S]*?<span class="brand-name">AfroSherik<\/span>[\s\S]*?<span lang="am">አፍሮ-ሸሪክ<\/span>[\s\S]*?<span class="brand-parent">An EthioLife service<\/span>/);
  assert.match(html, /<img src="\/brand\/afrosherik-campaign-hero\.png" alt="AfroSherik campaign artwork showing a woman with a phone and the Addis Ababa skyline beside the message: More Opportunities\. Stronger Communities\." width="427" height="204">/);
  assert.match(logo, /<title[^>]*>AfroSherik mark/);
  assert.match(logo, /#174b3d/i);
  assert.match(logo, /#d7ad59/i);
  assert.deepEqual(pngDimensions(hero), [427, 204]);
  assert.equal(existsSync(new URL('../public/brand/afrolife-woven-knot.svg', import.meta.url)), false);
  assert.match(styles, /\.topbar \.brand img\s*\{[^}]*flex:\s*0 0 50px;[^}]*width:\s*50px;[^}]*height:\s*50px;/s);
  assert.match(styles, /@media \(max-width: 650px\) \{[\s\S]*?\.topbar \.brand img\s*\{[^}]*flex-basis:\s*44px;[^}]*width:\s*44px;[^}]*height:\s*44px;/);
  assert.match(styles, /@media \(max-width: 920px\) and \(min-width: 651px\) \{\s*\.topbar\s*\{[^}]*grid-template-areas:\s*"brand language" "install account";/);
  assert.match(html, /class="welcome-signin-shortcut" href="#login-form">Sign in<\/a>/);
  assert.match(styles, /\.welcome-signin-shortcut\s*\{\s*display:\s*none;\s*\}/);
  assert.match(styles, /@media \(max-width: 700px\) \{\s*\.welcome-signin-shortcut\s*\{\s*display:\s*inline-flex;[\s\S]*?min-height:\s*46px;/);
});

test('mobile sign-in places the campaign welcome before sign-in and signup forms', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  const mobileRules = [...styles.matchAll(/@media \(max-width: 700px\) \{([\s\S]*?)\n\}/g)]
    .map(([, rules]) => rules)
    .find((rules) => rules.includes('.welcome-panel { order: 0; }'));
  assert.ok(mobileRules, 'the mobile breakpoint should move the welcome panel first');
  assert.match(mobileRules, /\.login-card,\s*\.signup-card\s*\{\s*order:\s*1;\s*\}/);

  const loginView = html.match(/<section id="login-view"[\s\S]*?<\/section>\s*<section id="public-hub"/)?.[0];
  assert.ok(loginView, 'the login view should remain intact');
  assert.ok(loginView.indexOf('class="welcome-panel"') < loginView.indexOf('id="login-form"'));
  assert.ok(loginView.indexOf('id="login-form"') < loginView.indexOf('id="signup-form"'));
  assert.ok(loginView.indexOf('id="signup-form"') < loginView.indexOf('id="server-setup-home"'));
});

test('AfroSherik icon uses the supplied mark with matching PWA icons and mini-app tokens', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const icon = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(icon, /viewBox="0 0 512 512"/);
  assert.doesNotMatch(icon, /<text\b/i);
  assert.match(icon, /<desc[^>]*>Three service and community members connected through a shared opportunity hub\.<\/desc>/);
  assert.match(icon, /#174b3d/i);
  assert.match(icon, /#d7ad59/i);
  assert.match(html, /<link rel="icon" href="\/icons\/afrosherik-icon-192\.png" type="image\/png" sizes="192x192">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/afrosherik-icon-192\.png">/);
  assert.match(html, new RegExp(`<meta name="theme-color" content="${manifest.theme_color}">`));
  assert.equal(manifest.theme_color, '#174b3d');
  assert.deepEqual(manifest.icons.slice(1, 4).map(({ src, sizes }) => [src, sizes]), [
    ['/icons/afrosherik-icon-192.png', '192x192'],
    ['/icons/afrosherik-icon-256.png', '256x256'],
    ['/icons/afrosherik-icon-512.png', '512x512'],
  ]);
  assert.match(styles, /:root\s*\{[^}]*--brand-green:\s*#174b3d/i);
  assert.match(styles, /--brand-green:\s*#174b3d/i);
  assert.match(styles, /--growth-green:\s*#397c58/i);
  assert.match(styles, /--opportunity-yellow:\s*#d7ad59/i);
  assert.match(styles, /--sunset-orange:\s*#a65336/i);
  assert.doesNotMatch(styles, /--(?:platform-blue|agent-purple|surface-blue|surface-purple)\b/i);
  assert.doesNotMatch(styles, /#(?:0066ff|7c3aed|eff6ff|f5f3ff|e0e7ff|004dcc|5b21b6)\b/i);
  assert.equal((styles.match(/:root\s*\{/g) ?? []).length, 1, 'shared design tokens should use the initial root declaration');
  assert.match(styles, /\[data-panel="agents"\]/);
});

test('public and signed-in shell labels use AfroSherik without replacing product-specific Edir wording', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const label of [
    'AFROSHERIK REGISTRATION',
    'THE AFROSHERIK BRIEF · ETHIOPIA',
    'AFROSHERIK OPERATIONS',
  ]) assert.ok(html.includes(label), `expected visible brand label: ${label}`);
  assert.doesNotMatch(html, /ETHIOLIFE REGISTRATION|THE AFROLIFE BRIEF · ETHIOPIA|ETHIOLIFE OPERATIONS/);
  assert.match(html, /AfroLife Edir/);
});

test('public hub integrates the campaign artwork with the existing public actions', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(html, /<section id="public-hub"[\s\S]*?<div class="hub-heading">[\s\S]*?<p class="eyebrow">CONNECT · ACCESS · THRIVE<\/p>[\s\S]*?<h2>One platform for work, homes, business, and community\.<\/h2>[\s\S]*?<figure class="hub-campaign">[\s\S]*?<div class="hub-service-network" role="img" aria-label="Work, homes, business, and community services connected through AfroSherik">/);
  assert.match(html, /<a class="button button-primary" href="#login-form">Sign in<\/a>/);
  assert.match(html, /<button id="public-create-account" class="button button-outline" type="button">Create account<\/button>/);
  assert.match(html, /<button class="button button-outline" type="button" data-install-pwa>Install AfroSherik<\/button>/);
  assert.match(html, /class="hub-network-node hub-network-node--work"[^>]*>Work<\/span>/);
  assert.match(html, /class="hub-network-node hub-network-node--homes"[^>]*>Homes<\/span>/);
  assert.match(html, /class="hub-network-node hub-network-node--business"[^>]*>Business<\/span>/);
  assert.match(html, /class="hub-network-node hub-network-node--community"[^>]*>Community<\/span>/);
  for (const panel of ['properties', 'marketplace', 'workers', 'edir', 'mfi', 'agents']) {
    assert.match(html, new RegExp(`<a class="service-card" data-panel="${panel}" href="#login-form">`));
  }
  assert.match(styles, /\.hub-heading\s*\{[^}]*linear-gradient\(125deg,\s*var\(--brand-green\)/s);
  assert.doesNotMatch(styles, /\.hub-heading::before\s*\{[^}]*repeating-linear-gradient/i);
  assert.doesNotMatch(styles, /\.hub-heading\s*\{[^}]*repeating-linear-gradient/i);
  assert.match(styles, /\.hub-service-network\s*\{[^}]*min-height:\s*232px;[^}]*border-radius:\s*13px;[^}]*background:/s);
  assert.match(styles, /@media \(max-width: 700px\) \{[\s\S]*?\.hub-service-network \{ min-height: 220px; \}/);
  assert.match(styles, /\.hub-heading \{ grid-template-columns: minmax\(0, 1fr\); gap:/);
  assert.match(styles, /#public-hub \.service-card\[data-panel\] \.service-icon\s*\{[^}]*background:\s*var\(--mini-app-tint\);[^}]*color:\s*var\(--mini-app-ink/s);
  assert.match(serviceWorker, /const CACHE = 'afrolife-shell-v39'/);
  assert.match(serviceWorker, /'\/tenant-data-admin\.js'/);
  for (const asset of [
    '/icons/afrosherik-icon-192.png', '/icons/afrosherik-icon-256.png', '/icons/afrosherik-icon-512.png',
    '/icon.svg', '/brand/afrosherik-campaign-hero.png',
  ]) assert.ok(serviceWorker.includes(`'${asset}'`), `service worker should cache ${asset}`);
});

test('public landing page does not repeat raster artwork across visible image elements', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const styles = [
    readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8'),
    readFileSync(new URL('../public/financial-workspaces.css', import.meta.url), 'utf8'),
  ].join('\n');
  const imageSources = [
    ...[...html.matchAll(/<img\b[^>]*\bsrc=(["'])(.*?)\1[^>]*>/gi)].map(([, , source]) => source),
    ...[...styles.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)].map(([, , source]) => source),
  ].filter((source) => /\.(?:png|jpe?g|webp|avif|gif)(?:[?#]|$)/i.test(source))
    .map((source) => source.split(/[?#]/, 1)[0].toLowerCase());
  const repeatedSources = [...new Set(imageSources.filter((source, index) => imageSources.indexOf(source) !== index))];

  assert.deepEqual(repeatedSources, []);
  assert.equal(imageSources.filter((source) => source === '/brand/afrosherik-campaign-hero.png').length, 1);
});

test('public subscription catalog includes the approved ETB 1,000 services', () => {
  assert.deepEqual(PUBLIC_SUBSCRIPTION_SERVICES.map(({ key }) => key), [
    'accounting', 'property_management', 'workforce_management', 'super_agent',
    'edir', 'insurance_brokerage', 'agent', 'landlord', 'seller',
  ]);
  assert.ok(PUBLIC_SUBSCRIPTION_SERVICES.every(({ monthlyEtb }) => monthlyEtb === 1000));
  assert.equal(PUBLIC_SUBSCRIPTION_SERVICES.some(({ key }) => key === 'accounting'), true);
  assert.deepEqual(
    normalizeSubscriptionCatalog({ services: PUBLIC_SUBSCRIPTION_SERVICES }).map(({ key }) => key),
    PUBLIC_SUBSCRIPTION_SERVICES.map(({ key }) => key),
  );
  assert.deepEqual(normalizeMySubscriptions({ requests: [{ id: 'one' }] }), [{ id: 'one' }]);
  assert.deepEqual(subscriptionRequestPayload(['edir', 'edir', 'agent']), { services: ['edir', 'agent'] });
});

test('public sign-in flow exposes recovery guidance and reliably navigates to the form', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
  const i18n = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');

  assert.match(html, /id="show-password-recovery"[^>]*aria-expanded="false"[^>]*aria-controls="password-recovery-help"/);
  assert.match(html, /id="password-recovery-help"[^>]*role="note"[^>]*hidden[^>]*>Contact your organization’s administrator/);
  assert.match(app, /button\.setAttribute\('aria-expanded', String\(!expanded\)\);[\s\S]*?help\.hidden = expanded;/);
  assert.match(app, /document\.querySelectorAll\('a\[href="#login-form"\]'\)/);
  assert.match(app, /loginForm\.scrollIntoView\(\{ behavior: reducedMotion \? 'auto' : 'smooth', block: 'start' \}\)/);
  assert.match(app, /loginForm\.querySelector\('input\[name="phone"\]'\)\.focus\(\{ preventScroll: true \}\)/);
  assert.match(styles, /#login-form \{ scroll-margin-block-start: 1rem; \}/);
  assert.match(i18n, /'One Platform\. Endless Possibilities\.':\s*\{\s*am: 'አንድ መድረክ። ወሰን የሌላቸው እድሎች።'/);
  assert.match(i18n, /'Forgot your password\?':\s*\{\s*am: 'የይለፍ ቃልዎን ረሱ\?'/);
});
