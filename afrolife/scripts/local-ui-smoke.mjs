import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const chrome = process.env.AFROLIFE_CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const appUrl = process.env.AFROLIFE_UI_URL ?? 'http://127.0.0.1:3010/';
const credentialFile = process.env.AFROLIFE_UI_USERS_FILE
  ?? join(process.env.LOCALAPPDATA ?? '', 'AfroLife', 'local-test-users.txt');
const additionalRoles = (process.env.AFROLIFE_UI_ROLES
  ?? 'corporate_business_manager,compliance,finance,finance_manager,master_agent,field_agent,customer,worker,property_owner')
  .split(',').map((role) => role.trim()).filter(Boolean);
const credentialLines = readFileSync(credentialFile, 'utf8').split(/\r?\n/);
const adminLine = credentialLines
  .find((line) => line.startsWith('super_admin |'));
assert.ok(adminLine, `A local Super Admin login is required in ${credentialFile}`);
const [, phone, password] = adminLine.split('|').map((part) => part.trim());
const mfaEnrollments = [];
const profile = mkdtempSync(join(tmpdir(), 'afrolife-ui-smoke-'));
assert.ok(profile.startsWith(tmpdir()), 'Browser profile must be isolated in the system temp directory');
const browser = spawn(chrome, [
  '--headless', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  appUrl,
], { stdio: 'ignore', windowsHide: true });

let socket;
let closeBrowser;
try {
  let debuggingPort;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (browser.exitCode !== null) throw new Error(`Chrome exited with code ${browser.exitCode}`);
    try {
      const portFile = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8');
      debuggingPort = Number(portFile.split(/\r?\n/)[0]);
      break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(debuggingPort, 'Chrome did not start its local DevTools endpoint');
  const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json/list`).then((response) => response.json());
  const target = targets.find((item) => item.type === 'page');
  assert.ok(target?.webSocketDebuggerUrl, 'Chrome page target was not found');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const pageErrors = [];
  const expectedPermissionResponses = [];
  const expectedSignOutResponses = [];
  const inFlightRequests = new Map();
  let revokedRequestIds = new Set();
  socket.addEventListener('message', ({ data }) => {
    const event = JSON.parse(data);
    if (event.method === 'Network.requestWillBeSent') {
      inFlightRequests.set(event.params.requestId, event.params.request.url);
    }
    if (event.method === 'Network.loadingFinished' || event.method === 'Network.loadingFailed') {
      inFlightRequests.delete(event.params.requestId);
    }
    if (event.method === 'Runtime.exceptionThrown') pageErrors.push(event.params.exceptionDetails.text);
    if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') {
      const entry = event.params.entry;
      const url = entry.url ?? '';
      const deniedPath = (() => {
        try { return new URL(url).pathname.replace(/^\/api\/v1/, ''); }
        catch { return ''; }
      })();
      const roleGuardedPaths = new Set([
        '/workers', '/requests', '/leases', '/tenants', '/rent-transactions/pending',
        '/leads', '/commissions', '/insurance/requests',
        '/insurance/requests/agent-referrals/me', '/insurance/requests/agent-referrals/agents',
      ]);
      const sessionGuardedPaths = new Set(['/marketplace/config', '/marketplace/listings', '/learning/content', '/system/status']);
      const expectedRoleDenial = entry.text.includes('403 (Forbidden)') && roleGuardedPaths.has(deniedPath);
      const expectedSessionDenial = entry.text.includes('401 (Unauthorized)')
        && (sessionGuardedPaths.has(deniedPath) || deniedPath === '/rent-transactions/pending');
      const expectedSignOutDenial = entry.text.includes('401 (Unauthorized)')
        && revokedRequestIds.has(entry.networkRequestId);
      if (expectedSignOutDenial) {
        expectedSignOutResponses.push(deniedPath);
      } else if (expectedRoleDenial || expectedSessionDenial) {
        expectedPermissionResponses.push(deniedPath);
      } else {
        pageErrors.push(`${entry.text}${url ? ` (${url})` : ''}`);
      }
    }
    if (event.id) {
      const callback = pending.get(event.id);
      pending.delete(event.id);
      callback?.(event);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome DevTools timed out: ${method}`)); }, 10000);
    pending.set(id, (event) => { clearTimeout(timeout); event.error ? reject(new Error(event.error.message)) : resolve(event.result); });
    socket.send(JSON.stringify({ id, method, params }));
  });
  closeBrowser = () => socket.send(JSON.stringify({ id: ++nextId, method: 'Browser.close' }));
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) {
      const details = response.exceptionDetails.exception?.description
        ?? response.exceptionDetails.text;
      throw new Error(`Browser evaluation failed: ${details}`);
    }
    return response.result.value;
  };
  const waitFor = async (expression, label, attempts = 80) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const submitLoginAndWait = async (role, code) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (code) await new Promise((resolve) => setTimeout(resolve, 30_000 - (Date.now() % 30_000) + 1000));
      await evaluate(`(() => {
        const form = document.querySelector('#login-form');
        ${code ? `form.elements.code.value = ${JSON.stringify(code)};` : ''}
        form.requestSubmit();
        return true;
      })()`);
      const responseReady = code
        ? "document.querySelector('#app-view')?.hidden === false || !!document.querySelector('#login-error')?.textContent?.trim()"
        : "document.querySelector('#app-view')?.hidden === false || document.querySelector('#mfa-field')?.hidden === false || !!document.querySelector('#login-error')?.textContent?.trim()";
      try {
        await waitFor(responseReady, `${role} login response`, 150);
      } catch {
        const snapshot = await evaluate(`({ appVisible: document.querySelector('#app-view')?.hidden === false, mfaVisible: document.querySelector('#mfa-field')?.hidden === false, loginError: document.querySelector('#login-error')?.textContent?.trim() || '' })`);
        throw new Error(`${role} login response timed out: ${JSON.stringify({ ...snapshot, inFlightRequests: [...inFlightRequests.values()] })}`);
      }
      const result = await evaluate(`({ appVisible: document.querySelector('#app-view')?.hidden === false, mfaVisible: document.querySelector('#mfa-field')?.hidden === false, error: document.querySelector('#login-error')?.textContent?.trim() || '' })`);
      if (result.appVisible || (!code && result.mfaVisible)) return result;
      const retry = result.error.match(/try again in (\d+) seconds?/i);
      if (!retry || attempt === 3) throw new Error(`${role} sign-in failed: ${result.error || 'no response'}`);
      await new Promise((resolve) => setTimeout(resolve, (Number(retry[1]) + 1) * 1000));
    }
    throw new Error(`${role} sign-in exceeded the retry limit`);
  };

  const totp = (secret) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const character of secret.replace(/=+$/, '').toUpperCase()) {
      const digit = alphabet.indexOf(character);
      assert.ok(digit >= 0, 'Saved authenticator key must be valid Base32');
      value = (value << 5) | digit;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
        value &= (1 << bits) - 1;
      }
    }
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
    const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
    const offset = digest[19] & 15;
    const code = (((digest[offset] & 127) << 24) | (digest[offset + 1] << 16)
      | (digest[offset + 2] << 8) | digest[offset + 3]) % 1_000_000;
    return String(code).padStart(6, '0');
  };

  const persistMfaKey = (role, rolePhone, rolePassword, secret) => {
    const lines = readFileSync(credentialFile, 'utf8').split(/\r?\n/);
    const index = lines.findIndex((line) => line.split('|')[1]?.trim() === rolePhone);
    assert.notEqual(index, -1, `Credential row for ${role} must exist before storing its authenticator key`);
    const label = lines[index].split('|')[0].trim();
    lines[index] = `${label} | ${rolePhone} | ${rolePassword} | ${secret}`;
    writeFileSync(credentialFile, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
    if (process.platform === 'win32') {
      const account = `${process.env.USERDOMAIN ?? ''}\\${process.env.USERNAME ?? ''}`;
      spawnSync('icacls.exe', [credentialFile, '/inheritance:r', '/grant:r', `${account}:(M)`], { stdio: 'ignore' });
    }
    mfaEnrollments.push({ role, phone: rolePhone, authenticatorSetupKey: secret });
  };

  const completeStaffMfaSetup = async (role, rolePhone, rolePassword) => {
    const pageTitle = await evaluate("document.querySelector('#page-title')?.textContent?.trim() || ''");
    if (pageTitle !== 'Account security') return false;
    const accountLine = credentialLines.find((line) => line.split('|')[1]?.trim() === rolePhone);
    const existingSecret = accountLine?.split('|')[3]?.trim();
    if (existingSecret) {
      await waitFor("document.querySelector('#mfa-field')?.hidden === false", `${role} authenticator challenge`);
      const code = totp(existingSecret);
      await evaluate(`(() => {
        const form = document.querySelector('#login-form');
        form.elements.code.value = ${JSON.stringify(code)};
        form.requestSubmit();
        return true;
      })()`);
      await waitFor("document.querySelector('#page-title')?.textContent?.trim() === 'Your workspace'", `${role} authenticator sign-in`);
      return true;
    }

    const setupButton = await evaluate("!!document.querySelector('#workspace [data-action=\"mfa-setup\"]')");
    if (!setupButton) return false;
    await evaluate("document.querySelector('#workspace [data-action=\"mfa-setup\"]').click()");
    try {
      await waitFor("!!document.querySelector('#workspace form[data-form=\"mfa-enable\"]')", `${role} authenticator setup form`);
    } catch {
      const snapshot = await evaluate(`({
        pageTitle: document.querySelector('#page-title')?.textContent?.trim(),
        alert: document.querySelector('#alert')?.textContent?.trim(),
        setupButton: !!document.querySelector('#workspace [data-action="mfa-setup"]'),
        workspaceText: document.querySelector('#workspace')?.innerText?.slice(0, 500),
      })`);
      throw new Error(`Authenticator setup did not render for ${role}: ${JSON.stringify(snapshot)}`);
    }
    const secret = await evaluate("document.querySelector('#workspace code')?.textContent?.trim() || ''");
    assert.ok(secret, `${role} authenticator setup key should be visible`);
    const code = totp(secret);
    await evaluate(`(() => {
      const form = document.querySelector('#workspace form[data-form="mfa-enable"]');
      form.elements.code.value = ${JSON.stringify(code)};
      form.requestSubmit();
      return true;
    })()`);
    await waitFor("document.querySelector('#page-title')?.textContent?.trim() === 'Account security'", `${role} MFA enrollment confirmation`);
    await evaluate("document.querySelector('#app-view .tabs [data-panel=\"overview\"]')?.click()");
    await waitFor("document.querySelector('#page-title')?.textContent?.trim() === 'Your workspace'", `${role} MFA enrollment and workspace`);
    persistMfaKey(role, rolePhone, rolePassword, secret);
    return true;
  };

  const accessibilityAudit = async (label) => {
    const result = await evaluate(`(() => {
      const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const named = (el) => {
        const labelledBy = el.getAttribute('aria-labelledby');
        const referenced = labelledBy?.split(/\\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
        const label = el.labels ? [...el.labels].map((item) => item.textContent.trim()).filter(Boolean).join(' ') : '';
        return el.getAttribute('aria-label') || referenced || label || el.getAttribute('title') || el.innerText?.trim() || el.textContent?.trim() || '';
      };
      const issues = [];
      if (!document.documentElement.lang?.trim()) issues.push('html element is missing lang');
      const headings = [...document.querySelectorAll('main h1')].filter(visible);
      if (headings.length !== 1) issues.push('visible main must contain exactly one h1');
      for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=link]')) {
        if (visible(el) && !named(el)) issues.push(el.tagName.toLowerCase() + '#' + (el.id || '(no id)') + ' has no accessible name');
      }
      for (const el of document.querySelectorAll('img')) {
        if (visible(el) && !el.hasAttribute('alt')) issues.push('img#' + (el.id || '(no id)') + ' is missing alt text');
      }
      return { label: ${JSON.stringify(label)}, issues };
    })()`);
    assert.deepEqual(result.issues, [], `Accessibility smoke failed at ${label}: ${result.issues.join('; ')}`);
    return result;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable');
  await waitFor("document.readyState === 'complete' && !!document.querySelector('#login-form')", 'login form');
  const accessibilityChecks = [await accessibilityAudit('login')];
  await evaluate(`(() => { const form = document.querySelector('#login-form'); form.elements.phone.value = ${JSON.stringify(phone)}; form.elements.password.value = ${JSON.stringify(password)}; return true; })()`);
  const superAdminMfaSecret = credentialLines.find((line) => line.startsWith('super_admin |'))?.split('|')[3]?.trim();
  try {
    const login = await submitLoginAndWait('Super Admin');
    if (login.mfaVisible) {
      assert.ok(superAdminMfaSecret, 'Super Admin authenticator challenge requires the isolated test account setup key');
      const code = totp(superAdminMfaSecret);
      const authenticated = await submitLoginAndWait('Super Admin authenticator', code);
      assert.equal(authenticated.appVisible, true, 'Super Admin authenticator code should complete sign-in');
    }
  } catch {
    throw new Error(`Super Admin sign-in did not complete: ${await evaluate("document.querySelector('#login-error')?.textContent || 'no form error shown'")}`);
  }
  await completeStaffMfaSetup('super_admin', phone, password);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  try {
    await waitFor("!!document.querySelector('#mobile-workspace-nav [data-panel=\"overview\"][aria-current=\"page\"]')", 'accessible current-page state in mobile navigation');
  } catch {
    const snapshot = await evaluate(`({
      appHidden: document.querySelector('#app-view')?.hidden,
      pageTitle: document.querySelector('#page-title')?.textContent?.trim(),
      loginError: document.querySelector('#login-error')?.textContent?.trim(),
      mobileNavHidden: document.querySelector('#mobile-workspace-nav')?.hidden,
      mobileNav: document.querySelector('#mobile-workspace-nav')?.innerHTML,
      currentTabs: [...document.querySelectorAll('.tab[aria-current="page"]')].map((tab) => tab.dataset.panel),
      currentMobile: [...document.querySelectorAll('#mobile-workspace-nav [aria-current="page"]')].map((tab) => tab.dataset.panel || tab.id),
    })`);
    throw new Error(`Mobile current-page navigation state is missing: ${JSON.stringify(snapshot)}`);
  }
  accessibilityChecks.push(await accessibilityAudit('Super Admin overview'));
  const mfiEnabled = await evaluate("document.querySelector('#mfi-tab')?.hidden === false");
  let mfiInstitutionAvailable = false;
  if (mfiEnabled) {
    await waitFor("!!document.querySelector('#workspace .service-launcher-card [data-action=\"open-panel\"][data-panel=\"mfi\"]')", 'role-aware mini-app launcher');
    await evaluate("document.querySelector('#workspace .service-launcher-card [data-action=\"open-panel\"][data-panel=\"mfi\"]').click()");
    await waitFor("!!document.querySelector('#workspace .mfi-workspace')", 'SACCO workspace rendering');
    await waitFor("!!document.querySelector('#workspace [data-mfi-service-search]') || !!document.querySelector('#workspace [data-mfi-form=\"create-institution\"]')", 'SACCO institution state');
    mfiInstitutionAvailable = await evaluate("!!document.querySelector('#workspace [data-mfi-service-search]')");
    if (!mfiInstitutionAvailable) {
      assert.equal(await evaluate("!!document.querySelector('#workspace [data-mfi-form=\"create-institution\"]')"), true,
        'An empty SACCO environment should present the institution setup workflow to a platform administrator');
    }
  } else {
    assert.equal(await evaluate("document.querySelector('#mfi-tab')?.hidden"), true, 'Disabled SACCO pilot should remain hidden');
  }
  await evaluate("document.querySelector('#agents-tab').click()");
  await waitFor("document.querySelector('#page-title')?.textContent?.trim() === 'Agent management'", 'Agent management workspace');
  const superAdminAgentApps = await evaluate(`({
    available: [...document.querySelectorAll('.tab[data-panel]:not([hidden])')]
      .map((tab) => tab.dataset.panel)
      .filter((panel) => ['leads', 'workers', 'requests', 'properties', 'marketplace', 'contracts', 'commissions', 'rent', 'agents'].includes(panel)),
    cards: document.querySelectorAll('#workspace .service-launcher-card').length,
  })`);
  if (superAdminAgentApps.available.length) {
    await waitFor("!!document.querySelector('#workspace .service-launcher-card [data-action=\"open-panel\"][data-panel=\"commissions\"]')", 'Super Admin mini-app shortcuts for the selected tenant');
  } else {
    assert.equal(superAdminAgentApps.cards, 0,
      'An unscoped Super Admin should not see service shortcuts before selecting an enabled tenant');
  }
  if (mfiEnabled && mfiInstitutionAvailable) {
    await evaluate("document.querySelector('#mfi-tab').click()");
    await waitFor("!!document.querySelector('#workspace .mfi-workspace')", 'SACCO workspace return');
    try {
      await waitFor("!!document.querySelector('#workspace [data-mfi-service-search]')", 'accessible service finder', 150);
    } catch {
      const snapshot = await evaluate(`({ title: document.querySelector('#page-title')?.textContent?.trim(), panel: document.querySelector('#workspace')?.dataset.panel, alert: document.querySelector('#alert')?.textContent?.trim(), mfi: document.querySelector('#workspace .mfi-workspace')?.innerText?.slice(0, 900), workspace: document.querySelector('#workspace')?.innerText?.slice(0, 900) })`);
      throw new Error(`MFI service finder did not render: ${JSON.stringify(snapshot)}`);
    }
    const serviceSearch = await evaluate(`(() => {
      const field = document.querySelector('#workspace [data-mfi-service-search]');
      field.value = 'Digital wallet';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      const visible = [...document.querySelectorAll('#workspace .mfi-module-link')].filter((item) => !item.hidden);
      const result = visible.map((item) => item.querySelector('.mfi-module-name')?.textContent);
      field.value = '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      return result;
    })()`);
    assert.deepEqual(serviceSearch, ['Digital wallet'], 'Service finder should return the matching service and hide unrelated entries');
    await waitFor("!!document.querySelector('#workspace [data-mfi-module=\"members\"]')", 'SACCO service navigation');
    await waitFor("!!document.querySelector('#workspace [data-mfi-module=\"members\"] .mfi-module-status.status-partial')", 'module readiness indicator');
    await evaluate("document.querySelector('#workspace [data-mfi-module=\"members\"]').click()");
    await waitFor("!!document.querySelector('#workspace .mfi-member-form')", 'member registration form');
    await evaluate("document.querySelector('#workspace [data-mfi-module=\"credit\"]').click()");
    await waitFor("!!document.querySelector('#workspace .mfi-submodule-area .mfi-submodule-card')", 'credit service submodules');
    await waitFor("!!document.querySelector('#workspace [data-mfi-form=\"credit-policy\"]')", 'credit policy configuration form');
    await waitFor("!!document.querySelector('#workspace [name=\"monthly_income\"]')", 'credit application affordability inputs');
    await evaluate("document.querySelector('#workspace [data-mfi-focus-target=\"mfi-credit-policy-settings\"]')?.click()");
    await waitFor("document.activeElement?.id === 'mfi-credit-policy-settings'", 'submodule configuration shortcut');
    await evaluate("document.querySelector('#workspace [data-mfi-module=\"collections\"]').click()");
    await waitFor("!!document.querySelector('#workspace .mfi-section')", 'collections workflow screen');
    await evaluate("document.querySelector('#workspace [data-mfi-module=\"risk-fraud\"]').click()");
    await waitFor("!!document.querySelector('#workspace [data-mfi-form=\"npl-classification\"]') || !!document.querySelector('#workspace .mfi-record-list')", 'risk classification screen');
    await evaluate("document.querySelector('#workspace [data-mfi-module=\"staff\"]')?.click()");
    await waitFor("!!document.querySelector('#workspace .mfi-staff-form')", 'institution staff form');
  } else if (mfiEnabled) {
    await evaluate("document.querySelector('#mfi-tab').click()");
    try {
      await waitFor("!!document.querySelector('#workspace [data-mfi-form=\"create-institution\"]')", 'SACCO institution setup empty state');
    } catch {
      const snapshot = await evaluate(`({ title: document.querySelector('#page-title')?.textContent?.trim(), panel: document.querySelector('#workspace')?.dataset.panel, alert: document.querySelector('#alert')?.textContent?.trim(), workspace: document.querySelector('#workspace')?.innerText?.slice(0, 500) })`);
      throw new Error(`SACCO institution setup did not return: ${JSON.stringify(snapshot)}`);
    }
  }
  const edirEnabled = await evaluate("document.querySelector('#edir-tab')?.hidden === false");
  if (edirEnabled) {
    await evaluate("document.querySelector('#edir-tab').click()");
    await waitFor("document.querySelector('#page-title')?.textContent === 'EthioLife Edir workspace' && document.querySelector('#stat-grid')?.hidden === true", 'Edir rendering in the shared workspace shell');
    await waitFor("Array.from(document.querySelectorAll('#workspace .edir-service-nav button')).some((button) => button.dataset.edirFocus === 'edir-finance')", 'Edir mini-app shortcuts');
    await evaluate("Array.from(document.querySelectorAll('#workspace .edir-service-nav button')).find((button) => button.dataset.edirFocus === 'edir-finance').click()");
    await waitFor("document.activeElement && document.activeElement.id === 'edir-finance'", 'Edir savings and accounts shortcut');
  }

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobileNavigation = await evaluate(`(() => {
    const nav = document.querySelector('#mobile-workspace-nav');
    const more = document.querySelector('#mobile-workspace-more');
    const links = [...nav.querySelectorAll('.workspace-nav-link')];
    return {
      visible: getComputedStyle(nav).display !== 'none',
      count: links.length,
      shortestTarget: Math.min(...links.map((link) => link.getBoundingClientRect().height)),
      labels: links.map((link) => link.getAttribute('aria-label') || link.textContent.trim()),
    };
  })()`);
  assert.equal(mobileNavigation.visible, true, 'Mobile quick navigation should be visible');
  assert.equal(mobileNavigation.count, 4, 'Mobile navigation should keep no more than three primary destinations plus More');
  assert.ok(mobileNavigation.shortestTarget >= 44, `Mobile navigation targets are too small: ${JSON.stringify(mobileNavigation)}`);
  await evaluate("document.querySelector('#mobile-workspace-more').click()");
  await waitFor("document.querySelector('#workspace-more-dialog')?.open === true", 'mobile workspace sections sheet');
  assert.equal(await evaluate("document.querySelector('#mobile-workspace-more').getAttribute('aria-expanded')"), 'true',
    'More navigation should expose its expanded state');
  await waitFor("!!document.querySelector('#workspace-more-nav [data-panel=\"admin\"]')", 'additional role-visible sections');
  assert.equal(await evaluate("document.querySelector('#mobile-workspace-more').getAttribute('aria-current')"), 'page',
    'More navigation should identify the current page when it is in the additional sections');
  await evaluate("document.querySelector('#workspace-more-nav [data-panel=\"admin\"]').click()");
  await waitFor("document.querySelector('#workspace-more-dialog')?.open === false && document.querySelector('#page-title')?.textContent === 'Admin workspace'", 'More navigation selection');
  await waitFor("document.querySelector('#mobile-workspace-more')?.getAttribute('aria-expanded') === 'false'", 'More navigation collapsed state');
  assert.equal(await evaluate("document.querySelector('#mobile-workspace-more').getAttribute('aria-expanded')"), 'false',
    'More navigation should report its collapsed state after selecting a section');

  const layouts = [];
  for (const [width, height, label] of [[320, 720, 'small-mobile'], [390, 844, 'mobile'], [768, 1024, 'tablet'], [1440, 900, 'desktop']]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    layouts.push(await evaluate(`({device:${JSON.stringify(label)},width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})`));
  }
  for (const layout of layouts) {
    assert.ok(layout.documentWidth <= layout.width + 1, `${layout.device} page overflows horizontally: ${JSON.stringify(layout)}`);
    assert.ok(layout.bodyWidth <= layout.width + 1, `${layout.device} body overflows horizontally: ${JSON.stringify(layout)}`);
  }
  const roleChecks = [];
  for (const role of additionalRoles) {
    const accountLine = credentialLines.find((line) => line.startsWith(`${role} |`));
    assert.ok(accountLine, `Missing local ${role} credentials`);
    const [, rolePhone, rolePassword] = accountLine.split('|').map((part) => part.trim());
    revokedRequestIds = new Set(inFlightRequests.keys());
    await evaluate("document.querySelector('#logout').click()");
    await waitFor("document.querySelector('#app-view')?.hidden === true && document.querySelector('#login-form')?.hidden === false", `${role} sign-in form`);
    await evaluate(`(() => { const form = document.querySelector('#login-form'); form.elements.phone.value = ${JSON.stringify(rolePhone)}; form.elements.password.value = ${JSON.stringify(rolePassword)}; return true; })()`);
    const roleCredentials = accountLine.split('|').map((part) => part.trim());
    const roleMfaSecret = roleCredentials[3];
    const roleLogin = await submitLoginAndWait(role);
    if (roleLogin.mfaVisible) {
      assert.ok(roleMfaSecret, `${role} authenticator challenge requires the isolated test account setup key`);
      const code = totp(roleMfaSecret);
      const authenticated = await submitLoginAndWait(`${role} authenticator`, code);
      assert.equal(authenticated.appVisible, true, `${role} authenticator code should complete sign-in`);
    }
    await waitFor("document.querySelector('#page-title')?.textContent?.trim() === 'Your workspace'", `${role} overview rendering`);
    const roleCheck = await evaluate(`({role:${JSON.stringify(role)},title:document.querySelector('#page-title')?.textContent?.trim() || '',adminVisible:document.querySelector('#admin-tab')?.hidden === false})`);
    assert.equal(roleCheck.title, 'Your workspace', `${role} should start in its own overview after another account signs out`);
    assert.equal(roleCheck.adminVisible, ['corporate_business_manager', 'compliance'].includes(role), `${role} admin navigation should follow its assigned role`);
    if (role === 'master_agent') {
      await evaluate("document.querySelector('#agents-tab').click()");
      await waitFor("!!document.querySelector('#workspace .service-launcher-card [data-action=\"open-panel\"][data-panel=\"commissions\"]')",
        'Master Agent mini-app shortcuts for assigned services');
      await evaluate("document.querySelector('.tab[data-panel=\"overview\"]').click()");
      await waitFor("document.querySelector('#page-title')?.textContent?.trim() === 'Your workspace'",
        'Master Agent return to the overview');
    }
    roleChecks.push(roleCheck);
  }
  assert.deepEqual(pageErrors, [], `Browser console/runtime errors: ${pageErrors.join('; ')}`);
  const checks = [
    'Super Admin login and tenant-scoped Agent management shortcuts',
    'Master Agent mini-app shortcuts for assigned services', 'mobile bottom navigation visibility and touch target sizing',
    'More sections sheet navigation', '320px/mobile/tablet/desktop horizontal overflow',
    `${roleChecks.length} additional role sign-ins`, 'accessible names, image alternatives, document language and main heading smoke',
    'browser exceptions and unexpected console errors',
  ];
  if (mfiEnabled && mfiInstitutionAvailable) checks.push('SACCO navigation, service finder, member, policy, affordability, collections, NPL, and staff screens');
  else if (mfiEnabled) checks.push('SACCO pilot empty-state and institution setup are shown when no institution is provisioned');
  else checks.push('SACCO pilot remains hidden while disabled');
  if (edirEnabled) checks.push('Edir workspace and finance shortcut');
  console.log(JSON.stringify({ result: 'PASS', checks, skipped: [
    ...(!mfiEnabled ? ['SACCO workflows (pilot disabled in this environment)'] : !mfiInstitutionAvailable ? ['SACCO institution workflows (no institution is provisioned)'] : []),
    ...(edirEnabled ? [] : ['Edir workflows (disabled in this environment)']),
    ...(roleChecks.length ? [] : ['Additional-role journeys (no role accounts configured)']),
  ], accessibilityChecks, mobileNavigation, layouts, roleChecks, mfaEnrollments,
  expectedPermissionResponses: { count: expectedPermissionResponses.length, endpoints: [...new Set(expectedPermissionResponses)] },
  expectedSignOutResponses: { count: expectedSignOutResponses.length, endpoints: [...new Set(expectedSignOutResponses)] } }, null, 2));
} finally {
  if (closeBrowser) {
    try { closeBrowser(); }
    catch (error) {
      if (browser.exitCode === null) console.warn(`Could not close the isolated Chrome session cleanly: ${error.message}`);
    }
  }
  socket?.close();
  if (Number.isInteger(browser.pid) && browser.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => browser.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    if (browser.exitCode === null) {
      if (process.platform === 'win32') {
        spawnSync('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        browser.kill('SIGTERM');
      }
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  let removed = false;
  let cleanupError;
  for (let attempt = 0; attempt < 12 && !removed; attempt++) {
    try { rmSync(profile, { recursive: true, force: true }); removed = true; }
    catch (error) { cleanupError = error; await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  if (!removed) console.warn(`Could not clean isolated Chrome profile (${cleanupError?.code ?? 'unknown filesystem error'}).`);
}
