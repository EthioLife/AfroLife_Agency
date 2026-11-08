import { getLocalizedNodeSource, initializeLocale, setLocalizedAttribute, setLocalizedNodeText, t, translateContent } from './i18n.js';
import { ApiError, optionalApiFallback } from './api-errors.js';
import { createMfiWorkspace } from './mfi.js';
import { createAccountingWorkspace } from './accounting.js';
import { createEdirWorkspace } from './edir.js';
import { createPrivacyWorkspace } from './privacy.js';
import { createGlobalBiWorkspace } from './global-bi.js';
import { createTenantDataAdminWorkspace } from './tenant-data-admin.js';
import { createAdminRoleAccessEditor, createMiniAppAccessEditor } from './mini-app-access.js';
import { miniAppByPanel } from './mini-apps/registry.js';
import { isMiniAppAllowed, isPanelEnabled, panelFromUrl, panelUrl } from './workspace-navigation.js';
import { MIN_SEARCH_QUERY_LENGTH, searchWorkspaceRecords } from './workspace-search.js';
import { EDIR_APPLICATION_DOCUMENTS, canChangeServer, edirApplicationDocumentPath, missingSignupDocuments, nativeApiOrigin, signupRequiredDocuments } from './registration-flows.js';
import { agentDashboardMetrics, marketplaceDashboardMetrics, propertyDashboardMetrics, propertyOwnerDashboardMetrics, staffingDashboardMetrics, workforceDashboardMetrics } from './dashboard-metrics.js';
import { normalizeMySubscriptions, normalizeSubscriptionCatalog, PUBLIC_SUBSCRIPTION_SERVICES, subscriptionRequestPayload } from './subscriptions.js';
import { propertyOfferTerms } from './property-offers.js';
import { marketplaceListingPayload } from './marketplace-form.js';
import { paginateRows } from './row-pagination.js';
import { filterWorkerActivityReports, workerActivityReportsCsv } from './worker-activity-reports.js';
import { phonePayload as canonicalPhonePayload } from './phone-input.js';

const WEB_API_ROOT = '/api/v1';
let API_ROOT = WEB_API_ROOT;
const TOKEN_KEY = 'afrolife.session';
const API_URL_KEY = 'afrolife.api-base';
const SIGNUP_UPLOAD_KEY = 'afrolife.signup-upload';
const SIGNUP_DONE_KEY = 'afrolife.signup-upload-complete';
const SIGNUP_DOCUMENTS_KEY = 'afrolife.signup-uploaded-documents';
const EDIR_APPLICATION_UPLOAD_KEY = 'afrolife.edir-application-upload';
const EDIR_ORGANIZATION_KEY = 'afrolife.edir-organization';
const PROPERTY_TENANT_KEY = 'afrolife.property-tenant';
const PROPERTY_TENANT_SUPPORT_GRANT_KEY = 'afrolife.property-tenant-support-grant';
const DEFAULT_EDIR_ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const STAFF = new Set(['global_admin', 'super_admin', 'compliance', 'finance', 'finance_manager']);
const REQUIRED_MFA_ROLES = new Set(['global_admin', 'super_admin', 'compliance', 'finance', 'finance_manager', 'corporate_business_manager']);
const KNOWN_PANELS = new Set([
  'overview', 'launcher', 'subscriptions', 'leads', 'workers', 'requests', 'support', 'learning', 'properties', 'marketplace', 'tenant-data-admin',
  'contracts', 'commissions', 'agents', 'rent', 'mfi', 'accounting', 'edir',
  'insurance', 'privacy', 'global-bi', 'security', 'admin', 'status', 'password',
]);
const MINI_APP_PANELS = new Set([
  'leads', 'workers', 'requests', 'learning', 'properties', 'marketplace',
  'contracts', 'commissions', 'agents', 'rent', 'mfi', 'accounting', 'edir',
  'insurance', 'privacy', 'global-bi',
]);
const $ = (selector) => document.querySelector(selector);
const state = { user: null, features: { mfiPilotEnabled: false, edirEnabled: false, accountingEnabled: false, globalBiEnabled: false, insuranceBrokerageSandboxEnabled: false, enabledModules: [] }, edirMe: null, edirOrganizationId: localStorage.getItem(EDIR_ORGANIZATION_KEY) ?? DEFAULT_EDIR_ORGANIZATION, propertyTenantContextId: localStorage.getItem(PROPERTY_TENANT_KEY), propertyTenantMemberships: [], platformTenantContextId: null, dataAdminTenantId: null, myDataCapabilities: [], tenantDataWorkspace: null, tenantAnalyticsStatus: null, panel: panelFromUrl(window.location.href, KNOWN_PANELS), mfaRequired: false, accessOptions: [], mfaSetup: null, authSessions: [], supportCases: [], supportQueue: [], supportAccessRequests: [], supportAgents: [], supportCaseDetail: null, supportCaseEvents: [], leads: [], workers: [], workerDocumentExpiry: [], workerPortalEngagements: [], workerPortalReports: [], workerPortalSettlements: [], workerSupportRequests: [], workerSupportQueue: [], workerPortalShifts: [], workerPortalLeave: [], workerPortalPayrollExports: [], workforceEngagements: [], workforceShifts: [], workforceTimeQueue: [], workforceLeaveQueue: [], workforcePolicies: [], workforcePayrollExports: [], workforcePayableCalculation: null, workforcePayrollExportBatch: null, requests: [], staffingEngagements: [], staffingFinanceEngagements: [], pendingStaffingWork: [], properties: [], propertyAuthorityReviewQueue: [], rentalApplications: [], residentPropertyWorkspace: { leases: [], charges: [], payments: [], maintenance: [] }, maintenanceRequests: [], maintenanceVendors: [], maintenanceMetrics: null, maintenanceOverdue: [], maintenanceCostQueue: [], maintenanceInvoiceMismatchQueue: [], maintenanceInvoiceApprovalQueue: [], maintenanceHasMore: false, maintenanceLoadingMore: false, ownerStatements: [], territories: [], commissions: [], summary: null, users: [], team: [], globalAdminPromotions: [], businessRules: [], roleAccess: null, notificationDeliveryStatus: [], learningContent: [], signupOptions: null, contracts: [], leases: [], tenants: [], pendingRent: [], serviceIdentities: [], readinessEvidence: [], propertyAccountingTemplate: null, propertyPeriodClose: null, marketplaceConfig: {}, marketplaceListings: [], marketplaceSellers: [], insuranceRequests: [], insuranceStaffRequests: [], insuranceAgentReferrals: [], insuranceEligibleAgents: [], insuranceSandboxStatus: null, insuranceSandboxCases: [], platformServices: [], platformServicePackages: [], platformTenants: [], tenantAdminTenants: [], platformCatalogProducts: [], platformDataAdmin: null, businessTenants: [], serviceStatus: null, serviceMetrics: null, searchResults: [], searchUnavailable: [], searchQuery: '', workspaceDataErrors: [], workspaceDataOmitted: [] };
state.propertyTenantSupportGrantId = localStorage.getItem(PROPERTY_TENANT_SUPPORT_GRANT_KEY);
state.propertyTenantSupportGrants = [];
state.propertyOperatingTenants = [];
state.propertyTenantPendingGrants = [];
state.propertyAgentScopes = [];
state.propertyTenantAgentCandidates = [];
const loadedPanels = new Set();
let accessVisiblePanels = new Set();
state.supportAppealQueue = [];
state.workerReportFilters = { startDate: '', endDate: '', status: 'all' };
state.overviewDataErrors = [];
state.overviewDataOmitted = [];
state.overviewLoadedAt = null;
state.assistant = { conversations: [], queue: [], selectedId: null, messages: [], available: false, onlineCount: 0 };
let workspaceSearchSequence = 0;
let deferredInstallPrompt = null;
let supportAccessExpiryTimer = null;
let assistantHeartbeatTimer = null;
let assistantRefreshTimer = null;
const propertyPhotoUrls = new Set();
const subscriptionState = { catalog: null, catalogError: false, catalogLoading: true, mine: [], mineError: false, mineLoaded: false, selected: new Set(), requestSubmitted: false, reviews: [], reviewError: false, reviewLoaded: false };
let sessionIdleTimer = null;
let sessionHeartbeatTimer = null;
let sessionActivityHandler = null;
let sessionIdleTimeoutMs = 30 * 60 * 1000;
let lastSessionActivityAt = Date.now();
const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.())
  || (window.location.protocol === 'https:' && window.location.hostname === 'localhost');

function apiRoot() {
  if (!isNativeApp) {
    API_ROOT = window.AFROLIFE_API_URL ? `${window.AFROLIFE_API_URL.replace(/\/+$/, '')}/api/v1` : WEB_API_ROOT;
    return API_ROOT;
  }
  const base = localStorage.getItem(API_URL_KEY);
  if (!base) throw new Error(t('Enter the API server address first.'));
  API_ROOT = `${base}/api/v1`;
  return API_ROOT;
}

function propertyTenantRequestHeaders() {
  if (!state.propertyTenantContextId) return {};
  const supportGrant = state.propertyTenantSupportGrants.find((grant) =>
    grant.id === state.propertyTenantSupportGrantId
      && grant.tenant_system_id === state.propertyTenantContextId);
  return {
    'x-afrolife-property-tenant-id': state.propertyTenantContextId,
    ...(supportGrant ? { 'x-afrolife-property-tenant-purpose': supportGrant.purpose } : {}),
  };
}

function authenticatedPropertyFetch(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.set('authorization', ['Bearer', token].join(' '));
  for (const [name, value] of Object.entries(propertyTenantRequestHeaders())) headers.set(name, value);
  return fetch(`${apiRoot()}${path}`, { ...options, headers });
}

function roleLabel(role) {
  const labels = {
    global_admin: 'Global Admin',
    super_admin: 'Super Admin',
    compliance: 'Compliance',
    finance: 'Finance',
    finance_manager: 'Finance manager',
    corporate_business_manager: 'Business Admin',
    master_agent: 'Master agent',
    field_agent: 'Field agent',
    customer: 'Buyer / customer',
    worker: 'Worker',
    property_owner: 'Property owner / landlord',
    property_vendor: 'Property vendor',
  };
  return t(labels[role] ?? role.replaceAll('_', ' '));
}

const ACCOUNT_ROLE_GROUPS = {
  staff: ['corporate_business_manager', 'compliance', 'finance', 'finance_manager'],
  agents: ['master_agent', 'field_agent'],
  members: ['customer', 'worker', 'property_owner'],
};

function editableAccountRoles(user, actor) {
  if (user.id === actor.id) return [];
  if (actor.role === 'super_admin'
    && (user.created_by !== actor.id || !ACCOUNT_ROLE_GROUPS.agents.includes(user.role))) return [];
  return Object.values(ACCOUNT_ROLE_GROUPS).find((roles) => roles.includes(user.role)) ?? [];
}

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined && text !== null) setLocalizedNodeText(item.appendChild(document.createTextNode('')), String(text));
  if (className) item.className = className;
  return item;
}

function setLocalizedText(element, message, values = {}) {
  element.dataset.i18nSource = message;
  element.dataset.i18nValues = JSON.stringify(values);
  element.textContent = t(message, values);
}

function isPlatformAdmin(role = state.user?.role) {
  return role === 'global_admin' || role === 'super_admin';
}

function hasActivity(activity) {
  return state.user?.role_activities?.[activity] === true;
}

function showAlert(message, error = false, values = {}) {
  const box = $('#alert');
  setLocalizedText(box, message, values);
  box.classList.toggle('error', error);
  box.hidden = !message;
}

const ASSISTANT_SUPPORT_STAFF = new Set(['global_admin', 'super_admin', 'compliance', 'corporate_business_manager']);

function assistantButton(message, action, id) {
  const control = node('button', undefined, 'button button-outline');
  control.type = 'button';
  control.dataset.action = action;
  if (id) control.dataset.id = id;
  setLocalizedText(control, message);
  return control;
}

function renderAssistant() {
  const assistant = state.assistant;
  setLocalizedText($('#assistant-intro'), 'Your access and support options follow your AfroLife role.');
  setLocalizedText($('#assistant-disclosure'), 'Your support request is private to you and the support agent who claims it. Do not send passwords, payment card details, or authentication codes.');
  setLocalizedText($('#assistant-availability-status'), 'Online support agents: {{count}}', { count: assistant.onlineCount });
  const presenceButton = $('#assistant-presence-toggle');
  presenceButton.hidden = !ASSISTANT_SUPPORT_STAFF.has(state.user?.role);
  setLocalizedText(presenceButton, assistant.available ? 'Stop offering support' : 'Make me available');

  const actions = $('#assistant-role-actions');
  actions.replaceChildren();
  for (const [panel, label] of [
    ['properties', 'Open property services'],
    ['workers', 'Open workforce tools'],
    ['support', 'Open support cases'],
  ]) {
    const tab = document.querySelector(`.tab[data-panel="${panel}"]`);
    if (!tab || tab.hidden) continue;
    const control = assistantButton(label, 'assistant-navigate');
    control.dataset.panel = panel;
    actions.append(control);
  }

  const mine = $('#assistant-mine');
  mine.replaceChildren();
  if (!assistant.conversations.length) {
    mine.append(node('p', 'Start a conversation by describing what you need.', 'assistant-empty'));
  } else {
    for (const conversation of assistant.conversations) {
      const item = node('div', undefined, 'assistant-conversation-item');
      const status = conversation.status === 'assigned' ? 'Assigned to support' : 'Awaiting response';
      const title = node('span', `${t('Conversation')} · ${t(status)}`);
      const open = assistantButton('Conversation', 'assistant-select', conversation.id);
      item.append(title, open);
      mine.append(item);
    }
  }

  const queueSection = $('#assistant-staff-queue');
  queueSection.hidden = !ASSISTANT_SUPPORT_STAFF.has(state.user?.role);
  const queue = $('#assistant-queue');
  queue.replaceChildren();
  if (!queueSection.hidden) {
    if (!assistant.queue.length) {
      queue.append(node('p', 'Start a conversation by describing what you need.', 'assistant-empty'));
    } else {
      for (const conversation of assistant.queue) {
        const item = node('div', undefined, 'assistant-queue-item');
        const details = node('span', `${roleLabel(conversation.owner_role)} · ${t(conversation.status === 'assigned' ? 'Assigned to support' : 'Awaiting response')}`);
        const open = conversation.assigned_to === state.user.id
          ? assistantButton('Conversation', 'assistant-select', conversation.id)
          : assistantButton('Claim conversation', 'assistant-claim', conversation.id);
        item.append(details, open);
        queue.append(item);
      }
    }
  }

  const selected = assistant.conversations.find((item) => item.id === assistant.selectedId)
    ?? assistant.queue.find((item) => item.id === assistant.selectedId && item.assigned_to === state.user?.id);
  const thread = $('#assistant-thread');
  thread.hidden = !selected;
  if (!selected) return;
  setLocalizedText($('#assistant-thread-title'), 'Conversation');
  const messages = $('#assistant-messages');
  messages.replaceChildren();
  for (const message of assistant.messages) {
    const item = node('li', undefined, 'assistant-message');
    item.dataset.sender = message.sender_type;
    const sender = message.sender_type === 'user'
      ? (message.sender_id === state.user.id ? 'You' : roleLabel(message.sender_role))
      : 'AfroLife support';
    item.append(node('small', sender));
    const body = document.createElement('p');
    body.textContent = message.body;
    item.append(body);
    const time = new Date(message.created_at);
    if (Number.isFinite(time.getTime())) {
      item.append(node('small', new Intl.DateTimeFormat(document.documentElement.lang, {
        dateStyle: 'medium', timeStyle: 'short',
      }).format(time)));
    }
    messages.append(item);
  }
  messages.scrollTop = messages.scrollHeight;
  $('#assistant-reply-form').dataset.id = selected.id;
  $('#assistant-reply-form').hidden = selected.status !== 'assigned';
}

async function refreshAssistant() {
  if (!state.user) return;
  const staff = ASSISTANT_SUPPORT_STAFF.has(state.user.role);
  const [presence, conversations, queue] = await Promise.all([
    api('/assistant/availability'),
    api('/assistant/conversations/mine'),
    staff ? api('/assistant/conversations/queue') : Promise.resolve([]),
  ]);
  state.assistant.onlineCount = presence.online_count;
  state.assistant.available = presence.available;
  state.assistant.conversations = conversations;
  state.assistant.queue = queue;
  const selected = conversations.some((item) => item.id === state.assistant.selectedId)
    || queue.some((item) => item.id === state.assistant.selectedId && item.assigned_to === state.user.id);
  if (!selected) {
    state.assistant.selectedId = null;
    state.assistant.messages = [];
  } else {
    state.assistant.messages = await api(`/assistant/conversations/${encodeURIComponent(state.assistant.selectedId)}/messages`);
  }
  renderAssistant();
}

async function selectAssistantConversation(id) {
  const messages = await api(`/assistant/conversations/${encodeURIComponent(id)}/messages`);
  state.assistant.selectedId = id;
  state.assistant.messages = messages;
  renderAssistant();
}

function startAssistantHeartbeat() {
  if (assistantHeartbeatTimer) clearInterval(assistantHeartbeatTimer);
  if (!state.user || !ASSISTANT_SUPPORT_STAFF.has(state.user.role) || !state.assistant.available) return;
  assistantHeartbeatTimer = setInterval(async () => {
    try {
      await api('/assistant/availability', { method: 'PUT', body: JSON.stringify({ available: true }) });
      await refreshAssistant();
    } catch (error) {
      clearInterval(assistantHeartbeatTimer);
      assistantHeartbeatTimer = null;
      showAlert(error.message, true);
    }
  }, 60_000);
}

const INDUSTRY_NEWS_CATEGORIES = {
  business: 'Business & finance',
  property: 'Property & housing',
  workforce: 'Workforce & employment',
  technology: 'Technology & digital',
};

function formatNewsTime(value, options = {}) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function setIndustryNewsStatus(message, modifier = '') {
  const status = $('#industry-news-status');
  status.textContent = message;
  status.className = `news-status${modifier ? ` news-status--${modifier}` : ''}`;
}

function renderIndustryNews(articles) {
  const results = $('#industry-news-results');
  const selectedCategory = document.querySelector('[data-news-filter][aria-pressed="true"]')?.dataset.newsFilter ?? 'all';
  const visibleArticles = selectedCategory === 'all'
    ? articles
    : articles.filter((article) => article.category === selectedCategory);
  results.replaceChildren();
  if (!visibleArticles.length) {
    const empty = document.createElement('p');
    empty.className = 'news-empty';
    empty.textContent = selectedCategory === 'all'
      ? 'No current headlines are available from these feeds.'
      : `No recent headlines are available for ${INDUSTRY_NEWS_CATEGORIES[selectedCategory] ?? 'this sector'}.`;
    results.append(empty);
    return;
  }
  visibleArticles.forEach((article, index) => {
    if (!INDUSTRY_NEWS_CATEGORIES[article.category] || typeof article.title !== 'string'
      || typeof article.source !== 'string' || typeof article.publishedAt !== 'string') return;
    let url;
    try {
      url = new URL(article.url);
      if (url.protocol !== 'https:' || url.username || url.password) return;
    } catch {
      return;
    }
    const story = document.createElement('article');
    story.className = `news-story${index === 0 ? ' news-story--lead' : ''}`;
    const category = document.createElement('p');
    category.className = 'news-story-category';
    category.textContent = INDUSTRY_NEWS_CATEGORIES[article.category];
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = url.toString();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = article.title;
    heading.append(link);
    const attribution = document.createElement('div');
    attribution.className = 'news-story-attribution';
    const source = document.createElement('span');
    source.textContent = article.source;
    const published = document.createElement('time');
    published.dateTime = article.publishedAt;
    published.textContent = formatNewsTime(article.publishedAt, { dateStyle: 'medium' });
    attribution.append(source, published);
    story.append(category, heading, attribution);
    results.append(story);
  });
  if (!results.childElementCount) {
    const empty = document.createElement('p');
    empty.className = 'news-empty';
    empty.textContent = 'No headlines are available for this sector.';
    results.append(empty);
  }
}

async function loadPublicIndustryNews() {
  const results = $('#industry-news-results');
  const fallback = $('#industry-news-fallback');
  if (!results || !fallback) return;
  document.querySelectorAll('[data-news-filter]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-news-filter]').forEach((filter) => {
      const selected = filter === button;
      filter.setAttribute('aria-pressed', String(selected));
    });
    if (Array.isArray(loadPublicIndustryNews.articles)) renderIndustryNews(loadPublicIndustryNews.articles);
  }));
  results.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/public/industry-news', {
      headers: { accept: 'application/json' },
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(`Industry news request failed (${response.status})`);
    const payload = await response.json();
    if (!Array.isArray(payload.articles)) throw new Error('Industry news response was invalid');
    const articles = payload.articles;
    loadPublicIndustryNews.articles = articles;
    renderIndustryNews(articles);
    const updated = $('#industry-news-updated');
    updated.textContent = payload.updatedAt
      ? `Updated ${formatNewsTime(payload.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}`
      : '';
    fallback.hidden = articles.length > 0;
    if (articles.length === 0) {
      $('#industry-news-fallback-message').textContent = payload.updatedAt
        ? 'No headlines were found in the selected feeds during the past 30 days. Search current coverage from Google News:'
        : 'Live headlines are temporarily unavailable. Search current coverage from Google News:';
      setIndustryNewsStatus(payload.updatedAt ? 'No recent headlines' : 'Feeds unavailable', payload.updatedAt ? 'empty' : 'error');
    } else if (payload.stale) {
      setIndustryNewsStatus('Showing last successful update', 'stale');
    } else if (payload.status === 'partial') {
      setIndustryNewsStatus('Some feeds unavailable', 'partial');
    } else {
      setIndustryNewsStatus('Feeds updated', 'ready');
    }
  } catch (error) {
    console.warn('AfroLife industry news could not be loaded.', error);
    fallback.hidden = false;
    $('#industry-news-fallback-message').textContent = 'Live headlines are temporarily unavailable. Search current coverage from Google News:';
    results.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'news-empty';
    empty.textContent = 'We could not connect to the news feeds just now.';
    results.append(empty);
    setIndustryNewsStatus('Feeds unavailable', 'error');
  } finally {
    results.setAttribute('aria-busy', 'false');
  }
}
loadPublicIndustryNews.articles = null;
loadPublicIndustryNews();
setInterval(loadPublicIndustryNews, 15 * 60 * 1000);

async function api(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('x-afrolife-edir-id', state.edirOrganizationId);
  for (const [name, value] of Object.entries(propertyTenantRequestHeaders())) headers.set(name, value);
  if (state.user?.role === 'super_admin' && state.platformTenantContextId) {
    headers.set('x-afrolife-platform-tenant-id', state.platformTenantContextId);
  }
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof Blob)) headers.set('content-type', 'application/json');
  const response = await fetch(`${apiRoot()}${path}`, { ...options, headers });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token && token === sessionStorage.getItem(TOKEN_KEY)) {
      signOut({ revoke: false, message: 'Your session expired or is no longer active. Please sign in again.' });
    }
    const retryAfter = Number(result?.retry_after_seconds ?? response.headers.get('retry-after'));
    if (response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
      throw new Error(t(result?.error ?? 'Too many requests. Please try again in {{seconds}} seconds.', { seconds: Math.ceil(retryAfter) }));
    }
    throw new ApiError(t(result?.error ?? 'Request failed ({{status}})', { status: response.status }), response.status);
  }
  return result;
}

async function downloadAuthenticatedFile(path, filename) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${apiRoot()}${path}`, {
    headers: {
      'x-afrolife-edir-id': state.edirOrganizationId,
      ...propertyTenantRequestHeaders(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new ApiError(result?.error ?? `File download failed (${response.status}).`, response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function readSessionJson(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function number(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(t('Enter a valid number.'));
  return parsed;
}

function button(label, action, className = 'button button-outline', data = {}) {
  const result = node('button', label, className);
  result.type = action === 'submit' ? 'submit' : 'button';
  result.dataset.action = action;
  for (const [key, value] of Object.entries(data)) result.dataset[key] = value;
  return result;
}

function empty(message) {
  return node('div', message, 'empty-state');
}

function sectionHeading(title, subtitle) {
  const wrapper = node('div', undefined, 'section-heading');
  const copy = node('div');
  copy.append(node('h2', title), node('p', subtitle));
  wrapper.append(copy);
  return wrapper;
}

function field(labelText, name, type = 'text', required = true, extra = {}) {
  const label = node('label', labelText);
  const input = node(type === 'select' ? 'select' : type === 'textarea' ? 'textarea' : 'input');
  input.name = name;
  input.required = required;
  if (type !== 'select' && type !== 'textarea') input.type = type;
  for (const [key, value] of Object.entries(extra)) input[key] = key === 'placeholder' ? t(value) : value;
  label.append(input);
  return { label, input };
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = formData(form);
  const error = $('#login-error');
  setLocalizedText(error, '');
  try {
    const phoneFields = canonicalPhonePayload(form);
    const payload = { ...values, ...phoneFields };
    if ('phone_national_number' in phoneFields) delete payload.phone;
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    if (result.mfa_required) {
      $('#mfa-field').hidden = false;
      setLocalizedText(error, 'Enter the six-digit code from your authenticator app.');
      return;
    }
    state.panel = panelFromUrl(window.location.href, KNOWN_PANELS);
    sessionStorage.setItem(TOKEN_KEY, result.token);
    state.mfaRequired = result.restrict === 'mfa';
    state.accessOptions = Array.isArray(result.access_options) ? result.access_options : [];
    if (!state.mfaRequired && state.accessOptions.length > 1) {
      renderAccessModeChoice(state.accessOptions);
      return;
    }
    await loadWorkspace();
  } catch (reason) {
    setLocalizedText(error, reason.message);
  }
}

function renderAccessModeChoice(accessOptions) {
  const chooser = $('#access-mode-choice');
  const options = $('#access-mode-options');
  options.replaceChildren();
  for (const role of accessOptions) {
    const optionLabel = role === 'super_admin' ? 'Access as Super Admin'
      : role === 'global_admin' ? 'Access as Global Admin'
        : `Continue as ${roleLabel(role)}`;
    const option = button(optionLabel,
      'access-mode-choice', 'button button-primary button-wide', { role });
    options.append(option);
  }
  $('#access-mode-error').textContent = '';
  $('#login-form').hidden = true;
  chooser.hidden = false;
}

async function switchAccessMode(role) {
  const error = $('#access-mode-error');
  if (error) error.textContent = '';
  try {
    await api('/auth/access-role', { method: 'POST', body: JSON.stringify({ role }) });
    if ($('#access-mode-choice')) $('#access-mode-choice').hidden = true;
    await loadWorkspace();
  } catch (reason) {
    if (error) error.textContent = reason.message;
    else showAlert(reason.message, true);
  }
}

async function requestPasswordRecovery(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  setLocalizedText($('#recovery-status'), '');
  try {
    await api('/auth/password-recovery/request', {
      method: 'POST',
      body: JSON.stringify(canonicalPhonePayload(form)),
    });
    setLocalizedText($('#recovery-status'), 'If recovery becomes available, instructions will be provided without confirming whether an account exists.');
  } catch (error) {
    setLocalizedText($('#recovery-status'), error.message);
  } finally {
    submit.disabled = false;
  }
}

function territoryLabel(area) {
  const levels = { region: 'Region', city: 'City', sub_city: 'Sub-city', woreda: 'Woreda', kebele: 'Kebele' };
  const path = String(area.path ?? area.name).split(' · ').slice(1).join(' · ');
  return `${path || area.name} (${t(levels[area.level] ?? 'Territory')})`;
}

function renderSignupTerritoryOptions() {
  if (!state.signupOptions) return;
  const search = $('#signup-territory-search');
  const territory = $('#signup-territory');
  const list = $('#signup-territory-options');
  const selectedId = territory.value;
  const selectedArea = state.signupOptions.territories.find((area) => String(area.id) === selectedId);
  territory.replaceChildren(new Option('', ''));
  list.replaceChildren();
  for (const area of state.signupOptions.territories) {
    const label = territoryLabel(area);
    territory.add(new Option(label, area.id));
    const suggestion = document.createElement('option');
    suggestion.value = label;
    list.append(suggestion);
  }
  if (selectedArea) {
    territory.value = String(selectedArea.id);
    search.value = territoryLabel(selectedArea);
  }
}

async function loadSignupOptions() {
  if (!state.signupOptions) state.signupOptions = await api('/auth/signup/options');
  const accountSelect=$('#signup-account-type');
  let previous=accountSelect.value;
  const savedSignup = readSessionJson(SIGNUP_DOCUMENTS_KEY);
  if (savedSignup?.accountType) previous = savedSignup.accountType;
  accountSelect.replaceChildren(new Option('Select an account type',''));
  for(const item of state.signupOptions.account_types??[]){if(!item.enabled)continue;const option=new Option(t(item.label),item.key);accountSelect.add(option);}
  if((state.signupOptions.account_types??[]).some((item)=>item.key===previous&&item.enabled))accountSelect.value=previous;
  if (sessionStorage.getItem(SIGNUP_UPLOAD_KEY) && sessionStorage.getItem(SIGNUP_DONE_KEY) !== 'true') {
    accountSelect.disabled = true;
  }
  refreshSignupKyc();
  renderSignupTerritoryOptions();
  updatePlanLabels();
}

function signupDocumentLabel(documentType) {
  const labels = {
    national_id: 'KYC identity document',
    police_clearance: 'Police clearance',
  };
  return t(labels[documentType] ?? documentType.split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' '));
}

function signupDocumentInput(documentType) {
  const known = {
    national_id: $('#signup-national-id'),
    police_clearance: $('#signup-police-clearance'),
  }[documentType];
  if (known) return known;
  const container = $('#signup-extra-kyc-documents');
  let input = [...container.querySelectorAll('input[type="file"][data-doc-type]')]
    .find((candidate) => candidate.dataset.docType === documentType);
  if (!input) {
    const label = document.createElement('label');
    label.dataset.docTypeLabel = documentType;
    label.append(document.createTextNode(`${signupDocumentLabel(documentType)} (PDF, JPEG or PNG · max 10 MB)`));
    input = document.createElement('input');
    input.type = 'file';
    input.name = `kyc_document_${documentType}`;
    input.dataset.docType = documentType;
    input.accept = 'application/pdf,image/jpeg,image/png';
    input.setAttribute('capture', 'environment');
    label.append(input);
    container.append(label);
  }
  return input;
}

function refreshSignupKyc() {
  const accountType = $('#signup-account-type').value;
  const requiredDocuments = signupRequiredDocuments(state.signupOptions, accountType);
  const staticInputs = [$('#signup-national-id'), $('#signup-police-clearance')];
  const extraInputs = [...$('#signup-extra-kyc-documents').querySelectorAll('input[type="file"][data-doc-type]')];
  const allInputs = [...staticInputs, ...extraInputs];
  if (requiredDocuments) {
    for (const documentType of requiredDocuments) signupDocumentInput(documentType);
  }
  const selectedInputs = [...staticInputs, ...$('#signup-extra-kyc-documents').querySelectorAll('input[type="file"][data-doc-type]')];
  const savedSignup = readSessionJson(SIGNUP_DOCUMENTS_KEY);
  const uploadedDocuments = new Set(savedSignup?.uploadedDocuments ?? []);
  for (const input of selectedInputs) {
    const required = Boolean(requiredDocuments?.includes(input.dataset.docType) && !uploadedDocuments.has(input.dataset.docType));
    input.required = required;
    input.closest('label').hidden = !required;
  }
  const note = $('#signup-kyc-required-note');
  if (!accountType) {
    setLocalizedText(note, 'Choose an account type to see required documents.');
  } else if (!state.signupOptions) {
    setLocalizedText(note, 'Document requirements are not available yet. Try again before submitting.');
  } else if (!requiredDocuments) {
    setLocalizedText(note, 'Could not confirm document requirements for this account type. Please retry loading signup requirements.');
  } else if (!requiredDocuments.length) {
    setLocalizedText(note, 'No identity documents are required for this account type.');
  } else {
    setLocalizedText(note, 'Required documents: {{documents}}. Upload PDF, JPEG or PNG files up to 10 MB each.', {
      documents: requiredDocuments.map(signupDocumentLabel).join(', '),
    });
  }
  for (const input of allInputs) {
    if (!selectedInputs.includes(input)) input.required = false;
  }
}

function syncSignupTerritory() {
  const search = $('#signup-territory-search');
  const value = search.value.trim();
  const territories = state.signupOptions?.territories ?? [];
  const matches = territories.filter((area) => [
    territoryLabel(area),
    String(area.path ?? '').split(' · ').slice(1).join(' · '),
    area.name,
  ].some((label) => label.localeCompare(value, undefined, { sensitivity: 'base' }) === 0));
  const selected = matches.length === 1 ? matches[0] : undefined;
  $('#signup-territory').value = selected ? String(selected.id) : '';
  search.setCustomValidity('');
  return selected;
}
function updatePlanLabels() {
  if (state.signupOptions?.plans) {
    const plans = state.signupOptions.plans;
    $('#signup-plan option[value="pro"]').textContent = t('Pro plan — ETB {{amount}} per month', { amount: plans.agent_pro_monthly_etb });
    $('#signup-plan option[value="enterprise"]').textContent = t('Enterprise plan — ETB {{amount}} per month', { amount: plans.agent_enterprise_monthly_etb });
  }
  const descriptions = {
    free: ['Free service', 'Core AfroLife tools for your role, including lead, worker, request, contract and listing workflows.'],
    pro: ['Pro service', 'Pro is a plan request only. Future paid features require billing and activation.'],
    enterprise: ['Enterprise service', 'Enterprise is a plan request only. Team reporting is not active until billing and activation are configured.'],
  };
  const [title, description] = descriptions[$('#signup-plan').value] ?? descriptions.free;
  $('#signup-plan-title').textContent = t(title);
  $('#signup-plan-description').textContent = t(description);
}

function updateSignupFields() {
  const isAgent = $('#signup-account-type').value === 'agent';
  const isSeller = $('#signup-account-type').value === 'property_owner';
  const isFieldAgent = isAgent && $('#signup-agent-type').value === 'field';
  const isWorker = $('#signup-account-type').value === 'worker';
  $('#pension-interest-field').hidden = !isWorker;
  $('#worker-enterprise-field').hidden = !isWorker;
  $('#worker-document-consent-field').hidden = !isWorker;
  $('#worker-document-consent').required = isWorker;
  $('#agent-fields').hidden = !isAgent;
  $('#service-plan-fields').hidden = !(isAgent || isSeller);
  $('#parent-agent-field').hidden = !isFieldAgent;
  $('#worker-date-of-birth-field').hidden = !isWorker;
  $('#worker-date-of-birth').required = isWorker;
  $('#signup-agent-type').required = isAgent;
  $('#signup-territory-search').required = isAgent;
  if (!isAgent) $('#signup-territory-search').setCustomValidity('');
  $('#signup-plan').required = isAgent || isSeller;
  $('#parent-agent-field input').required = isFieldAgent;
  refreshSignupKyc();
  updatePlanLabels();
}

function openSignup(agentPlans = false, edirMember = false) {
  $('#login-form').hidden = true;
  $('#recovery-form').hidden = true;
  $('#signup-form').hidden = false;
  $('#signup-success').hidden = true;
  if (sessionStorage.getItem(SIGNUP_UPLOAD_KEY)) {
    if (sessionStorage.getItem(SIGNUP_DONE_KEY) === 'true') {
      showSignupFollowupMode();
      void loadSignupFollowup();
    } else {
      $('#signup-form').dataset.signupCreated = 'true';
      showSignupFollowupMode();
      setLocalizedText($('#signup-success'), 'A registration is already pending. Upload the required documents to finish it.');
      void loadSignupFollowup();
    }
  }
  if (agentPlans) {
    $('#signup-account-type').value = 'agent';
    updateSignupFields();
  }
  if (edirMember) $('#signup-form [name="edir_member_interest"]').checked = true;
  loadSignupOptions().catch((error) => {
    setLocalizedText($('#signup-error'), error.message);
    setLocalizedText($('#signup-kyc-required-note'), 'Document requirements are not available yet. Try again before submitting.');
  });
}

function showSignupFollowupMode() {
  const form = $('#signup-form');
  form.dataset.signupCreated = 'true';
  $('#signup-followup').hidden = false;
  $('#signup-success').hidden = false;
  setLocalizedText($('#signup-success'), 'Your registration is pending review. Check document decisions below and replace any document returned by Compliance.');
  for (const child of form.children) {
    child.hidden = !['signup-followup', 'signup-success', 'show-login'].includes(child.id)
      && !['H2', 'P'].includes(child.tagName);
  }
  $('#signup-followup').hidden = false;
  $('#signup-success').hidden = false;
}

async function loadSignupFollowup() {
  const token = sessionStorage.getItem(SIGNUP_UPLOAD_KEY);
  if (!token) return;
  const list = $('#signup-followup-documents');
  const select = $('#signup-followup-type');
  list.replaceChildren();
  select.replaceChildren();
  try {
    const response = await fetch(`${apiRoot()}/auth/signup/documents`, { headers: { authorization: `Signup ${token}` } });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error ?? `Could not load document review (${response.status}).`);
    const byType = new Map(result.documents.map((document) => [document.doc_type, document]));
    for (const docType of result.required) {
      const document = byType.get(docType);
      const label = docType.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
      const item = card(label, document?.review_note ?? (document ? 'Received and awaiting compliance decision.' : 'Required document is missing.'), document?.status ?? 'missing');
      list.append(item);
      if (!document || document.status === 'rejected') {
        const option = node('option', document?.status === 'rejected' ? `Replace ${label} (returned)` : `Upload ${label}`);
        option.value = docType;
        select.append(option);
      }
    }
    const needsReplacement = Boolean(select.options.length);
    $('#signup-followup-form').hidden = !needsReplacement;
    select.required = needsReplacement;
    $('#signup-followup-form [name="file"]').required = needsReplacement;
    if (!select.options.length) list.append(node('p', 'All required documents are received. Compliance will review them before account activation.', 'muted'));
  } catch (error) {
    list.append(empty(error.message));
    $('#signup-followup-form').hidden = true;
    select.required = false;
    $('#signup-followup-form [name="file"]').required = false;
  }
}

async function uploadSignupReplacement() {
  const token = sessionStorage.getItem(SIGNUP_UPLOAD_KEY);
  const docType = $('#signup-followup-type').value;
  const file = $('#signup-followup-form [name="file"]').files[0];
  if (!token || !docType || !file) throw new Error(t('Choose a returned or missing document and select a replacement file.'));
  if (file.size > 10 * 1024 * 1024) throw new Error(t('This file exceeds the 10 MB upload limit.'));
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error(t('Choose a PDF, JPEG or PNG document.'));
  const response = await fetch(`${apiRoot()}/auth/signup/documents?${new URLSearchParams({ doc_type: docType })}`, {
    method: 'POST', headers: { authorization: `Signup ${token}`, 'content-type': file.type }, body: file,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? `Replacement upload failed (${response.status}).`);
  $('#signup-followup-form [name="file"]').value = '';
  await loadSignupFollowup();
  showAlert(t('Replacement document uploaded securely for compliance review.'));
}

function initializeNativeServer() {
  if (!isNativeApp) return;
  const saved = nativeApiOrigin(localStorage.getItem(API_URL_KEY));
  localStorage.setItem(API_URL_KEY, saved);
  $('#api-server-url').value = saved;
  $('#server-setup').hidden = Boolean(saved);
  $('#login-form').hidden = !saved;
  $('#signup-form').hidden = true;
  $('#show-agent-plans').hidden = !saved;
  $('#join-edir').hidden = !saved;
  if (saved) apiRoot();
}

async function submitSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = formData(form);
  const error = $('#signup-error');
  setLocalizedText(error, '');
  const savedSignup = readSessionJson(SIGNUP_DOCUMENTS_KEY);
  const accountType = savedSignup?.accountType ?? values.account_type;
  const requiredDocs = savedSignup?.requiredDocuments
    ?? signupRequiredDocuments(state.signupOptions, accountType);
  if (!Array.isArray(requiredDocs)) {
    setLocalizedText(error, 'Could not confirm document requirements for this account type. Please retry loading signup requirements.');
    return;
  }
  if (values.password !== values.password_confirmation) {
    setLocalizedText(error, 'Password confirmation does not match.');
    return;
  }
  const fileForDocument = (documentType) => signupDocumentInput(documentType).files[0];
  const uploadedDocuments = new Set(savedSignup?.uploadedDocuments ?? []);
  const missingDocuments = missingSignupDocuments(
    requiredDocs.filter((documentType) => !uploadedDocuments.has(documentType)),
    fileForDocument,
  );
  if (missingDocuments === null) {
    setLocalizedText(error, 'Could not confirm document requirements for this account type. Please retry loading signup requirements.');
    return;
  }
  if (missingDocuments.length) {
    setLocalizedText(error, 'Select each required KYC document before submitting.');
    return;
  }
  let phoneFields;
  try {
    phoneFields = canonicalPhonePayload(form);
  } catch (reason) {
    setLocalizedText(error, reason.message);
    return;
  }
  const payload = {
    legal_name: values.legal_name,
    ...phoneFields,
    email: values.email,
    password: values.password,
    password_confirmation: values.password_confirmation,
    account_type: values.account_type,
    ...(values.account_type === 'worker' ? { date_of_birth: values.date_of_birth } : {}),
    worker_document_consent: values.worker_document_consent === 'on',
    pension_match_interest: values.pension_match_interest === 'on',
    edir_member_interest: values.edir_member_interest === 'on',
    edir_life_interest: values.edir_life_interest === 'on',
    household_cover_interest: values.household_cover_interest === 'on',
    option_a_enterprise_interest: values.option_a_enterprise_interest === 'on',
  };
  if (values.account_type === 'agent' || values.account_type === 'property_owner') {
    payload.requested_plan = values.requested_plan;
  }
  if (values.account_type === 'agent') {
    const selectedTerritory = syncSignupTerritory();
    if (!selectedTerritory) {
      $('#signup-territory-search').setCustomValidity(t('Choose a territory from the suggestions.'));
      $('#signup-territory-search').reportValidity();
      return;
    }
    Object.assign(payload, {
      agent_type: values.agent_type,
      territory_id: Number(selectedTerritory.id),
      requested_plan: values.requested_plan,
    });
    if (values.agent_type === 'field') payload.parent_agent_phone = values.parent_agent_phone;
  }
  try {
    let uploadToken = sessionStorage.getItem(SIGNUP_UPLOAD_KEY);
    if (!form.dataset.signupCreated) {
      const signup = await api('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
      uploadToken = signup.upload_token;
      if (!uploadToken) throw new Error(t('Registration succeeded but a secure document-upload token was not issued. Contact AfroLife support.'));
      sessionStorage.setItem(SIGNUP_UPLOAD_KEY, uploadToken);
      sessionStorage.setItem(SIGNUP_DOCUMENTS_KEY, JSON.stringify({
        accountType,
        requiredDocuments: requiredDocs,
        uploadedDocuments: [],
      }));
      form.dataset.signupCreated = 'true';
      $('#signup-account-type').disabled = true;
    }
    const uploadState = readSessionJson(SIGNUP_DOCUMENTS_KEY) ?? {
      accountType,
      requiredDocuments: requiredDocs,
      uploadedDocuments: [],
    };
    uploadState.uploadedDocuments ??= [];
    for (const docType of requiredDocs) {
      if (uploadState.uploadedDocuments.includes(docType)) continue;
      const file = fileForDocument(docType);
      if (!file) throw new Error(t('Select each required KYC document before submitting.'));
      if (file.size > 10 * 1024 * 1024) throw new Error(t('This file exceeds the 10 MB upload limit.'));
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error(t('Choose a PDF, JPEG or PNG document.'));
      const query = new URLSearchParams({ doc_type: docType });
      const response = await fetch(`${apiRoot()}/auth/signup/documents?${query}`, {
        method: 'POST',
        headers: {
          authorization: `Signup ${uploadToken}`,
          'content-type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t(result?.error ?? 'Document upload failed ({{status}})', { status: response.status }));
      uploadState.uploadedDocuments.push(docType);
      sessionStorage.setItem(SIGNUP_DOCUMENTS_KEY, JSON.stringify(uploadState));
      fileForDocument(docType).value = '';
      refreshSignupKyc();
    }
    sessionStorage.setItem(SIGNUP_DONE_KEY, 'true');
    sessionStorage.removeItem(SIGNUP_DOCUMENTS_KEY);
    form.reset();
    $('#signup-account-type').disabled = false;
    updateSignupFields();
    showSignupFollowupMode();
    await loadSignupFollowup();
  } catch (reason) {
    setLocalizedText(error, form.dataset.signupCreated
      ? `Your registration is saved, but document upload needs attention: ${reason.message} Select the required files and submit again to retry.`
      : reason.message);
  }
}

function getEdirApplicationProgress() {
  const progress = readSessionJson(EDIR_APPLICATION_UPLOAD_KEY);
  if (!progress || typeof progress.applicationId !== 'string' || !progress.uploadToken
      || !Array.isArray(progress.uploadedDocuments)) return null;
  return progress;
}

function syncEdirRegistrationRequirements(progress = getEdirApplicationProgress()) {
  const form = $('#edir-registration-form');
  const uploaded = new Set(progress?.uploadedDocuments ?? []);
  for (const document of EDIR_APPLICATION_DOCUMENTS) {
    const input = form.querySelector(`[name="${document.type}_file"]`);
    const done = uploaded.has(document.type);
    input.required = !done;
    input.closest('label').hidden = done;
  }
  const isRetry = Boolean(progress);
  for (const field of form.querySelectorAll('input:not([type="file"]), select, textarea')) {
    if (!('wasRequired' in field.dataset)) field.dataset.wasRequired = String(field.required);
    field.required = !isRetry && field.dataset.wasRequired === 'true';
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.textContent = t(isRetry ? 'Retry Edir document uploads' : 'Submit Edir registration application');
  const status = $('#edir-registration-upload-status');
  if (progress) {
    const remaining = EDIR_APPLICATION_DOCUMENTS.filter((document) => !uploaded.has(document.type));
    setLocalizedText(status,
      'Application {{id}} is saved. {{uploaded}} of {{total}} required documents uploaded. Select the remaining document files and retry: {{documents}}.',
      {
        id: progress.applicationId,
        uploaded: uploaded.size,
        total: EDIR_APPLICATION_DOCUMENTS.length,
        documents: remaining.map((document) => t(document.label)).join(', ') || t('All required documents uploaded'),
      });
  } else {
    setLocalizedText(status, '');
  }
}

async function submitEdirRegistration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = $('#edir-registration-error');
  const status = $('#edir-registration-upload-status');
  setLocalizedText(error, '');
  $('#edir-registration-success').hidden = true;
  let progress = getEdirApplicationProgress();
  try {
    if (!progress) {
      for (const document of EDIR_APPLICATION_DOCUMENTS) {
        const file = form.querySelector(`[name="${document.type}_file"]`).files[0];
        if (!file) throw new Error(t('Select the required {{document}} file.', { document: t(document.label) }));
        if (file.size > 10 * 1024 * 1024) throw new Error(t('This file exceeds the 10 MB upload limit.'));
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error(t('Choose a PDF, JPEG or PNG document.'));
      }
      const values = formData(form);
      const payload = { ...values, accept_review_terms: values.accept_review_terms === 'on' };
      delete payload.legal_registration_file;
      delete payload.governance_charter_file;
      for (const key of ['registration_reference', 'governance_reference', 'contact_email']) {
        if (!payload[key]) delete payload[key];
      }
      const result = await api('/edir/public/registration-applications', {
        method: 'POST', body: JSON.stringify(payload),
      });
      const applicationId = result?.application_id ?? result?.id;
      if (!applicationId || !result?.upload_token) {
        throw new Error(t('The application response did not include the secure upload details. Contact AfroLife support before submitting again.'));
      }
      progress = {
        applicationId: String(applicationId),
        uploadToken: result.upload_token,
        uploadedDocuments: [],
      };
      sessionStorage.setItem(EDIR_APPLICATION_UPLOAD_KEY, JSON.stringify(progress));
      form.dataset.edirApplicationCreated = 'true';
      syncEdirRegistrationRequirements(progress);
    }

    for (const document of EDIR_APPLICATION_DOCUMENTS) {
      if (progress.uploadedDocuments.includes(document.type)) continue;
      const input = form.querySelector(`[name="${document.type}_file"]`);
      const file = input.files[0];
      if (!file) throw new Error(t('Select the required {{document}} file.', { document: t(document.label) }));
      if (file.size > 10 * 1024 * 1024) throw new Error(t('This file exceeds the 10 MB upload limit.'));
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) throw new Error(t('Choose a PDF, JPEG or PNG document.'));
      const response = await fetch(`${apiRoot()}${edirApplicationDocumentPath(progress.applicationId, document.type)}`, {
        method: 'POST',
        headers: {
          authorization: `Signup ${progress.uploadToken}`,
          ...propertyTenantRequestHeaders(),
          'content-type': file.type,
        },
        body: file,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t(result?.error ?? 'Document upload failed ({{status}})', { status: response.status }));
      progress.uploadedDocuments.push(document.type);
      sessionStorage.setItem(EDIR_APPLICATION_UPLOAD_KEY, JSON.stringify(progress));
      input.value = '';
      syncEdirRegistrationRequirements(progress);
    }

    sessionStorage.removeItem(EDIR_APPLICATION_UPLOAD_KEY);
    delete form.dataset.edirApplicationCreated;
    form.reset();
    syncEdirRegistrationRequirements(null);
    setLocalizedText($('#edir-registration-success'),
      'Application received. AfroLife Master Edir will review it before an organization workspace is activated. Reference: {{id}}',
      { id: progress.applicationId });
    $('#edir-registration-success').hidden = false;
  } catch (reason) {
    if (progress) {
      syncEdirRegistrationRequirements(progress);
      setLocalizedText(error, 'Application {{id}} was saved; {{uploaded}} of {{total}} required documents uploaded. {{error}} Select the remaining file and retry. Your form details and unuploaded file selections are still here.',
        {
          id: progress.applicationId,
          uploaded: progress.uploadedDocuments.length,
          total: EDIR_APPLICATION_DOCUMENTS.length,
          error: reason.message,
        });
    } else {
      setLocalizedText(error, reason.message);
    }
  }
}

function saveNativeServer() {
  const error = $('#server-error');
  setLocalizedText(error, '');
  try {
    const parsed = new URL($('#api-server-url').value.trim());
    const localDevelopmentHost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && localDevelopmentHost))
      || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error(t('Use a valid HTTPS server URL. HTTP is allowed only for localhost development.'));
    }
    localStorage.setItem(API_URL_KEY, parsed.origin);
    apiRoot();
    $('#server-setup').hidden = true;
    if (state.user) {
      const changeButton = $('#change-server');
      if (changeButton) changeButton.textContent = t('Change server');
      showAlert('Server address saved.');
    } else {
      $('#login-form').hidden = false;
      $('#join-edir').hidden = false;
      $('#show-agent-plans').hidden = false;
      $('#login-error').textContent = '';
      void loadPublicSubscriptionCatalog();
    }
  } catch (reason) {
    setLocalizedText(error, reason instanceof TypeError
      ? 'Use a valid HTTPS server URL. HTTP is allowed only for localhost development.'
      : reason.message);
  }
}

function stopSessionActivity() {
  clearTimeout(sessionIdleTimer);
  clearInterval(sessionHeartbeatTimer);
  sessionIdleTimer = null;
  sessionHeartbeatTimer = null;
  if (sessionActivityHandler) {
    for (const eventName of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'focus']) {
      document.removeEventListener(eventName, sessionActivityHandler);
    }
    sessionActivityHandler = null;
  }
}

function scheduleSessionExpiry() {
  clearTimeout(sessionIdleTimer);
  const remaining = sessionIdleTimeoutMs - (Date.now() - lastSessionActivityAt);
  sessionIdleTimer = setTimeout(() => {
    if (Date.now() - lastSessionActivityAt >= sessionIdleTimeoutMs) {
      signOut({ message: 'Your session ended after inactivity. Please sign in again.' });
    } else {
      scheduleSessionExpiry();
    }
  }, Math.max(remaining, 0));
}

function startSessionActivity(idleTimeoutMinutes) {
  stopSessionActivity();
  sessionIdleTimeoutMs = idleTimeoutMinutes * 60 * 1000;
  lastSessionActivityAt = Date.now();
  sessionActivityHandler = (event) => {
    if (!event.isTrusted) return;
    lastSessionActivityAt = Date.now();
    scheduleSessionExpiry();
  };
  for (const eventName of ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'focus']) {
    document.addEventListener(eventName, sessionActivityHandler, { passive: true });
  }
  scheduleSessionExpiry();
  sessionHeartbeatTimer = setInterval(() => {
    if (sessionStorage.getItem(TOKEN_KEY) && Date.now() - lastSessionActivityAt < 60_000) {
      api('/auth/session').catch((error) => {
        if (!(error instanceof ApiError && error.status === 401)) {
          console.error('The active AfroLife session could not be refreshed.', error);
        }
      });
    }
  }, 60_000);
}

function signOut({ revoke = true, message = '' } = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (revoke && token) {
    let endpoint;
    try {
      endpoint = `${apiRoot()}/auth/logout`;
      const headers = new Headers();
      headers.set('authorization', ['Bearer', token].join(' '));
      void fetch(endpoint, { method: 'POST', headers })
        .then((response) => {
          if (!response.ok && response.status !== 401) console.warn('AfroLife could not revoke the signed-out server session.', response.status);
        })
        .catch((error) => console.warn('AfroLife could not reach the server to revoke the signed-out session.', error));
    } catch (error) {
      console.warn('AfroLife could not resolve the server to revoke the signed-out session.', error);
    }
  }
  stopSessionActivity();
  if (assistantHeartbeatTimer) clearInterval(assistantHeartbeatTimer);
  if (assistantRefreshTimer) clearInterval(assistantRefreshTimer);
  assistantHeartbeatTimer = null;
  assistantRefreshTimer = null;
  if ($('#assistant-dialog').open) $('#assistant-dialog').close();
  $('#assistant-launcher').hidden = true;
  state.assistant = { conversations: [], queue: [], selectedId: null, messages: [], available: false, onlineCount: 0 };
  sessionStorage.removeItem(TOKEN_KEY);
  state.user = null;
  state.propertyTenantSupportGrantId = null;
  state.propertyTenantSupportGrants = [];
  state.propertyOperatingTenants = [];
  state.propertyTenantPendingGrants = [];
  localStorage.removeItem(PROPERTY_TENANT_SUPPORT_GRANT_KEY);
  subscriptionState.mine = [];
  subscriptionState.mineLoaded = false;
  subscriptionState.mineError = false;
  subscriptionState.reviews = [];
  subscriptionState.reviewLoaded = false;
  subscriptionState.reviewError = false;
  subscriptionState.requestSubmitted = false;
  subscriptionState.selected.clear();
  state.panel = 'overview';
  workspaceSearchSequence += 1;
  loadedPanels.clear();
  Object.assign(state, {
    leads: [], workers: [], workerDocumentExpiry: [], requests: [], staffingEngagements: [], staffingFinanceEngagements: [], pendingStaffingWork: [], properties: [], propertyAuthorityReviewQueue: [], rentalApplications: [], maintenanceRequests: [], maintenanceVendors: [], maintenanceMetrics: null, maintenanceOverdue: [], maintenanceCostQueue: [], maintenanceInvoiceMismatchQueue: [], maintenanceInvoiceApprovalQueue: [], maintenanceHasMore: false, maintenanceLoadingMore: false, ownerStatements: [], territories: [],
    commissions: [], summary: null, users: [], team: [], globalAdminPromotions: [], businessRules: [], notificationDeliveryStatus: [],
    roleAccess: null, learningContent: [], contracts: [], leases: [], tenants: [], pendingRent: [],
    platformServices: [], platformServicePackages: [], platformTenants: [], platformSuperAdmins: [], platformCatalogProducts: [], platformDataAdmin: null, businessTenants: [],
    marketplaceConfig: {}, marketplaceListings: [], marketplaceSellers: [], insuranceRequests: [],
    insuranceStaffRequests: [], insuranceAgentReferrals: [], insuranceEligibleAgents: [],
    edirMe: null, mfaSetup: null,
    serviceIdentities: [], readinessEvidence: [], propertyAccountingTemplate: null, propertyPeriodClose: null,
    insuranceSandboxStatus: null, insuranceSandboxCases: [],
    serviceStatus: null, serviceMetrics: null, searchResults: [], searchUnavailable: [], searchQuery: '',
    workspaceDataErrors: [], workspaceDataOmitted: [], overviewDataErrors: [], overviewDataOmitted: [], overviewLoadedAt: null,
  });
  state.platformTenantContextId = null;
  state.features = { mfiPilotEnabled: false, edirEnabled: false, accountingEnabled: false, insuranceBrokerageSandboxEnabled: false, enabledModules: [] };
  $('#workspace-search-input').value = '';
  $('#workspace-search-results').replaceChildren();
  $('#workspace-search-results').hidden = true;
  history.replaceState(null, '', panelUrl(window.location.href, 'overview'));
  $('#app-view').hidden = true;
  $('#subscription-home-host').append($('#subscription-catalog'));
  $('#server-setup-home').append($('#server-setup'));
  $('#server-setup').hidden = Boolean(localStorage.getItem(API_URL_KEY));
  $('#mobile-workspace-nav').hidden = true;
  if ($('#workspace-more-dialog').open) $('#workspace-more-dialog').close();
  $('#account-tools').hidden = true;
  $('#access-mode-tools').hidden = true;
  $('#access-mode-choice').hidden = true;
  $('#login-view').hidden = false;
  $('#public-hub').hidden = false;
  renderMySubscriptions();
  $('#login-form').reset();
  $('#login-form').hidden = false;
  state.accessOptions = [];
  $('#mfa-field').hidden = true;
  $('#retry-session').hidden = true;
  $('#login-error').textContent = message;
  showAlert('');
}

function renderPropertyTenantContext() {
  const tenantContextHost = $('#property-tenant-context');
  tenantContextHost.replaceChildren();
  if (!state.propertyTenantMemberships.length && !state.propertyTenantSupportGrants.length) return;
  const tenantPicker = field('Property operating tenant', 'property_tenant_context', 'select', true);
  tenantPicker.input.dataset.propertyTenantContext = 'true';
  tenantPicker.input.append(new Option('Select a tenant', ''));
  for (const tenant of state.propertyTenantMemberships) {
    tenantPicker.input.append(new Option(
      `${tenant.legal_name} · ${tenant.tenant_role.replaceAll('_', ' ')}`,
      tenant.id,
    ));
  }
  for (const grant of state.propertyTenantSupportGrants) {
    tenantPicker.input.append(new Option(
      `${grant.tenant_name} · approved support · ${grant.purpose}`,
      `${grant.tenant_system_id}:${grant.id}`,
    ));
  }
  tenantPicker.input.value = state.propertyTenantSupportGrantId
    ? `${state.propertyTenantContextId}:${state.propertyTenantSupportGrantId}`
    : state.propertyTenantContextId ?? '';
  tenantContextHost.append(tenantPicker.label);
}

async function loadWorkspace() {
  state.user = await api('/auth/me');
  state.accessOptions = Array.isArray(state.user.access_options)
    ? state.user.access_options
    : [state.user.role];
  const accessModeTools = $('#access-mode-tools');
  const accessModeSelect = $('#access-mode-select');
  accessModeSelect.replaceChildren();
  for (const role of state.accessOptions) {
    accessModeSelect.append(new Option(role === 'super_admin' ? 'Super Admin' : 'Global Admin', role));
  }
  accessModeSelect.value = state.user.role;
  accessModeTools.hidden = state.accessOptions.length < 2;
  $('#access-mode-choice').hidden = true;
  startSessionActivity(state.user.session_idle_timeout_minutes ?? 30);
  state.propertyTenantMemberships = await api('/property/tenant-systems/mine');
  state.propertyTenantSupportGrants = state.user.role === 'global_admin'
    ? await api('/property/tenant-support-grants/mine')
    : [];
  const selectedSupportGrant = state.propertyTenantSupportGrants.find((grant) =>
    grant.id === state.propertyTenantSupportGrantId
      && grant.tenant_system_id === state.propertyTenantContextId);
  const selectedMembership = state.propertyTenantMemberships.some((tenant) =>
    tenant.id === state.propertyTenantContextId && tenant.status === 'active');
  if (selectedSupportGrant) {
    state.propertyTenantContextId = selectedSupportGrant.tenant_system_id;
  } else if (selectedMembership) {
    state.propertyTenantSupportGrantId = null;
    localStorage.removeItem(PROPERTY_TENANT_SUPPORT_GRANT_KEY);
  } else {
    state.propertyTenantSupportGrantId = null;
    localStorage.removeItem(PROPERTY_TENANT_SUPPORT_GRANT_KEY);
    state.propertyTenantContextId = state.propertyTenantMemberships.length === 1
      ? state.propertyTenantMemberships[0].id
      : null;
  }
  if (state.propertyTenantContextId) {
    localStorage.setItem(PROPERTY_TENANT_KEY, state.propertyTenantContextId);
  } else {
    localStorage.removeItem(PROPERTY_TENANT_KEY);
  }
  renderPropertyTenantContext();
  const featureFallback = { mfiPilotEnabled: false, edirEnabled: false, accountingEnabled: false, globalBiEnabled: false, insuranceBrokerageSandboxEnabled: false, enabledModules: [] };
  const passwordRequired = state.user.must_change_password || state.user.required_security_step === 'password';
  state.mfaRequired = state.mfaRequired || state.user.required_security_step === 'mfa';
  if (passwordRequired || state.mfaRequired) {
    state.panel = passwordRequired ? 'password' : 'security';
    history.replaceState(null, '', panelUrl(window.location.href, state.panel));
    state.features = { ...featureFallback, allowedModules: [] };
    state.myDataCapabilities = [];
    $('#login-view').hidden = true;
    $('#public-hub').hidden = true;
    $('#app-view').hidden = false;
    $('#assistant-launcher').hidden = true;
    $('#mobile-workspace-nav').hidden = true;
    $('#account-tools').hidden = true;
    $('#account-name').textContent = `${state.user.legal_name} · ${roleLabel(state.user.role)}`;
    $('#page-subtitle').textContent = t('Signed in as {{role}}. Your access is limited to your assigned role and territory.', { role: roleLabel(state.user.role) });
    $('#login-error').textContent = '';
    $('#retry-session').hidden = true;
    document.querySelectorAll('.tab, .workspace-nav-group').forEach((element) => { element.hidden = true; });
    renderPanel();
    return;
  }
  const selfCapabilities = await getOptional('/platform/my-data-capabilities', []);
  state.myDataCapabilities = Array.isArray(selfCapabilities) ? selfCapabilities : [];
  const assignedDataTenantIds = state.myDataCapabilities.map((entry) => entry.tenant_id);
  if (!assignedDataTenantIds.includes(state.dataAdminTenantId)) {
    state.dataAdminTenantId = assignedDataTenantIds.length === 1 ? assignedDataTenantIds[0] : null;
  }
  if (state.user.role === 'super_admin') {
    state.tenantAdminTenants = await api('/platform/my-tenants');
    const activeTenantIds = state.tenantAdminTenants
      .filter((tenant) => tenant.status === 'active')
      .map((tenant) => tenant.id);
    if (!activeTenantIds.includes(state.platformTenantContextId)) {
      state.platformTenantContextId = activeTenantIds.length === 1 ? activeTenantIds[0] : null;
    }
  }
  const featurePath = state.platformTenantContextId
    ? `/features?platform_tenant_id=${encodeURIComponent(state.platformTenantContextId)}`
    : '/features';
  if (state.platformTenantContextId) {
    try {
      state.features = await api(featurePath);
    } catch {
      state.features = {
        ...featureFallback,
        enabledModules: [],
        allowedModules: [],
        platformTenantId: state.platformTenantContextId,
      };
    }
  } else {
    state.features = await getOptional('/features', featureFallback);
  }
  state.edirMe = null;
  $('#login-view').hidden = true;
  $('#public-hub').hidden = true;
  $('#app-view').hidden = false;
  $('#assistant-launcher').hidden = false;
  $('#mobile-workspace-nav').hidden = false;
  $('#account-tools').hidden = false;
  $('#login-error').textContent = '';
  $('#retry-session').hidden = true;
  $('#account-name').textContent = `${state.user.legal_name} · ${roleLabel(state.user.role)}`;
  const workerTab = document.querySelector('.tab[data-panel="workers"]');
  if (workerTab) setLocalizedText(workerTab, state.user.role === 'worker' ? 'Worker portal' : 'Workers');
  const propertyTab = document.querySelector('.tab[data-panel="properties"]');
  if (propertyTab) setLocalizedText(propertyTab, state.user.role === 'property_owner'
    ? 'Landlord portal' : state.user.role === 'property_vendor' ? 'Vendor maintenance' : 'Properties');
  const workersTab = document.querySelector('.tab[data-panel="workers"]');
  if (workersTab) setLocalizedText(workersTab, state.user.role === 'worker' ? 'Worker portal' : 'Workers');
  $('#page-subtitle').textContent = t('Signed in as {{role}}. Your access is limited to your assigned role and territory.', { role: roleLabel(state.user.role) });
  void loadMySubscriptions();
  if (['finance', 'finance_manager', 'global_admin', 'super_admin'].includes(state.user.role)) {
    void loadSubscriptionReview();
  }
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.hidden = false;
  });
  $('#admin-tab').hidden = !['global_admin', 'super_admin', 'compliance', 'corporate_business_manager'].includes(state.user.role);
  $('#learning-tab').hidden = !hasActivity('learning.content.view') && !hasActivity('learning.content.manage');
  const canUseListings = state.user.role === 'property_vendor' || hasActivity('property.listings.view');
  $('#properties-tab').hidden = !canUseListings;
  $('#marketplace-tab').hidden = false;
  if (!canUseListings && state.panel === 'properties') state.panel = 'overview';
  $('#contracts-tab').hidden = ['customer', 'worker', 'property_owner'].includes(state.user.role);
  const canUseCommissions = ['global_admin','super_admin','finance','finance_manager','master_agent','field_agent'].includes(state.user.role);
  $('#commissions-tab').hidden = !canUseCommissions;
  if (!canUseCommissions && state.panel === 'commissions') state.panel = 'overview';
  $('#agents-tab').hidden = !['global_admin', 'super_admin', 'master_agent'].includes(state.user.role);
  $('#rent-tab').hidden = !['property.tenancy.manage', 'rent.payments.submit', 'rent.transactions.view', 'rent.transactions.reconcile', 'rent.transactions.void', 'rent.deposit.refund_request'].some(hasActivity);
  $('#mfi-tab').hidden = !state.features.mfiPilotEnabled;
  const accountingRole = ['global_admin','super_admin','finance','finance_manager','compliance','corporate_business_manager','property_owner','customer'].includes(state.user.role);
  const accountingAllowed = accountingRole && state.features.accountingEnabled
    && (!Array.isArray(state.features.allowedModules) || state.features.allowedModules.includes('accounting'));
  $('#accounting-tab').hidden = !accountingAllowed;
  $('#global-bi-tab').hidden = state.features.globalBiEnabled !== true;
  $('#tenant-data-admin-tab').hidden = state.myDataCapabilities.length === 0;
  $('#edir-tab').hidden = !state.features.edirEnabled;
  if ($('#mfi-tab').hidden && state.panel === 'mfi') state.panel = 'overview';
  if ($('#accounting-tab').hidden && state.panel === 'accounting') state.panel = 'overview';
  if ($('#edir-tab').hidden && state.panel === 'edir') state.panel = 'overview';
  const sharedPanels = ['overview', 'subscriptions', 'marketplace', 'edir', 'insurance', 'mfi', 'security', 'privacy'];
  document.querySelectorAll('.tab').forEach((tab) => {
    if (['property_owner', 'customer'].includes(state.user.role)) {
      const allowed = new Set([...sharedPanels, ...(canUseListings ? ['properties'] : [])]);
      if (hasActivity('learning.content.view') || hasActivity('learning.content.manage')) allowed.add('learning');
      if (hasActivity('workforce.workers.view') || hasActivity('workforce.workers.register')) allowed.add('workers');
      if (hasActivity('staffing.requests.manage')) allowed.add('requests');
      if (['rent.payments.submit', 'rent.transactions.view', 'rent.transactions.reconcile', 'rent.transactions.void', 'rent.deposit.refund_request'].some(hasActivity)) allowed.add('rent');
      if (accountingAllowed) allowed.add('accounting');
      tab.hidden = !allowed.has(tab.dataset.panel);
    } else if (['worker', 'corporate_business_manager', 'master_agent', 'field_agent'].includes(state.user.role)) {
      const allowed = new Set([
        ...sharedPanels,
        ...(state.user.role === 'corporate_business_manager' ? ['admin'] : []),
        'leads', 'contracts', 'commissions', 'agents',
      ]);
      if (['worker','corporate_business_manager'].includes(state.user.role)
          || hasActivity('workforce.workers.view') || hasActivity('workforce.workers.register')) allowed.add('workers');
      if (accountingAllowed) allowed.add('accounting');
      if (hasActivity('staffing.requests.manage')) allowed.add('requests');
      if (canUseListings) allowed.add('properties');
      if (hasActivity('learning.content.view') || hasActivity('learning.content.manage')) allowed.add('learning');
      if (['rent.payments.submit', 'rent.transactions.view', 'rent.transactions.reconcile', 'rent.transactions.void', 'rent.deposit.refund_request'].some(hasActivity)) allowed.add('rent');
      tab.hidden = !allowed.has(tab.dataset.panel);
    }
  });
  $('#tenant-data-admin-tab').hidden = state.myDataCapabilities.length === 0;
  for (const [panel, enabled] of [
    ['workers', state.user.role === 'worker' || hasActivity('workforce.workers.view') || hasActivity('workforce.workers.register')],
    ['requests', hasActivity('staffing.requests.manage')],
    ['properties', canUseListings],
    ['learning', hasActivity('learning.content.view') || hasActivity('learning.content.manage')],
  ]) {
    if (enabled) {
      const tab = document.querySelector(`.tab[data-panel="${panel}"]`);
      if (tab) tab.hidden = false;
    }
  }
  const enabledModules = Array.isArray(state.features.enabledModules)
      && (state.features.platformTenantId || state.user.role === 'super_admin' || state.features.enabledModules.length)
    ? state.features.enabledModules
    : [...KNOWN_PANELS];
  for (const tab of document.querySelectorAll('.tab[data-panel]')) {
    if (miniAppLogo(tab.dataset.panel)) tab.hidden = false;
    if (!isPanelEnabled(tab.dataset.panel, enabledModules)) tab.hidden = true;
    if (MINI_APP_PANELS.has(tab.dataset.panel)
        && Array.isArray(state.features.allowedModules)
        && !isMiniAppAllowed(tab.dataset.panel, state.features.allowedModules)) tab.hidden = true;
  }
  $('#status-tab').hidden = false;
  accessVisiblePanels = new Set(
    [...document.querySelectorAll('.tab[data-panel]:not([hidden])')]
      .map((tab) => tab.dataset.panel),
  );
  if (state.panel === 'password' || state.mfaRequired) {
    state.panel = state.user.must_change_password ? 'password' : 'security';
    history.replaceState(null, '', panelUrl(window.location.href, state.panel));
  } else if (state.panel !== 'launcher'
      && document.querySelector(`.tab[data-panel="${CSS.escape(state.panel)}"]`)?.hidden) {
    state.panel = 'overview';
    history.replaceState(null, '', panelUrl(window.location.href, state.panel));
  }
  configureWorkspaceNavigation();
  updateWorkspaceNavigationGroups();
  renderMobileWorkspaceNav();
  if (state.user.must_change_password) {
    state.panel = 'password';
    history.replaceState(null, '', panelUrl(window.location.href, state.panel));
    renderPanel();
    return;
  }
  if (state.mfaRequired) {
    state.panel = 'security';
    renderPanel();
    return;
  }
  renderPanel();
  await refresh();
}

async function getOptional(path, fallback) {
  try {
    return await api(path);
  } catch (error) {
    return optionalApiFallback(error, fallback);
  }
}

async function loadPanelData(panel) {
  state.workspaceDataErrors = [];
  state.workspaceDataOmitted = [];
  const safeGet = async (path, fallback) => {
    try {
      return await api(path);
    } catch (error) {
      if (error instanceof ApiError && [403, 404].includes(error.status)) {
        state.workspaceDataOmitted.push(path);
        return fallback;
      }
      console.error(`Workspace panel ${panel} could not load ${path}.`, error);
      state.workspaceDataErrors.push(path);
      return fallback;
    }
  };
  const load = async (key, path, fallback = []) => { state[key] = await safeGet(path, fallback); };
  switch (panel) {
    case 'overview':
      [state.leads, state.workers, state.requests, state.commissions] = await Promise.all([
        safeGet('/leads', []), safeGet('/workers', []), safeGet('/requests', []), safeGet('/commissions', []),
      ]);
      state.staffingEngagements = ['customer','worker'].includes(state.user.role)
        ? await safeGet('/staffing-engagements/mine', []) : [];
      if (state.user.role === 'worker') {
        [state.workerPortalReports, state.workerPortalSettlements, state.workerPortalShifts, state.workerPortalLeave,
          state.workerPortalPayrollExports] = await Promise.all([
          safeGet('/staffing-work-periods/mine', []),
          safeGet('/staffing-settlements/mine', []),
          safeGet('/workforce/shifts/mine', []),
          safeGet('/workforce/leave/mine', []),
          safeGet('/workforce/payroll-exports/mine', []),
        ]);
        state.workerPortalEngagements = state.staffingEngagements;
        await syncWorkerClockQueue();
      }
      if (state.user.role === 'property_owner') {
        [state.properties, state.ownerStatements, state.maintenanceRequests] = await Promise.all([
          safeGet('/properties', []),
          safeGet('/owner/statements', { statements: [] }).then((result) => result.statements ?? []),
          safeGet('/maintenance?offset=0', []),
        ]);
      }
      state.summary = STAFF.has(state.user.role) && state.user.role !== 'compliance'
        ? await safeGet('/reports/summary', null)
        : state.user.enterprise_features_enabled ? await safeGet('/reports/me', null) : null;
      if (['finance_manager','super_admin','global_admin'].includes(state.user.role)) {
        [state.staffingFinanceEngagements, state.pendingStaffingWork] = await Promise.all([
          safeGet('/staffing-engagements', []), safeGet('/staffing-work-periods/pending', []),
        ]);
      }
      break;
    case 'leads':
      await load('leads', '/leads');
      state.team = ['global_admin', 'super_admin', 'master_agent'].includes(state.user.role)
        ? await safeGet('/agents/team', []) : [];
      break;
    case 'workers':
      if (state.user.role === 'worker') {
        [state.workerPortalEngagements, state.workerPortalReports, state.workerPortalSettlements, state.workerSupportRequests,
          state.workerPortalShifts, state.workerPortalLeave, state.workerPortalPayrollExports] = await Promise.all([
          safeGet('/staffing-engagements/mine', []),
          safeGet('/staffing-work-periods/mine', []),
          safeGet('/staffing-settlements/mine', []),
          safeGet('/worker-support/mine', []),
          safeGet('/workforce/shifts/mine', []),
          safeGet('/workforce/leave/mine', []),
          safeGet('/workforce/payroll-exports/mine', []),
        ]);
        await syncWorkerClockQueue();
        break;
      }
      [state.workers, state.territories, state.workerDocumentExpiry] = await Promise.all([
        safeGet('/workers', []), safeGet('/territories', []),
        hasActivity('workforce.documents.view') ? safeGet('/documents/expiry?within_days=30', []) : Promise.resolve([]),
      ]);
      state.workerSupportQueue = ['global_admin','super_admin','corporate_business_manager','master_agent'].includes(state.user.role)
        ? await safeGet('/worker-support/queue', []) : [];
      state.workforceEngagements = hasActivity('workforce.shifts.manage')
        ? await safeGet('/workforce/engagements', []) : [];
      state.workforceShifts = hasActivity('workforce.shifts.manage')
        ? await safeGet('/workforce/shifts', []) : [];
      state.workforceTimeQueue = hasActivity('workforce.time.review')
        ? await safeGet('/workforce/time-review-queue', []) : [];
      state.workforceLeaveQueue = hasActivity('workforce.leave.review')
        ? await safeGet('/workforce/leave/queue', []) : [];
      state.workforcePolicies = hasActivity('workforce.policy.manage')
        ? await safeGet('/workforce/policies', []) : [];
      state.workforcePayrollExports = hasActivity('workforce.payroll.export')
        ? await safeGet('/workforce/payroll-exports', []) : [];
      break;
    case 'requests':
      [state.requests, state.leads, state.territories] = await Promise.all([
        safeGet('/requests', []), safeGet('/leads', []), safeGet('/territories', []),
      ]);
      break;
    case 'learning':
      state.learningContent = hasActivity('learning.content.view') || hasActivity('learning.content.manage')
        ? await safeGet('/learning/content', []) : [];
      break;
    case 'properties':
      if (state.user.role === 'property_vendor') {
        state.maintenanceRequests = await safeGet('/maintenance/vendor/assigned', []);
        break;
      }
      state.maintenanceVendors = ['corporate_business_manager','super_admin','global_admin'].includes(state.user.role)
        && hasActivity('property.maintenance.manage')
        ? await safeGet('/maintenance/vendors', []) : [];
      [state.marketplaceConfig, state.territories] = await Promise.all([
        safeGet('/marketplace/config', {}), safeGet('/territories', []),
      ]);
      state.marketplaceSellers = ['global_admin', 'super_admin', 'corporate_business_manager'].includes(state.user.role)
        ? await safeGet('/marketplace/sellers', []) : [];
      if (hasActivity('property.listings.view')) state.properties = await safeGet('/properties', []);
      const activePropertyTenant = state.propertyTenantContextId;
      const propertyTenantMembership = state.propertyTenantMemberships.find((tenant) =>
        tenant.id === activePropertyTenant && tenant.status === 'active');
      if (activePropertyTenant && !state.propertyTenantSupportGrantId) {
        state.propertyAgentScopes = await safeGet(
          `/property/tenant-systems/${encodeURIComponent(activePropertyTenant)}/agent-scopes`, [],
        );
        if (propertyTenantMembership?.tenant_role === 'tenant_admin') {
          state.propertyTenantAgentCandidates = await safeGet(
            `/property/tenant-systems/${encodeURIComponent(activePropertyTenant)}/agent-candidates`, [],
          );
        } else if (propertyTenantMembership?.tenant_role === 'master_agent') {
          const today = new Date().toISOString().slice(0, 10);
          const managedPropertyIds = [...new Set(state.propertyAgentScopes
            .filter((scope) => scope.user_id === state.user.id && scope.tenant_role === 'master_agent'
              && scope.status === 'active' && scope.effective_from <= today
              && (!scope.effective_to || scope.effective_to >= today))
            .map((scope) => scope.property_id))];
          const candidatesByProperty = await Promise.all(managedPropertyIds.map(async (propertyId) => {
            const candidates = await safeGet(
              `/property/tenant-systems/${encodeURIComponent(activePropertyTenant)}/agent-candidates?property_id=${encodeURIComponent(propertyId)}`,
              [],
            );
            return candidates.map((candidate) => ({ ...candidate, property_id: propertyId }));
          }));
          state.propertyTenantAgentCandidates = candidatesByProperty.flat();
        } else {
          state.propertyTenantAgentCandidates = [];
        }
      } else {
        state.propertyAgentScopes = [];
        state.propertyTenantAgentCandidates = [];
      }
      state.propertyAuthorityReviewQueue = ['global_admin','super_admin','corporate_business_manager'].includes(state.user.role)
        ? await safeGet('/properties/authority-review', []) : [];
      if (hasActivity('property.maintenance.manage')) {
        const [firstPage, metrics] = await Promise.all([
          safeGet('/maintenance?offset=0', []), safeGet('/maintenance/metrics', null),
        ]);
        state.maintenanceHasMore = firstPage.length > 200;
        state.maintenanceRequests = firstPage.slice(0, 200);
        state.maintenanceMetrics = metrics;
      }
      state.maintenanceOverdue = ['corporate_business_manager','super_admin','global_admin'].includes(state.user.role)
        ? await safeGet('/maintenance/sla/overdue', []) : [];
      state.ownerStatements = state.user.role === 'property_owner'
        ? (await safeGet('/owner/statements', { statements: [] })).statements ?? [] : [];
      state.rentalApplications = state.user.role === 'customer'
        ? await safeGet('/marketplace/rental-applications/mine', [])
        : hasActivity('property.listings.manage')
          ? await safeGet('/marketplace/rental-applications', []) : [];
      state.residentPropertyWorkspace = state.user.role === 'customer'
        ? await safeGet('/resident/property-workspace', { leases: [], charges: [], payments: [], maintenance: [] })
        : { leases: [], charges: [], payments: [], maintenance: [] };
      break;
    case 'marketplace':
      [state.marketplaceConfig, state.marketplaceListings, state.territories, state.properties] = await Promise.all([
        safeGet('/marketplace/config', {}), safeGet('/marketplace/listings', []), safeGet('/territories', []),
        hasActivity('property.listings.view') ? safeGet('/properties', []) : [],
      ]);
      state.marketplaceSellers = ['global_admin', 'super_admin', 'corporate_business_manager'].includes(state.user.role)
        ? await safeGet('/marketplace/sellers', []) : [];
      break;
    case 'contracts':
      [state.leads, state.contracts] = await Promise.all([safeGet('/leads', []), safeGet('/contracts', [])]);
      break;
    case 'commissions':
      await load('commissions', '/commissions');
      break;
    case 'agents':
      [state.team, state.agentBusinessTenants] = await Promise.all([
        safeGet('/agents/team', []), safeGet('/platform/my-business-tenant', []),
      ]);
      break;
    case 'rent':
      [state.propertyAccountingTemplate, state.properties, state.tenants, state.pendingRent, state.leases] = await Promise.all([
        ['global_admin', 'super_admin', 'finance', 'finance_manager'].includes(state.user.role)
          ? safeGet('/finance/property-chart-of-accounts-template', null) : null,
        hasActivity('property.listings.view') ? safeGet('/properties', []) : [],
        safeGet('/tenants', []), safeGet('/rent-transactions/pending', []), safeGet('/leases', []),
      ]);
      if (['global_admin','super_admin','finance_manager'].includes(state.user.role)) {
        [state.maintenanceCostQueue, state.maintenanceInvoiceMismatchQueue, state.maintenanceInvoiceApprovalQueue] = await Promise.all([
          safeGet('/maintenance/vendor/additional-cost/pending', []),
          safeGet('/maintenance/vendor/invoices/mismatches', []),
          safeGet('/property-vendor-bills/pending', []),
        ]);
      }
      break;
    case 'insurance':
      [state.insuranceRequests, state.insuranceStaffRequests, state.insuranceAgentReferrals, state.insuranceEligibleAgents] = await Promise.all([
        safeGet('/insurance/requests/me', []), safeGet('/insurance/requests', []),
        safeGet('/insurance/requests/agent-referrals/me', []), safeGet('/insurance/requests/agent-referrals/agents', []),
      ]);
      if (state.features.insuranceBrokerageSandboxEnabled) {
        [state.insuranceSandboxStatus, state.insuranceSandboxCases] = await Promise.all([
          safeGet('/insurance/brokerage-sandbox/status', null), safeGet('/insurance/brokerage-sandbox/cases/mine', []),
        ]);
      } else {
        state.insuranceSandboxStatus = null;
        state.insuranceSandboxCases = [];
      }
      break;
    case 'edir':
      state.edirMe = state.features.edirEnabled && state.user.kyc_status === 'verified'
        ? await safeGet('/edir/me', null) : null;
      break;
    case 'tenant-data-admin': {
      const assigned = state.myDataCapabilities.find((entry) => entry.tenant_id === state.dataAdminTenantId);
      state.tenantDataWorkspace = assigned
        ? await safeGet(`/platform/my-data/${encodeURIComponent(assigned.tenant_id)}/workspace`, null)
        : null;
      state.tenantAnalyticsStatus = assigned?.capabilities?.includes('analytics_admin')
        ? await safeGet(`/platform/my-data/${encodeURIComponent(assigned.tenant_id)}/analytics`, null)
        : null;
      break;
    }
    case 'admin':
      state.users = ['global_admin', 'compliance','corporate_business_manager','super_admin'].includes(state.user.role)
        ? await safeGet('/users', []) : [];
      state.maintenanceVendors = state.user.role === 'global_admin'
        ? await safeGet('/maintenance/vendors', []) : [];
      [state.territories, state.serviceIdentities, state.readinessEvidence, state.globalAdminPromotions] = await Promise.all([
        safeGet('/territories', []),
        state.user.role === 'global_admin' ? safeGet('/service-identities', []) : [],
        state.user.role === 'global_admin' ? safeGet('/readiness-evidence', []) : [],
        state.user.role === 'super_admin' ? safeGet('/global-admin-promotions', []) : [],
      ]);
      state.businessRules = state.user.role === 'global_admin' ? await safeGet('/business-rules', []) : [];
      state.roleAccess = state.user.role === 'global_admin' ? await safeGet('/role-access', null) : null;
      state.notificationDeliveryStatus = state.user.role === 'global_admin'
        ? await safeGet('/notifications/delivery-status', []) : [];
      state.summary = ['global_admin', 'finance', 'finance_manager'].includes(state.user.role)
        ? await safeGet('/reports/summary', null) : null;
      if (['global_admin', 'super_admin', 'finance', 'finance_manager'].includes(state.user.role)) {
        state.propertyAccountingTemplate = await safeGet('/finance/property-chart-of-accounts-template', null);
      }
      if (state.user.role === 'global_admin') {
        [state.platformServices, state.platformServicePackages, state.platformTenants, state.platformSuperAdmins, state.platformCatalogProducts] = await Promise.all([
          safeGet('/platform/services', []), safeGet('/platform/service-packages', []),
          safeGet('/platform/tenants', []), safeGet('/platform/super-admins', []),
          safeGet('/platform/catalog-products', []),
        ]);
        [state.propertyOperatingTenants, state.propertyTenantPendingGrants] = await Promise.all([
          safeGet('/property/tenant-systems', []),
          safeGet('/property/tenant-support-grants/pending', []),
        ]);
        state.platformDataAdmin = await safeGet('/platform/tenant-capabilities', null);
        state.businessTenants = await safeGet('/platform/business-tenants', []);
      }
      break;
    case 'status':
      state.serviceStatus = await safeGet('/system/status', null);
      state.serviceMetrics = state.user.role === 'global_admin'
        ? await safeGet('/system/metrics', { routes: [] }) : null;
      break;
    case 'support':
      [state.supportCases,state.supportAgents] = await Promise.all([
        safeGet('/support/cases/mine',[]),safeGet('/support/agents',[]),
      ]);
      if (['global_admin','super_admin','compliance','corporate_business_manager'].includes(state.user.role)) {
        state.supportQueue = await safeGet('/support/cases/queue',[]);
      } else state.supportQueue = [];
      state.supportAppealQueue = ['global_admin','super_admin','compliance'].includes(state.user.role)
        ? await safeGet('/support/cases/appeals/queue',[]) : [];
      state.supportAccessRequests = ['global_admin','super_admin','compliance'].includes(state.user.role)
        ? await safeGet('/support/access-requests',[]) : [];
      break;
    case 'security':
      await load('authSessions', '/auth/sessions');
      break;
    default:
      break;
  }
  if (panel === 'overview') {
    state.overviewDataErrors = [...state.workspaceDataErrors];
    state.overviewDataOmitted = [...state.workspaceDataOmitted];
    state.overviewLoadedAt = Date.now();
  }
  loadedPanels.add(panel);
}

async function refresh(force = true) {
  showAlert('');
  try {
    if (force) loadedPanels.delete(state.panel);
    const panel = state.panel;
    for (const url of propertyPhotoUrls) URL.revokeObjectURL(url);
    propertyPhotoUrls.clear();
    if (!loadedPanels.has(panel)) await loadPanelData(panel);
    if (panel !== state.panel) return;
    if (state.panel === 'password') state.panel = 'overview';
    if (state.workspaceDataErrors.length && panel !== 'overview') {
      showAlert('Some workspace information could not be loaded. Select Refresh to retry: {{items}}', true, {
        items: state.workspaceDataErrors.join(', '),
      });
    }
    renderStats();
    renderPanel();
  } catch (error) {
    showAlert(error.message, true);
  }
}

function visiblePanelNames() {
  return new Set([...document.querySelectorAll('.tab[data-panel]:not([hidden])')].map((tab) => tab.dataset.panel));
}

function panelLabel(panel) {
  return document.querySelector(`.tab[data-panel="${CSS.escape(panel)}"]`)?.textContent.trim() ?? panel;
}

function workspaceRecords(panel, rows) {
  const descriptors = {
    leads: { type: 'Lead', title: (r) => r.name, subtitle: (r) => [r.phone, r.status].filter(Boolean).join(' · '), searchable: (r) => [r.name], phones: (r) => [r.phone] },
    workers: { type: 'Worker', title: (r) => r.name, subtitle: (r) => [r.sector, r.verification].filter(Boolean).join(' · '), searchable: (r) => [r.name, r.sector], phones: (r) => [r.phone] },
    requests: { type: 'Request', title: (r) => r.sector ?? r.title ?? `Request ${String(r.id ?? '').slice(0, 8)}`, subtitle: (r) => [r.status, r.territory_name].filter(Boolean).join(' · '), searchable: (r) => [r.sector, r.title, r.status], phones: () => [] },
    properties: { type: 'Property', title: (r) => r.address, subtitle: (r) => [r.ptype, r.status].filter(Boolean).join(' · '), searchable: (r) => [r.address, r.ptype], phones: () => [] },
    marketplace: { type: 'Listing', title: (r) => r.title, subtitle: (r) => [r.kind, r.status].filter(Boolean).join(' · '), searchable: (r) => [r.title, r.kind, r.description], phones: () => [] },
    contracts: { type: 'Contract', title: (r) => r.contract_no, subtitle: (r) => r.state ?? r.status ?? '', searchable: (r) => [r.contract_no], phones: () => [] },
    commissions: { type: 'Commission', title: (r) => `Commission ${String(r.id ?? '').slice(0, 8)}`, subtitle: (r) => [r.status, r.amount ? `ETB ${r.amount}` : ''].filter(Boolean).join(' · '), searchable: (r) => [r.id, r.status], phones: () => [] },
    rent: { type: 'Tenant', title: (r) => r.name, subtitle: (r) => r.phone ?? '', searchable: (r) => [r.name], phones: (r) => [r.phone] },
    admin: { type: 'Person', title: (r) => r.legal_name, subtitle: (r) => [r.role, r.phone].filter(Boolean).join(' · '), searchable: (r) => [r.legal_name], phones: (r) => [r.phone] },
  };
  const descriptor = descriptors[panel];
  return descriptor && Array.isArray(rows) ? rows.map((row) => ({
    panel,
    type: descriptor.type,
    id: row.id,
    title: String(descriptor.title(row) ?? ''),
    subtitle: String(descriptor.subtitle(row) ?? ''),
    searchable: descriptor.searchable(row),
    phones: descriptor.phones(row),
  })).filter((record) => record.title) : [];
}

async function searchWorkspace(query) {
  const sequence = ++workspaceSearchSequence;
  const term = String(query ?? '').trim();
  const resultBox = $('#workspace-search-results');
  resultBox.hidden = false;
  resultBox.replaceChildren();
  if (term.length < MIN_SEARCH_QUERY_LENGTH) {
    resultBox.append(node('p', t('Enter at least {{count}} characters to search.', { count: MIN_SEARCH_QUERY_LENGTH })));
    return;
  }

  const resources = [
    ['leads', '/leads'], ['workers', '/workers'], ['requests', '/requests'],
    ['properties', '/properties'], ['marketplace', '/marketplace/listings'],
    ['contracts', '/contracts'], ['commissions', '/commissions'], ['rent', '/tenants'],
    ...(visiblePanelNames().has('admin') && ['global_admin', 'super_admin', 'compliance'].includes(state.user.role)
      ? [['admin', '/users']] : []),
  ].filter(([panel]) => visiblePanelNames().has(panel));
  const unavailable = [];
  const batches = await Promise.all(resources.map(async ([panel, path]) => {
    try {
      const records = await api(path);
      return workspaceRecords(panel, records);
    } catch (error) {
      console.error(`Workspace search could not query ${panelLabel(panel)}.`, error);
      unavailable.push(panel);
      return [];
    }
  }));
  if (sequence !== workspaceSearchSequence) return;
  state.searchQuery = term;
  state.searchUnavailable = unavailable;
  state.searchResults = searchWorkspaceRecords(term, batches.flat());
  renderWorkspaceSearchResults();
}

function renderWorkspaceSearchResults() {
  const resultBox = $('#workspace-search-results');
  resultBox.replaceChildren();
  const summary = state.searchUnavailable.length
    ? t('Some areas could not be searched. Results may be partial.')
    : t('{{count}} matching result(s).', { count: state.searchResults.length });
  resultBox.append(node('p', summary));
  if (!state.searchResults.length && !state.searchUnavailable.length) {
    resultBox.append(node('p', 'No matching records were found in the areas available to your role.'));
  }
  for (const record of state.searchResults) {
    const row = node('article', undefined, 'workspace-search-result');
    const copy = node('div');
    copy.append(node('h3', record.title), node('p', `${record.type} · ${panelLabel(record.panel)}${record.subtitle ? ` · ${record.subtitle}` : ''}`));
    row.append(copy, button('Open area', 'open-panel', 'button button-outline', { panel: record.panel }));
    resultBox.append(row);
  }
}

function renderStats() {
  const grid = $('#stat-grid');
  grid.replaceChildren();
  const role = state.user.role;
  if (role === 'property_owner' || ['master_agent', 'field_agent'].includes(role)
      || (state.user.enterprise_features_enabled && state.summary)) return;

  const unavailable = (path) => state.overviewDataErrors.includes(path) || state.overviewDataOmitted.includes(path);
  const total = (rows) => Array.isArray(rows)
    ? rows.reduce((sum, row) => sum + Number(row?.n ?? 0), 0)
    : null;
  const currency = (value) => Number(value).toLocaleString(document.documentElement.lang, {
    style: 'currency', currency: 'ETB', maximumFractionDigits: 2,
  });
  let values = [];
  let caption = 'Figures are based on records currently available to your account.';

  if (role === 'worker') {
    const approvedWork = state.workerPortalReports
      .filter((report) => report.status === 'approved')
      .reduce((sum, report) => sum + Number(report.worker_amount ?? 0), 0);
    values = [
      ['Active assignments', state.workerPortalEngagements.filter((item) => item.status === 'active').length, '/staffing-engagements/mine'],
      ['Assigned shifts', state.workerPortalShifts.length, '/workforce/shifts/mine'],
      ['Reports awaiting review', state.workerPortalReports.filter((item) => item.status === 'submitted').length, '/staffing-work-periods/mine'],
      ['Approved work value · ETB', currency(approvedWork), '/staffing-work-periods/mine'],
      ['Leave / availability requests in review', state.workerPortalLeave.filter((item) => item.status === 'submitted').length, '/workforce/leave/mine'],
      ['Payroll handoffs', state.workerPortalPayrollExports.length, '/workforce/payroll-exports/mine'],
    ];
    if (!unavailable('/staffing-settlements/mine')) {
      const reconciledPayments = state.workerPortalSettlements
        .filter((item) => item.status === 'reconciled')
        .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      values.push(['Reconciled payments · ETB', currency(reconciledPayments), '/staffing-settlements/mine']);
    }
    caption = 'Your work, review, and payment records only. Approved work value is not the same as a reconciled payment.';
  } else if (STAFF.has(role) && role !== 'compliance' && state.summary) {
    const workerCount = total(state.summary.workers);
    const contractCount = Array.isArray(state.summary.contracts)
      ? state.summary.contracts.filter((item) => item.state === 'active').reduce((sum, item) => sum + Number(item.n ?? 0), 0)
      : null;
    values = [
      ['Lead records', total(state.summary.leads), '/reports/summary'],
      ['Worker records', workerCount, '/reports/summary'],
      ['Active contracts', contractCount, '/reports/summary'],
      ['Open disputes', state.summary.open_disputes ?? null, '/reports/summary'],
      ['Open maintenance', state.summary.open_maintenance ?? null, '/reports/summary'],
      ['Pending invoices · ETB', state.summary.pending_invoices
        ? `${Number(state.summary.pending_invoices.n ?? 0).toLocaleString(document.documentElement.lang)} · ${currency(state.summary.pending_invoices.amount ?? 0)}`
        : null, '/reports/summary'],
      ['Net revenue · ETB', Number.isFinite(Number(state.summary.money?.net_revenue))
        ? currency(state.summary.money.net_revenue) : null, '/reports/summary'],
    ];
    caption = 'Operational report for your current tenant and role scope. Finance values are ledger-derived.';
  } else {
    values = [
      ['Open requests in your view', state.requests.filter((item) => item.status === 'open').length, '/requests'],
      ['Worker records in your view', state.workers.length, '/workers'],
      ['Lead records in your view', state.leads.length, '/leads'],
      ['Commission events in your view', state.commissions.length, '/commissions'],
    ];
    caption = 'Counts reflect only the records returned for your account and current role permissions.';
  }

  const metrics = values.filter(([, , path]) => !unavailable(path));
  const section = node('section', undefined, 'overview-report');
  section.setAttribute('aria-labelledby', 'overview-report-title');
  section.append(node('div', undefined, 'overview-report-heading'));
  section.firstChild.append(
    node('div', undefined, 'overview-report-accent'),
    node('div', undefined, 'overview-report-copy'),
  );
  section.firstChild.lastChild.append(
    node('p', role === 'worker' ? 'YOUR WORK REPORT' : 'PERFORMANCE SNAPSHOT', 'eyebrow'),
    node('h2', role === 'worker' ? 'Work and payment summary' : 'Performance overview'),
    node('p', caption, 'muted'),
  );
  section.firstChild.lastChild.querySelector('h2').id = 'overview-report-title';
  const cards = node('div', undefined, 'dashboard-metric-cards');
  for (const [label, value] of metrics) {
    const metric = node('article', undefined, 'stat-card');
    metric.append(node('span', label), node('strong', value === null ? '—' : String(value)));
    cards.append(metric);
  }
  if (metrics.length) section.append(cards);
  else section.append(empty(loadedPanels.has('overview')
    ? 'A report summary is not available for this role yet.'
    : 'Loading your authorized report summary…'));
  grid.append(section);
}
function card(title, details, status) {
  const wrapper = node('article', undefined, 'list-card');
  const copy = node('div');
  copy.append(node('h3', title), node('p', details));
  wrapper.append(copy);
  const badge = node('span', status ?? 'active', 'pill');
  if (['rejected', 'unavailable', 'cancelled', 'void'].includes(status)) badge.classList.add('warning');
  wrapper.append(badge);
  return wrapper;
}

function renderOverviewDataContext() {
  const context = node('section', undefined, 'overview-data-context');
  context.setAttribute('aria-label', 'Overview data coverage');
  const loadedAt = state.overviewLoadedAt
    ? new Date(state.overviewLoadedAt).toLocaleString(document.documentElement.lang)
    : null;
  context.append(node('p', loadedAt
    ? `Overview data load completed ${loadedAt}.`
    : 'Overview data is loading.', 'overview-data-freshness'));
  context.append(node('p', 'Figures cover all records returned to this overview for your account and role. No reporting period is selected.', 'overview-data-scope'));
  if (state.overviewDataOmitted.length) {
    context.append(node('p', 'Some records are not included because they are outside this role’s permitted view; those omitted records are not counted as zero.', 'overview-data-caveat'));
  }
  if (state.overviewDataErrors.length) {
    context.append(node('p', 'One or more available data sources could not be loaded. Figures from those sources are omitted; refresh to retry.', 'overview-data-caveat'));
  }
  return context;
}

function renderOverview() {
  const wrap = node('div');
  const roleHeading = state.user.role === 'worker'
    ? ['Your work overview', 'Track assigned shifts, submitted reports, and verified payment handoffs.']
    : state.user.role === 'property_owner'
      ? ['Property performance', 'Review portfolio activity, maintenance, occupancy, and rent records.']
      : ['Your workspace overview', 'A role-scoped performance snapshot and direct paths to your active work.'];
  wrap.append(sectionHeading(...roleHeading));
  wrap.append(renderOverviewDataContext());
  const report = $('#stat-grid');
  const hasDedicatedSummary = state.user.role === 'property_owner'
    || ['master_agent', 'field_agent'].includes(state.user.role)
    || (state.user.enterprise_features_enabled && state.summary);
  report.hidden = state.panel !== 'overview' || Boolean(hasDedicatedSummary);
  if (state.user.role === 'property_owner') wrap.append(renderOwnerPortfolio());
  if (['master_agent', 'field_agent'].includes(state.user.role)) wrap.append(renderAgentPortfolio());
  if (['finance_manager','super_admin','global_admin'].includes(state.user.role)) {
    wrap.append(renderStaffingFinanceQueue());
  }

  function renderOwnerPortfolio() {
    const metrics = propertyOwnerDashboardMetrics(state.properties, state.ownerStatements, state.maintenanceRequests);
    const sources = ['/properties', '/owner/statements', '/maintenance?offset=0'];
    const unavailable = sources.some((path) => state.overviewDataErrors.includes(path) || state.overviewDataOmitted.includes(path));
    const section = node('section', undefined, 'panel form-card owner-portfolio');
    section.append(node('p', 'LANDLORD SELF-SERVICE', 'eyebrow'));
    section.append(node('h2', 'Your property portfolio'));
    section.append(node('p', 'Review your listings, occupancy, maintenance requests, and recorded lease receipts. Reconciled receipts are not a payout confirmation.', 'muted'));
    const cards = node('div', undefined, 'enterprise-metrics');
    for (const [label, value] of [
      ['Properties', metrics.properties],
      ['Units · occupied / vacant', `${metrics.units} · ${metrics.occupiedUnits} / ${metrics.vacantUnits}`],
      ['Active leases', metrics.activeLeases],
      ['Open maintenance requests', metrics.openMaintenance],
      ['Reconciled rent receipts · ETB', metrics.rentReconciled.toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2 })],
      ['Receipts pending reconciliation · ETB', metrics.rentPendingReconciliation.toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2 })],
    ]) {
      const metric = node('div', undefined, 'enterprise-metric');
      metric.append(node('span', label), node('strong', unavailable ? '—' : String(value)));
      cards.append(metric);
    }
    section.append(cards);
    const actions = node('div', undefined, 'property-actions');
    actions.append(button('Manage properties', 'open-panel', 'button button-primary', { panel: 'properties' }));
    actions.append(button('Download rent statement CSV', 'owner-statement-download', 'button button-outline'));
    section.append(actions);
    if (unavailable) {
      const warning = node('p', 'Some portfolio information is unavailable to this account or could not be loaded. Refresh or check access before relying on these totals.', 'alert error');
      warning.setAttribute('role', 'status');
      section.append(warning);
    }
    return section;
  }

  function renderAgentPortfolio() {
    const metrics = agentDashboardMetrics(state.leads, state.workers, state.requests, state.commissions);
    const sources = ['/leads', '/workers', '/requests', '/commissions'];
    const unavailable = sources.some((path) => state.overviewDataErrors.includes(path) || state.overviewDataOmitted.includes(path));
    const section = node('section', undefined, 'panel form-card agent-portfolio');
    section.append(node('p', 'AGENT WORKSPACE', 'eyebrow'));
    section.append(node('h2', 'Your activity snapshot'));
    section.append(node('p', 'A live summary of records available to your account. Commission figures reflect approval status, not confirmed payment.', 'muted'));
    const cards = node('div', undefined, 'enterprise-metrics');
    for (const [label, value] of [
      ['Leads', metrics.leads],
      ['Leads needing follow-up', metrics.followUpLeads],
      ['Workers registered', metrics.workers],
      ['Workers awaiting verification', metrics.workersAwaitingVerification],
      ['Open staffing requests', metrics.openStaffingRequests],
      ['Commissions awaiting review', metrics.commissionsAwaitingReview],
      ['Approved commissions · ETB', metrics.approvedCommissionAmount.toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2 })],
      ['Held commission amount · ETB', metrics.heldCommissionAmount.toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2 })],
    ]) {
      const metric = node('div', undefined, 'enterprise-metric');
      metric.append(node('span', label), node('strong', unavailable ? '—' : String(value)));
      cards.append(metric);
    }
    section.append(cards);
    const actions = node('div', undefined, 'property-actions');
    for (const [label, panel] of [
      ['Open lead book', 'leads'],
      ['Register or review workers', 'workers'],
      ['Manage staffing requests', 'requests'],
      ['Open property listings', 'properties'],
      ['Review contracts', 'contracts'],
      ['Review commissions', 'commissions'],
    ]) {
      if (panel === 'requests' && !hasActivity('staffing.requests.manage')) continue;
      const tab = document.querySelector(`.tab[data-panel="${CSS.escape(panel)}"]`);
      if (!tab || tab.hidden) continue;
      actions.append(button(label, 'open-panel', 'button button-outline', { panel }));
    }
    section.append(actions);
    if (unavailable) {
      const warning = node('p', 'Some activity records are unavailable to this account or could not be loaded. Refresh or check access before relying on these totals.', 'alert error');
      warning.setAttribute('role', 'status');
      section.append(warning);
    }
    return section;
  }
  if (['customer','worker'].includes(state.user.role) && state.staffingEngagements.length) {
    const selfService = node('section', undefined, 'panel');
    selfService.append(sectionHeading('Staffing offers', 'Review approved engagement terms and record your own acceptance. An engagement becomes active only after both parties accept.'));
    const list = node('div', undefined, 'list');
    for (const engagement of state.staffingEngagements) {
      const pendingAcceptance = engagement.status === 'terms_approved'
        && !(state.user.role === 'customer' ? engagement.client_accepted : engagement.worker_accepted);
      const ownRate = state.user.role === 'customer' ? engagement.client_rate : engagement.worker_rate;
      const item = card(`Engagement ${engagement.id.slice(0, 8)}`, `${engagement.billing_unit} · ETB ${Number(ownRate).toLocaleString(document.documentElement.lang)} · ${engagement.starts_on}${engagement.ends_on ? ` to ${engagement.ends_on}` : ''} · client ${engagement.client_accepted ? 'accepted' : 'pending'} · worker ${engagement.worker_accepted ? 'accepted' : 'pending'}`, engagement.status);
      if (pendingAcceptance) item.append(button('Review and accept terms', 'staffing-engagement-accept', 'button button-primary', { id: engagement.id }));
      list.append(item);
    }
    selfService.append(list); wrap.append(selfService);
  }
  if (loadedPanels.has('edir') && state.user.kyc_status === 'verified' && state.features.edirEnabled && !state.edirMe?.membership) {
    const offer = node('section', undefined, 'panel form-card edir-offer');
    offer.append(node('p', 'ETHIOLIFE EDIR · MEMBERSHIP OFFER', 'eyebrow'));
    offer.append(node('h2', 'Explore Edir membership and available benefits'));
    offer.append(node('p', 'Open to verified AfroLife users across worker, employer, landlord, tenant, seller, and buyer services. Review active community, savings, share, and contribution options before requesting membership. Lending, insurance, and benefit payouts are not live in this pilot.'));
    const action = button('View Edir offer', 'open-edir-offer', 'button button-primary');
    action.addEventListener('click', () => navigateToPanel('edir'));
    offer.append(action);
    wrap.append(offer);
  }
  if (state.user.enterprise_features_enabled && state.summary) {
    const portfolio = node('section', undefined, 'panel form-card enterprise-snapshot');
    portfolio.append(node('h3', 'Enterprise team and portfolio insights'));
    const total = (rows) => Array.isArray(rows) ? rows.reduce((sum, row) => sum + Number(row.n ?? 0), 0) : 0;
    const snapshot = node('div', undefined, 'enterprise-metrics');
    for (const [label, value] of [
      ['Team leads', total(state.summary.leads)],
      ['Team workers', state.summary.workers ?? 0],
      ['Active contracts', state.summary.active_contracts ?? 0],
      ['Property listings', state.summary.properties ?? 0],
    ]) {
      const metric = node('div', undefined, 'enterprise-metric');
      metric.append(node('span', label), node('strong', value));
      snapshot.append(metric);
    }
    portfolio.append(snapshot);
    wrap.append(portfolio);
  }
  return wrap;
}

function renderStaffingFinanceQueue() {
  const section = node('section', undefined, 'panel');
  section.append(sectionHeading('Staffing review queue', 'Review engagement terms and submitted work independently. Approval records the accounting event using the existing maker-checker controls.'));
  const terms = state.staffingFinanceEngagements.filter((item) => item.status === 'terms_pending')
    .sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
  const termsSection = node('div', undefined, 'list');
  termsSection.append(node('h3', `Engagement terms awaiting review (${terms.length})`));
  if (!terms.length) termsSection.append(empty('No Staffing engagement terms are awaiting review.'));
  for (const engagement of terms) {
    const clientRate = Number(engagement.client_rate);
    const workerRate = Number(engagement.worker_rate);
    const rateSpread = Math.max(0, clientRate - workerRate);
    const rateMargin = clientRate > 0 ? rateSpread / clientRate * 100 : 0;
    const item = card(`${engagement.client_name} · ${engagement.worker_name}`, `${engagement.billing_unit} · client ETB ${Number(engagement.client_rate).toLocaleString(document.documentElement.lang)} · worker ETB ${Number(engagement.worker_rate).toLocaleString(document.documentElement.lang)} · ${engagement.starts_on}${engagement.ends_on ? ` to ${engagement.ends_on}` : ''}`, engagement.status);
    item.append(node('p', `Rate spread: ETB ${rateSpread.toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per ${engagement.billing_unit} (${rateMargin.toFixed(1)}% of client rate, before operating costs).`));
    if (engagement.created_at) item.append(node('small', `Waiting since ${new Date(engagement.created_at).toLocaleString(document.documentElement.lang)}`));
    item.append(button('Approve terms', 'staffing-terms-decision', 'button button-primary', { id: engagement.id, decision: 'approve' }));
    item.append(button('Reject terms', 'staffing-terms-decision', 'button button-outline', { id: engagement.id, decision: 'reject' }));
    termsSection.append(item);
  }
  section.append(termsSection);
  const work = node('div', undefined, 'list');
  work.append(node('h3', `Work evidence awaiting review (${state.pendingStaffingWork.length})`));
  if (!state.pendingStaffingWork.length) work.append(empty('No Staffing work evidence is awaiting review.'));
  const pendingWork = [...state.pendingStaffingWork].sort((a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0));
  for (const evidence of pendingWork) {
    const clientAmount = Number(evidence.client_amount);
    const workerAmount = Number(evidence.worker_amount);
    const workSpread = Math.max(0, clientAmount - workerAmount);
    const workMargin = clientAmount > 0 ? workSpread / clientAmount * 100 : 0;
    const item = card(`${evidence.client_name ?? 'Client'} · ${evidence.worker_name ?? 'Worker'}`, `${evidence.period_start} to ${evidence.period_end} · quantity ${evidence.quantity} · client ETB ${evidence.client_amount} · worker ETB ${evidence.worker_amount}`, evidence.status);
    item.append(node('p', evidence.description));
    item.append(node('p', `Work spread: ETB ${workSpread.toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total (${workMargin.toFixed(1)}% of client amount, before operating costs).`));
    if (evidence.created_at) item.append(node('small', `Waiting since ${new Date(evidence.created_at).toLocaleString(document.documentElement.lang)}`));
    item.append(button('Approve work', 'staffing-work-decision', 'button button-primary', { id: evidence.id, decision: 'approve' }));
    item.append(button('Reject work', 'staffing-work-decision', 'button button-outline', { id: evidence.id, decision: 'reject' }));
    work.append(item);
  }
  section.append(work);
  return section;
}

function renderServiceStatus() {
  const wrap = node('div');
  wrap.append(sectionHeading('Service status', 'Availability of this deployment’s application services. Health status does not confirm financial readiness.'));
  if (!state.serviceStatus) {
    wrap.append(empty('Service status has not been loaded.'));
    return wrap;
  }
  wrap.append(node('p', `Checked ${new Date(state.serviceStatus.checked_at).toLocaleString(document.documentElement.lang)}`, 'muted'));
  const list = node('div', undefined, 'service-health-list');
  for (const service of state.serviceStatus.services) {
    const item = node('article', undefined, 'service-health-row');
    item.dataset.status = service.status;
    const name = node('div');
    name.append(node('strong', service.name));
    const latency = service.latency_ms === null ? '' : ` · ${service.latency_ms} ms`;
    name.append(node('small', `${service.status.replaceAll('_', ' ')}${latency}`));
    item.append(name);
    list.append(item);
  }
  wrap.append(list);
  if (isPlatformAdmin() && state.serviceMetrics) {
    const metrics = node('section', undefined, 'panel form-card service-metrics');
    metrics.append(node('h3', 'API request metrics'));
    metrics.append(node('p', 'In-memory aggregate for this API process; counters reset when it restarts.'));
    const metricList = node('div', undefined, 'service-health-list');
    for (const metric of state.serviceMetrics.routes) {
      const row = node('article', undefined, 'service-health-row');
      const details = node('div');
      details.append(node('strong', metric.route));
      details.append(node('small', `${metric.requests} requests · ${metric.failures} failed · average ${metric.average_duration_ms} ms · max ${metric.max_duration_ms} ms`));
      row.append(details);
      metricList.append(row);
    }
    if (!state.serviceMetrics.routes.length) metricList.append(empty('No API requests have been recorded yet.'));
    metrics.append(metricList);
    wrap.append(metrics);
  }
  return wrap;
}

const integratedMiniAppLogos = Object.freeze({
  leads: '/mini-apps/leads/logo.svg',
  contracts: '/mini-apps/contracts/logo.svg',
  commissions: '/mini-apps/commissions/logo.svg',
  rent: '/mini-apps/rent/logo.svg',
  agents: '/mini-apps/agents/logo.svg',
  edir: '/mini-apps/edir/logo.svg',
  mfi: '/mini-apps/mfi/logo.svg',
  insurance: '/mini-apps/insurance/logo.svg',
});

function miniAppLogo(panel) {
  return miniAppByPanel[panel]?.logo ?? integratedMiniAppLogos[panel] ?? null;
}

function currentMiniAppPanels() {
  return miniAppByPanel[state.panel]?.panels
    ?? (miniAppLogo(state.panel) ? [state.panel] : []);
}

function applyMiniAppNavigationScope() {
  const currentPanels = new Set(currentMiniAppPanels());
  for (const tab of document.querySelectorAll('.tab[data-panel]')) {
    const panel = tab.dataset.panel;
    tab.hidden = !accessVisiblePanels.has(panel)
      || (Boolean(miniAppLogo(panel))
        && state.panel !== 'launcher'
        && !currentPanels.has(panel));
  }
}

function isCrossMiniAppPanel(panel) {
  return Boolean(miniAppLogo(panel))
    && state.panel !== 'launcher'
    && !currentMiniAppPanels().includes(panel);
}

function renderSuperAppLauncher() {
  const wrap = node('div');
  wrap.append(sectionHeading('Your service mini-apps', 'Open an available service directly. Access is based on your role and enabled features.'));
  const catalog = node('div', undefined, 'service-grid workspace-launcher-grid');
  const accessibleModules = [...document.querySelectorAll('.tab[data-panel]:not([hidden])')]
    .filter((tab) => MINI_APP_PANELS.has(tab.dataset.panel));
  for (const tab of accessibleModules) {
    const panel = tab.dataset.panel;
    const name = panel === 'accounting'
      ? 'Accounting & Finance'
      : getLocalizedNodeSource(tab.firstChild).trim() || tab.textContent.trim();
    const card = node('button', undefined, 'service-card workspace-launch-card service-launcher-card');
    card.type = 'button';
    card.dataset.panel = panel;
    card.setAttribute('aria-label', `Open ${name}`);
    setLocalizedAttribute(card, 'aria-label', 'Open {{service}}', { service: name });
    const logoSource = miniAppLogo(panel);
    if (logoSource) {
      const logo = node('img', undefined, 'service-icon service-icon-image service-launcher-logo');
      logo.src = logoSource;
      logo.alt = '';
      logo.setAttribute('aria-hidden', 'true');
      card.append(logo);
    } else {
      const icon = node('span', workspaceNavIcons[panel] ?? '•', 'service-icon');
      icon.setAttribute('aria-hidden', 'true');
      card.append(icon);
    }
    card.append(
      node('strong', name),
      node('span', 'Open an available service directly. Access is based on your role and enabled features.'),
      node('small', 'Open service'),
    );
    card.addEventListener('click', () => navigateToPanel(panel));
    catalog.append(card);
  }
  if (!accessibleModules.length) catalog.append(empty('No services are assigned to your account yet.'));
  wrap.append(catalog);
  return wrap;
}

function decoratePublicServiceLogos() {
  const logos = new Map([
    ['Homes & rentals', miniAppLogo('properties')],
    ['Marketplace', miniAppLogo('marketplace')],
    ['Workforce', miniAppLogo('workers')],
    ['AfroLife Edir', miniAppLogo('edir')],
    ['SACCO / MFI', miniAppLogo('mfi')],
    ['Agent services', miniAppLogo('agents')],
    ['Accounting & Finance', miniAppLogo('accounting')],
  ]);
  const panels = new Map([
    ['Homes & rentals', 'properties'],
    ['Marketplace', 'marketplace'],
    ['Workforce', 'workers'],
    ['AfroLife Edir', 'edir'],
    ['SACCO / MFI', 'mfi'],
    ['Agent services', 'agents'],
    ['Accounting & Finance', 'accounting'],
  ]);
  for (const card of document.querySelectorAll('#public-hub .service-card')) {
    const name = card.querySelector('strong')?.textContent.trim();
    const src = logos.get(name);
    const current = card.querySelector('.service-icon');
    if (panels.has(name)) card.dataset.panel = panels.get(name);
    if (!src || !current) continue;
    const logo = node('img', undefined, 'service-icon service-icon-image');
    logo.src = src;
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
    current.replaceWith(logo);
  }
}

decoratePublicServiceLogos();

function renderMySubscriptions() {
  const status = $('#subscription-mine-status');
  status.replaceChildren();
  status.hidden = !state.user;
  renderSubscriptionReview();
  if (!state.user) return;
  if (subscriptionState.mineError) {
    status.hidden = false;
    status.textContent = t('Your subscription requests could not be loaded. Select Refresh to try again.');
    return;
  }
  if (!subscriptionState.mineLoaded) {
    status.hidden = true;
    return;
  }
  status.hidden = false;
  status.append(document.createTextNode(t(subscriptionState.mine.length
    ? 'Your subscription requests'
    : 'No subscription requests yet.')));
  if (subscriptionState.mine.length) {
    const list = document.createElement('ul');
    list.className = 'subscription-request-list';
    for (const request of subscriptionState.mine) {
      const serviceNames = (request.services ?? [request.service_key ?? request.service].filter(Boolean))
        .map((key) => PUBLIC_SUBSCRIPTION_SERVICES.find((service) => service.key === (key?.key ?? key))?.name ?? String(key?.name ?? key))
        .join(', ');
      const item = document.createElement('li');
      const summary = node('p', '{{services}} — {{status}}', 'subscription-request-summary');
      setLocalizedText(summary, '{{services}} — {{status}}', {
        services: serviceNames || t('Selected services'),
        status: t(request.status ?? request.request_status ?? 'Pending finance confirmation'),
      });
      item.append(summary);
      if (request.payment_reference) {
        const reference = node('small', undefined, 'muted');
        setLocalizedText(reference, 'Payment reference: {{reference}}', { reference: request.payment_reference });
        item.append(reference);
      }
      if (request.status === 'requested') {
        const form = document.createElement('form');
        form.className = 'inline-form subscription-payment-reference';
        form.dataset.form = 'subscription-payment-reference';
        form.dataset.subscriptionId = request.id;
        const label = document.createElement('label');
        label.textContent = t('Payment reference');
        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'payment_reference';
        input.required = true;
        input.minLength = 4;
        input.maxLength = 160;
        input.autocomplete = 'off';
        label.append(input);
        const submit = button('Submit payment reference', 'submit', 'button button-outline');
        form.append(label, submit);
        item.append(form);
      }
      list.append(item);
    }
    status.append(list);
  }
}

function renderSubscriptionReview() {
  const section = $('#subscription-review');
  if (!section) return;
  const allowed = ['finance', 'finance_manager', 'global_admin', 'super_admin'].includes(state.user?.role);
  section.hidden = !allowed;
  const status = $('#subscription-review-status');
  const queue = $('#subscription-review-queue');
  status.replaceChildren();
  queue.replaceChildren();
  if (!allowed) return;
  if (subscriptionState.reviewError) {
    status.textContent = t('The Finance review queue could not be loaded. Refresh to try again.');
    const retry = button('Refresh payment review', 'subscription-review-refresh', 'button button-outline');
    queue.append(retry);
    return;
  }
  if (!subscriptionState.reviewLoaded) {
    status.textContent = t('Loading payment review requests…');
    return;
  }
  status.textContent = t(subscriptionState.reviews.length
    ? '{{count}} subscription payment(s) require review.'
    : 'No subscription payments are awaiting review.', { count: subscriptionState.reviews.length });
  for (const review of subscriptionState.reviews) {
    const item = document.createElement('article');
    item.className = 'subscription-review-item';
    const serviceName = PUBLIC_SUBSCRIPTION_SERVICES.find((service) => service.key === review.service_key)?.name ?? review.service_key;
    item.append(
      node('strong', serviceName),
      node('p', '{{name}} · ETB {{amount}} · reference {{reference}}', 'muted'),
    );
    item.lastChild.textContent = t('{{name}} · ETB {{amount}} · reference {{reference}}', {
      name: review.legal_name,
      amount: Number(review.monthly_fee).toLocaleString(document.documentElement.lang),
      reference: review.payment_reference,
    });
    for (const [decision, label, className] of [
      ['confirm', 'Confirm payment', 'button button-primary'],
      ['reject', 'Reject payment', 'button button-outline'],
    ]) {
      const action = button(label, 'subscription-review', className, { id: review.id, decision });
      item.append(action);
    }
    queue.append(item);
  }
  const refresh = button('Refresh payment review', 'subscription-review-refresh', 'button button-outline');
  queue.append(refresh);
}

function selectedSubscriptionTotal() {
  return subscriptionState.selected.size * 1000;
}

function renderSubscriptionCatalog() {
  const content = $('#subscription-catalog-content');
  const error = $('#subscription-catalog-error');
  content.replaceChildren();
  error.hidden = true;
  const requestStatus = $('#subscription-request-status');
  renderMySubscriptions();
  if (subscriptionState.requestSubmitted) {
    setLocalizedText(requestStatus, 'Subscription request submitted. Payment is manual; Finance must confirm receipt before activation. No automatic charge was made.');
    requestStatus.hidden = false;
  } else {
    requestStatus.hidden = true;
  }
  if (subscriptionState.catalogLoading) {
    content.append(node('p', 'Loading available subscriptions…', 'muted'));
    renderMySubscriptions();
    return;
  }
  if (subscriptionState.catalogError || !Array.isArray(subscriptionState.catalog)) {
    const unavailable = node('p', 'Available subscriptions could not be loaded. Try again when the connection is available.', 'muted');
    content.append(unavailable);
    const retry = button('Retry loading subscriptions', 'subscription-catalog-retry', 'button button-outline');
    retry.addEventListener('click', () => { void loadPublicSubscriptionCatalog(); });
    content.append(retry);
    renderMySubscriptions();
    return;
  }
  if (!subscriptionState.catalog.length) {
    content.append(node('p', 'There are no public subscriptions available right now.', 'muted'));
    renderMySubscriptions();
    return;
  }
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'subscription-service-list';
  const legend = document.createElement('legend');
  legend.textContent = t('Select the services you need');
  fieldset.append(legend);
  for (const service of subscriptionState.catalog) {
    const label = document.createElement('label');
    label.className = 'subscription-service-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = service.requestKey;
    checkbox.checked = subscriptionState.selected.has(service.requestKey);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) subscriptionState.selected.add(service.requestKey);
      else subscriptionState.selected.delete(service.requestKey);
      total.textContent = t('Estimated monthly total: ETB {{amount}}', { amount: selectedSubscriptionTotal().toLocaleString(document.documentElement.lang) });
      requestButton.textContent = t(state.user ? 'Request selected services' : 'Sign in to request selected services');
    });
    const copy = document.createElement('span');
    copy.append(
      node('strong', service.name),
      node('small', 'ETB 1,000 per month for this service'),
    );
    label.append(checkbox, copy);
    fieldset.append(label);
  }
  const total = node('p', 'Estimated monthly total: ETB {{amount}}', 'subscription-total');
  setLocalizedText(total, 'Estimated monthly total: ETB {{amount}}', { amount: selectedSubscriptionTotal().toLocaleString(document.documentElement.lang) });
  const requestButton = button(
    state.user ? 'Request selected services' : 'Sign in to request selected services',
    'subscription-request',
    'button button-primary',
  );
  requestButton.addEventListener('click', () => { void submitSubscriptionRequest(); });
  const note = node('p', 'Payment is manual. Finance confirms receipt before activation. A subscription request does not charge you or activate a service automatically.', 'subscription-policy');
  content.append(fieldset, total, requestButton, note);
  renderMySubscriptions();
}

async function loadPublicSubscriptionCatalog() {
  subscriptionState.catalogError = false;
  subscriptionState.catalog = null;
  subscriptionState.catalogLoading = true;
  renderSubscriptionCatalog();
  try {
    const result = await api('/subscriptions/catalog');
    subscriptionState.catalog = normalizeSubscriptionCatalog(result);
    if (!subscriptionState.catalog) throw new Error('The subscription catalog response was not recognized.');
    const allowed = new Set(subscriptionState.catalog.map((service) => service.requestKey));
    subscriptionState.selected = new Set([...subscriptionState.selected].filter((service) => allowed.has(service)));
  } catch (reason) {
    subscriptionState.catalogError = true;
    console.warn('Public subscription catalog could not be loaded.', reason);
  } finally {
    subscriptionState.catalogLoading = false;
  }
  renderSubscriptionCatalog();
}

async function loadMySubscriptions() {
  if (!state.user) return;
  subscriptionState.mineError = false;
  try {
    subscriptionState.mine = normalizeMySubscriptions(await api('/subscriptions/mine'));
    subscriptionState.mineLoaded = true;
  } catch (reason) {
    subscriptionState.mineError = true;
    subscriptionState.mineLoaded = false;
    console.warn('Subscription requests could not be loaded.', reason);
  }
  renderMySubscriptions();
}

async function loadSubscriptionReview() {
  if (!['finance', 'finance_manager', 'global_admin', 'super_admin'].includes(state.user?.role)) return;
  subscriptionState.reviewError = false;
  subscriptionState.reviewLoaded = false;
  renderSubscriptionReview();
  try {
    const response = await api('/subscriptions/review');
    subscriptionState.reviews = Array.isArray(response?.requests) ? response.requests : [];
    subscriptionState.reviewLoaded = true;
  } catch (reason) {
    subscriptionState.reviewError = true;
    console.error('Subscription payment review queue could not be loaded.', reason);
  }
  renderSubscriptionReview();
}

function renderSubscriptions() {
  const host = node('div', undefined, 'subscription-panel-host');
  host.append($('#subscription-catalog'));
  renderSubscriptionCatalog();
  if (!subscriptionState.catalog && !subscriptionState.catalogLoading) void loadPublicSubscriptionCatalog();
  if (['finance', 'finance_manager', 'global_admin', 'super_admin'].includes(state.user?.role)
    && !subscriptionState.reviewLoaded && !subscriptionState.reviewError) {
    void loadSubscriptionReview();
  }
  return host;
}

async function submitSubscriptionRequest() {
  const status = $('#subscription-request-status');
  status.hidden = true;
  subscriptionState.requestSubmitted = false;
  if (!state.user) {
    $('#login-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#login-form input[name="phone"]').focus({ preventScroll: true });
    return;
  }
  if (!subscriptionState.selected.size) {
    setLocalizedText($('#subscription-catalog-error'), 'Select at least one service to request.');
    $('#subscription-catalog-error').hidden = false;
    return;
  }
  const requestButton = $('[data-action="subscription-request"]');
  if (requestButton) requestButton.disabled = true;
  try {
    await api('/subscriptions/requests', {
      method: 'POST',
      body: JSON.stringify(subscriptionRequestPayload([...subscriptionState.selected])),
    });
    subscriptionState.selected.clear();
    subscriptionState.requestSubmitted = true;
    setLocalizedText(status, 'Subscription request submitted. Payment is manual; Finance must confirm receipt before activation. No automatic charge was made.');
    status.hidden = false;
    await loadMySubscriptions();
    renderSubscriptionCatalog();
  } catch (reason) {
    setLocalizedText($('#subscription-catalog-error'), reason.message);
    $('#subscription-catalog-error').hidden = false;
  } finally {
    const currentButton = $('[data-action="subscription-request"]');
    if (currentButton) currentButton.disabled = false;
  }
}

const workspaceNavIcons = {
  overview: '⌂',
  leads: '＋',
  workers: '◎',
  requests: '↔',
  learning: '▶',
  properties: '⌂',
  marketplace: '▦',
  contracts: '▤',
  commissions: '◈',
  agents: '♧',
  rent: '▣',
  mfi: '◉',
  edir: '◇',
  privacy: '⬡',
  security: '⌑',
  admin: '⚙',
};

function createWorkspaceNavLink(tab, className = 'workspace-nav-link') {
  const panel = tab.dataset.panel;
  const sourceLabel = getLocalizedNodeSource(tab.firstChild).trim() || tab.textContent.trim();
  const link = node('button', undefined, className);
  link.type = 'button';
  link.dataset.panel = panel;
  setLocalizedAttribute(link, 'aria-label', sourceLabel);
  const logoSource = miniAppLogo(panel);
  const icon = node('span', workspaceNavIcons[panel] ?? '•', 'workspace-nav-icon');
  icon.setAttribute('aria-hidden', 'true');
  const label = node('span', sourceLabel, 'workspace-nav-label');
  link.append(icon, label);
  if (logoSource) {
    const logo = node('img', undefined, 'workspace-nav-logo');
    logo.src = logoSource;
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
    icon.hidden = true;
    link.insertBefore(logo, label);
  }
  return link;
}

function updateWorkspaceNavigationGroups() {
  document.querySelectorAll('.workspace-nav-group').forEach((group) => {
    group.hidden = !group.querySelector('.tab:not([hidden])');
  });
}

function configureWorkspaceNavigation() {
  const profiles = {
    worker: {
      titles: ['My work', 'Work tools', 'Account & help'],
      core: ['overview', 'workers', 'support', 'learning', 'requests'],
      business: ['subscriptions', 'marketplace', 'insurance', 'edir', 'mfi', 'accounting'],
    },
    customer: {
      titles: ['My requests', 'Explore services', 'Account & help'],
      core: ['overview', 'requests', 'support', 'workers'],
      business: ['marketplace', 'properties', 'rent', 'subscriptions', 'edir', 'insurance'],
    },
    property_owner: {
      titles: ['Property operations', 'Property services', 'Account & help'],
      core: ['overview', 'properties', 'rent', 'requests', 'support'],
      business: ['subscriptions', 'marketplace', 'accounting', 'insurance', 'edir'],
    },
    master_agent: {
      titles: ['Pipeline', 'Business tools', 'Account & help'],
      core: ['overview', 'leads', 'requests', 'workers', 'support'],
      business: ['contracts', 'commissions', 'agents', 'properties', 'marketplace', 'subscriptions'],
    },
    field_agent: {
      titles: ['Pipeline', 'Business tools', 'Account & help'],
      core: ['overview', 'leads', 'requests', 'workers', 'support'],
      business: ['contracts', 'commissions', 'properties', 'marketplace', 'subscriptions'],
    },
    corporate_business_manager: {
      titles: ['Business operations', 'Organization tools', 'Account & controls'],
      core: ['overview', 'workers', 'requests', 'leads', 'support'],
      business: ['properties', 'marketplace', 'contracts', 'commissions', 'agents', 'accounting', 'subscriptions'],
    },
    finance: {
      titles: ['Finance desk', 'Operations', 'Account & controls'],
      core: ['overview', 'accounting', 'commissions', 'rent', 'support'],
      business: ['requests', 'workers', 'properties', 'subscriptions'],
    },
    finance_manager: {
      titles: ['Finance desk', 'Operations', 'Account & controls'],
      core: ['overview', 'accounting', 'commissions', 'rent', 'support'],
      business: ['requests', 'workers', 'properties', 'subscriptions'],
    },
    compliance: {
      titles: ['Review desk', 'Service tools', 'Account & controls'],
      core: ['overview', 'support', 'workers', 'requests'],
      business: ['properties', 'marketplace', 'subscriptions', 'insurance'],
    },
    super_admin: {
      titles: ['Platform overview', 'Business tools', 'Administration'],
      core: ['overview', 'workers', 'leads', 'requests', 'support'],
      business: ['accounting', 'global-bi', 'properties', 'rent', 'commissions', 'contracts', 'subscriptions'],
    },
    global_admin: {
      titles: ['Agency overview', 'Business tools', 'Administration'],
      core: ['overview', 'workers', 'leads', 'requests', 'support'],
      business: ['accounting', 'global-bi', 'properties', 'rent', 'commissions', 'contracts', 'subscriptions'],
    },
  };
  const profile = profiles[state.user?.role] ?? {
    titles: ['Workspace', 'Operations', 'Account & controls'],
    core: ['overview'],
    business: [],
  };
  const groups = [...document.querySelectorAll('.workspace-nav-group')];
  const [coreGroup, businessGroup, configurationGroup] = groups;
  [coreGroup, businessGroup, configurationGroup].forEach((group, index) => {
    const heading = group?.querySelector('h2');
    if (heading) setLocalizedText(heading, profile.titles[index]);
  });
  const orderGroup = (group, order) => {
    if (!group) return;
    const priority = new Map(order.map((panel, index) => [panel, index]));
    const tabs = [...group.querySelectorAll(':scope > .tab')];
    tabs.sort((left, right) => (priority.get(left.dataset.panel) ?? 100) - (priority.get(right.dataset.panel) ?? 100));
    tabs.forEach((tab) => group.append(tab));
  };
  orderGroup(coreGroup, profile.core);
  orderGroup(businessGroup, profile.business);
  applyMiniAppNavigationScope();
}

function renderMobileWorkspaceNav() {
  const nav = $('#mobile-workspace-nav');
  const moreNav = $('#workspace-more-nav');
  const tabs = [...document.querySelectorAll('#app-view .tabs .tab:not([hidden])')];
  const overview = tabs.find((tab) => tab.dataset.panel === 'overview');
  const primary = [
    overview,
    ...tabs.filter((tab) => tab !== overview && !['privacy', 'security', 'admin'].includes(tab.dataset.panel)).slice(0, 2),
  ].filter(Boolean);
  const primaryPanels = new Set(primary.map((tab) => tab.dataset.panel));
  nav.replaceChildren(...primary.map((tab) => createWorkspaceNavLink(tab)));
  moreNav.replaceChildren(...tabs
    .filter((tab) => !primaryPanels.has(tab.dataset.panel))
    .map((tab) => createWorkspaceNavLink(tab, 'workspace-nav-link workspace-more-link')));
  const moreButton = node('button', undefined, 'workspace-nav-link mobile-nav-more');
  moreButton.type = 'button';
  moreButton.id = 'mobile-workspace-more';
  moreButton.hidden = moreNav.childElementCount === 0;
  setLocalizedAttribute(moreButton, 'aria-label', 'More workspace sections');
  moreButton.setAttribute('aria-haspopup', 'dialog');
  moreButton.setAttribute('aria-controls', 'workspace-more-dialog');
  moreButton.setAttribute('aria-expanded', 'false');
  const moreIcon = node('span', '⋯', 'workspace-nav-icon');
  moreIcon.setAttribute('aria-hidden', 'true');
  moreButton.append(moreIcon, node('span', 'More', 'workspace-nav-label'));
  nav.append(moreButton);
}

function renderLeads() {
  const wrap = node('div');
  wrap.append(sectionHeading('Lead book', 'Every opportunity stays attributed to the agent who sourced it.'));
  const columns = node('div', undefined, 'columns');
  const form = node('form', undefined, 'panel form-card');
  form.dataset.form = 'lead';
  form.append(node('h3', 'Add a lead'));
  const type = field('Lead type', 'lead_type', 'select');
  for (const [value, label] of [['household','Household'],['business','Business'],['worker','Worker'],['property','Property']]) {
    const option = node('option', label); option.value = value; type.input.append(option);
  }
  form.append(type.label, field('Name', 'name').label, field('Phone', 'phone', 'tel', true, { placeholder: '0911 234 567' }).label);
  form.append(button('Save lead', 'submit', 'button button-primary'));
  const list = node('div', undefined, 'list');
  if (!state.leads.length) list.append(empty('Leads you create will appear here.'));
  for (const lead of state.leads) {
    const item = card(lead.name, t('{{phone}} · {{type}}', { phone: lead.phone, type: t(lead.lead_type[0].toUpperCase() + lead.lead_type.slice(1)) }), lead.status);
    if (lead.protected_until) item.append(node('p', `Ownership protected until ${new Date(lead.protected_until).toLocaleString(document.documentElement.lang)}.`));
    if (lead.status === 'new') {
      item.append(button('Qualify lead', 'lead-status', 'button button-outline', { id: lead.id, status: 'qualified' }));
      item.append(button('Mark lost', 'lead-status', 'button button-outline', { id: lead.id, status: 'lost' }));
    } else if (lead.status === 'qualified') {
      item.append(button('Mark lost', 'lead-status', 'button button-outline', { id: lead.id, status: 'lost' }));
    }
    item.append(button('Attribution history', 'lead-attribution-history', 'button button-outline', { id: lead.id }));
    if (isPlatformAdmin() && lead.status !== 'converted') {
      const reassign = node('form', undefined, 'inline-form');
      reassign.dataset.form = 'lead-reassign';
      reassign.dataset.lead = lead.id;
      const target = field('Reassign to active agent', 'target_agent_id', 'select');
      const placeholder = node('option', 'Choose an agent'); placeholder.value = ''; placeholder.disabled = true; placeholder.selected = true;
      target.input.append(placeholder);
      for (const agent of state.team.filter((entry) => entry.active && ['master_agent','field_agent'].includes(entry.role))) {
        const option = node('option', `${agent.legal_name} · ${roleLabel(agent.role)}`); option.value = agent.id; target.input.append(option);
      }
      const reason = field('Reassignment reason (at least 10 characters)', 'reason', 'text', true, { minLength: 10, maxLength: 1000 });
      reassign.append(target.label, reason.label, button('Reassign and record reason', 'submit', 'button button-outline'));
      item.append(reassign);
    }
    list.append(item);
  }
  form.hidden = !hasActivity('workforce.workers.register');
  columns.append(form, list);
  wrap.append(columns);
  return wrap;
}

function renderAppDashboard({ title, description, source, metrics, statusTitle, statuses, emptyMessage, values }) {
  const section = node('section', undefined, 'panel form-card app-dashboard');
  section.setAttribute('aria-labelledby', 'app-dashboard-title');
  section.append(node('h2', title));
  section.lastElementChild.id = 'app-dashboard-title';
  section.append(node('p', description, 'muted'));
  const unavailable = state.workspaceDataErrors.includes(source) || state.workspaceDataOmitted.includes(source);
  if (unavailable) {
    const notice = node('p', 'Dashboard information could not be loaded. Select Refresh to try again.', 'alert error');
    notice.setAttribute('role', 'status');
    section.append(notice);
    return section;
  }
  const summary = node('div', undefined, 'app-dashboard-summary');
  for (const [label, value] of values(metrics)) {
    const item = node('article', undefined, 'app-dashboard-stat');
    item.append(node('span', label), node('strong', value));
    summary.append(item);
  }
  section.append(summary);
  if (state.maintenanceOverdue.length) {
    const overdue = node('section', undefined, 'panel form-card');
    overdue.append(node('h3', 'Overdue maintenance SLA queue'));
    for (const request of state.maintenanceOverdue) {
      const item = card(`${request.address}${request.unit_no ? ` · ${request.unit_no}` : ''}`,
        `${request.category} · ${request.priority} priority · due ${new Date(request.sla_due_at).toLocaleString(document.documentElement.lang)}`,
        request.status);
      item.append(node('p', request.description));
      if (request.vendor_name) item.append(node('p', `Assigned vendor: ${request.vendor_name}`));
      overdue.append(item);
    }
    section.append(overdue);
  }
  if (!metrics.total && !metrics.totalListings) {
    section.append(node('p', emptyMessage, 'muted app-dashboard-empty'));
  }
  const figure = node('figure', undefined, 'app-dashboard-chart');
  figure.append(node('figcaption', statusTitle));
  const table = document.createElement('table');
  table.className = 'app-dashboard-table';
  const caption = document.createElement('caption');
  caption.className = 'visually-hidden';
  caption.textContent = t('{{title}} status counts', { title });
  table.append(caption);
  const head = document.createElement('thead');
  const headingRow = document.createElement('tr');
  for (const label of ['Status', 'Count', 'Distribution']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = t(label);
    headingRow.append(cell);
  }
  head.append(headingRow);
  const body = document.createElement('tbody');
  const maximum = Math.max(1, ...statuses.map((status) => status.count));
  for (const status of statuses) {
    const row = document.createElement('tr');
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = t(status.label);
    const count = document.createElement('td');
    count.textContent = status.count.toLocaleString(document.documentElement.lang);
    const distribution = document.createElement('td');
    const meter = document.createElement('meter');
    meter.min = 0;
    meter.max = maximum;
    meter.value = status.count;
    meter.setAttribute('aria-label', t('{{status}}: {{count}}', { status: status.label, count: status.count }));
    distribution.append(meter);
    row.append(label, count, distribution);
    body.append(row);
  }
  table.append(head, body);
  figure.append(table);
  section.append(figure);
  return section;
}

const WORKER_TYPE_LABELS = {
  full_time_employee: 'Full-time employee',
  part_time_employee: 'Part-time employee',
  hourly_professional: 'Hourly professional',
  contracted_service_provider: 'Contracted labour / service provider',
};

function workerClockQueueKey() {
  return `workforce-clock-queue:${state.user.id}`;
}

function addisAbabaDateTimeToIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Enter a valid shift date and time.');
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const [year, month, day, hour, minute] = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (local.getUTCFullYear() !== year || local.getUTCMonth() + 1 !== month || local.getUTCDate() !== day
    || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute) {
    throw new Error('Enter a valid shift date and time.');
  }
  return new Date(local.getTime() - 3 * 60 * 60 * 1000).toISOString();
}

function readWorkerClockQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(workerClockQueueKey()) ?? '[]');
    if (!Array.isArray(queue) || queue.some((entry) => !entry || typeof entry !== 'object'
      || typeof entry.shift_id !== 'string' || !['clock_in','clock_out'].includes(entry.event_type)
      || typeof entry.client_event_id !== 'string' || typeof entry.occurred_at !== 'string')) {
      throw new Error('The saved clock-event queue is invalid. Do not clear it until its contents are reviewed.');
    }
    return queue;
  } catch (error) {
    state.workerClockQueueError = error instanceof Error ? error.message : 'The saved clock-event queue could not be read.';
    return [];
  }
}

async function syncWorkerClockQueue() {
  state.workerClockQueueError = '';
  if (!state.user || state.user.role !== 'worker') return;
  const queue = readWorkerClockQueue();
  if (state.workerClockQueueError || !queue.length || !navigator.onLine) return;
  const remaining = [...queue];
  for (const event of queue) {
    try {
      await api(`/workforce/shifts/${encodeURIComponent(event.shift_id)}/clock-events`, {
        method: 'POST',
        body: JSON.stringify({
          event_type: event.event_type,
          client_event_id: event.client_event_id,
          occurred_at: event.occurred_at,
          source: event.source,
        }),
      });
      remaining.shift();
      localStorage.setItem(workerClockQueueKey(), JSON.stringify(remaining));
    } catch (error) {
      state.workerClockQueueError = `Clock-event sync stopped to preserve event order: ${error.message}`;
      break;
    }
  }
}

function renderWorkerPortal() {
  const wrap = node('div');
  wrap.append(sectionHeading('Your work, reports and support', 'Manage shifts and time, employer-client engagement terms, activity reports and support.'));
  const settlementsUnavailable = state.workspaceDataErrors.includes('/staffing-settlements/mine')
    || state.workspaceDataOmitted.includes('/staffing-settlements/mine');

  const summary = node('section', undefined, 'stat-grid');
  const approvedPay = state.workerPortalReports
    .filter((report) => report.status === 'approved')
    .reduce((total, report) => total + Number(report.worker_amount), 0);
  const reconciledPayments = state.workerPortalSettlements
    .filter((settlement) => settlement.status === 'reconciled')
    .reduce((total, settlement) => total + Number(settlement.amount), 0);
  const summaryValues = [
    ['Engagements', state.workerPortalEngagements.length],
    ['Active assignments', state.workerPortalEngagements.filter((item) => item.status === 'active').length],
    ['Reports awaiting review', state.workerPortalReports.filter((item) => item.status === 'submitted').length],
    ['Approved work value · ETB', approvedPay.toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2 })],
  ];
  if (!settlementsUnavailable) {
    summaryValues.push(['Reconciled worker payments · ETB', reconciledPayments.toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2 })]);
  }
  for (const [label, value] of summaryValues) {
    const metric = node('article', undefined, 'stat-card');
    metric.append(node('span', label), node('strong', String(value)));
    summary.append(metric);
  }
  wrap.append(summary);

  const shifts = node('section', undefined, 'panel');
  shifts.append(sectionHeading('My shifts and attendance', 'Respond to assigned shifts and record your own clock events. Offline events are saved on this device and synced in order when connectivity returns.'));
  const clockQueue = readWorkerClockQueue();
  if (clockQueue.length) shifts.append(node('p', `${clockQueue.length} clock event${clockQueue.length === 1 ? '' : 's'} waiting to sync.`, 'muted'));
  if (state.workerClockQueueError) {
    const notice = node('p', state.workerClockQueueError, 'alert error');
    notice.setAttribute('role', 'alert');
    shifts.append(notice);
  }
  const shiftList = node('div', undefined, 'list');
  if (state.workspaceDataErrors.includes('/workforce/shifts/mine')) {
    shiftList.append(node('p', 'Your shift schedule could not be loaded. Use Refresh to try again.', 'alert error'));
  } else if (!state.workerPortalShifts.length) {
    shiftList.append(empty('No shifts are assigned to your worker account yet.'));
  }
  for (const shift of state.workerPortalShifts) {
    const item = card(
      `${shift.employer_client ?? 'Employer client'} · ${new Date(shift.starts_at).toLocaleString(document.documentElement.lang)}`,
      `${new Date(shift.starts_at).toLocaleString(document.documentElement.lang)} to ${new Date(shift.ends_at).toLocaleString(document.documentElement.lang)} · ${WORKER_TYPE_LABELS[shift.worker_type] ?? shift.worker_type} · attendance ${shift.time_status ?? 'not recorded'}${shift.exception_reason ? ` · ${shift.exception_reason}` : ''}`,
      shift.status,
    );
    if (shift.worker_response === 'pending' && shift.status === 'scheduled') {
      item.append(
        button('Accept shift', 'workforce-shift-response', 'button button-primary', { id: shift.id, response: 'accepted' }),
        button('Decline shift', 'workforce-shift-response', 'button button-outline', { id: shift.id, response: 'declined' }),
      );
    }
    if (shift.worker_response === 'accepted' && shift.status === 'scheduled') {
      const pending = readWorkerClockQueue().filter((event) => event.shift_id === shift.id);
      const hasClockIn = Boolean(shift.clock_in_at) || pending.some((event) => event.event_type === 'clock_in');
      const hasClockOut = Boolean(shift.clock_out_at) || pending.some((event) => event.event_type === 'clock_out');
      if (!hasClockIn) item.append(button('Clock in', 'workforce-clock', 'button button-primary', { id: shift.id, eventType: 'clock_in' }));
      else if (!hasClockOut) item.append(button('Clock out', 'workforce-clock', 'button button-primary', { id: shift.id, eventType: 'clock_out' }));
      if (pending.length) item.append(node('p', `${pending.length} clock event${pending.length === 1 ? '' : 's'} waiting to sync for this shift.`, 'muted'));
    }
    if (shift.worker_response === 'accepted' && shift.status !== 'cancelled'
      && shift.time_status !== 'exported' && new Date(shift.ends_at).getTime() <= Date.now()) {
      const correctionForm = node('form', undefined, 'panel form-card inline-form');
      correctionForm.dataset.form = 'workforce-correction';
      correctionForm.dataset.shift = shift.id;
      correctionForm.append(node('h4', 'Request a time correction'));
      correctionForm.append(
        field('Correct clock-in time (optional)', 'proposed_clock_in_at', 'datetime-local').label,
        field('Correct clock-out time (optional)', 'proposed_clock_out_at', 'datetime-local').label,
        field('Explain the correction', 'reason', 'textarea', true, { minlength: 10, maxlength: 1000, rows: 2 }).label,
        button('Send correction for review', 'submit', 'button button-outline'),
      );
      item.append(correctionForm);
    }
    if (shift.latest_correction_status) {
      item.append(node('p', `Latest correction: ${shift.latest_correction_status}${shift.latest_correction_reason ? ` · ${shift.latest_correction_reason}` : ''}`, 'muted'));
    }
    shiftList.append(item);
  }
  shifts.append(shiftList);
  wrap.append(shifts);

  const leave = node('section', undefined, 'panel');
  leave.append(sectionHeading('Leave and availability', 'Submit time-away requests for review. Employees request leave; hourly professionals and contracted providers request availability changes.'));
  const activeEngagements = state.workerPortalEngagements.filter((engagement) => engagement.status === 'active');
  if (activeEngagements.length) {
    const leaveForm = node('form', undefined, 'panel form-card inline-form');
    leaveForm.dataset.form = 'workforce-leave';
    const engagementField = field('Active engagement', 'engagement_id', 'select', true);
    for (const engagement of activeEngagements) {
      const option = node('option', `${engagement.employer_client ?? 'Employer client'} · ${WORKER_TYPE_LABELS[engagement.worker_type] ?? engagement.worker_type}`);
      option.value = engagement.id;
      engagementField.input.append(option);
    }
    leaveForm.append(
      engagementField.label,
      field('Start date', 'starts_on', 'date', true).label,
      field('End date', 'ends_on', 'date', true).label,
      field('Reason or availability details', 'reason', 'textarea', true, { minlength: 10, maxlength: 2000, rows: 3 }).label,
      button('Submit for review', 'submit', 'button button-primary'),
    );
    leave.append(leaveForm);
  } else {
    leave.append(empty('An active engagement is required to submit a leave or availability request.'));
  }
  const leaveList = node('div', undefined, 'list');
  if (!state.workerPortalLeave.length) leaveList.append(empty('Your leave and availability requests will appear here.'));
  for (const request of state.workerPortalLeave) {
    const item = card(`${request.request_type === 'leave' ? 'Leave' : 'Availability'} · ${request.starts_on} to ${request.ends_on}`,
      `${request.reason}${request.review_reason ? ` · Review: ${request.review_reason}` : ''}`, request.status);
    if (request.status === 'submitted') item.append(button('Withdraw request', 'workforce-leave-withdraw', 'button button-outline', { id: request.id }));
    leaveList.append(item);
  }
  leave.append(leaveList);
  wrap.append(leave);

  const payroll = node('section', undefined, 'panel');
  payroll.append(sectionHeading('Payroll handoff status', 'These statuses show whether AfroLife generated an export or recorded an external handoff. They are not payslips and do not confirm payment.'));
  const payrollList = node('div', undefined, 'list');
  if (!state.workerPortalPayrollExports.length) payrollList.append(empty('No payroll handoff records are available for your approved time yet.'));
  for (const record of state.workerPortalPayrollExports) {
    payrollList.append(card(
      `${record.period_start} to ${record.period_end} · ${record.mapping_version}`,
      `${record.handoff_reason ?? 'No handoff note recorded'}${record.handoff_reference ? ` · reference ${record.handoff_reference}` : ''}${record.handed_off_at ? ` · recorded ${new Date(record.handed_off_at).toLocaleString(document.documentElement.lang)}` : ''}`,
      record.status,
    ));
  }
  payroll.append(payrollList);
  wrap.append(payroll);

  const offers = node('section', undefined, 'panel');
  offers.append(sectionHeading('My employer-client engagements', 'Review approved terms before accepting. Work starts after both the worker and employer client accept.'));
  const engagementList = node('div', undefined, 'list');
  if (!state.workerPortalEngagements.length) engagementList.append(empty('No staffing offers or engagements are linked to your worker account yet.'));
  for (const engagement of state.workerPortalEngagements) {
    const typeLabel = WORKER_TYPE_LABELS[engagement.worker_type] ?? 'Employment type not recorded';
    const item = card(
      `${engagement.employer_client ?? 'Employer client'} · ${typeLabel}`,
      `ETB ${Number(engagement.worker_rate).toLocaleString(document.documentElement.lang)} per ${engagement.billing_unit} · ${engagement.starts_on}${engagement.ends_on ? ` to ${engagement.ends_on}` : ''} · client ${engagement.client_accepted ? 'accepted' : 'pending'} · worker ${engagement.worker_accepted ? 'accepted' : 'pending'}`,
      engagement.status,
    );
    if (engagement.status === 'terms_approved' && !engagement.worker_accepted) {
      item.append(button('Review and accept terms', 'staffing-engagement-accept', 'button button-primary', { id: engagement.id }));
    }
    if (engagement.status === 'active') {
      const form = node('form', undefined, 'panel form-card inline-form');
      form.dataset.form = 'staffing-work-period';
      form.dataset.engagement = engagement.id;
      form.append(node('h4', 'Submit a work activity report'));
      form.append(
        field('Period start', 'period_start', 'date').label,
        field('Period end', 'period_end', 'date').label,
        field(`Quantity (${engagement.billing_unit})`, 'quantity', 'number', true, { min: '0.01', step: '0.01' }).label,
        field('Describe the work completed', 'description', 'textarea', true, { minlength: 5, maxlength: 1000, rows: 3 }).label,
        button('Submit report for review', 'submit', 'button button-primary'),
      );
      item.append(form);
    }
    engagementList.append(item);
  }
  offers.append(engagementList);
  wrap.append(offers);

  const reports = node('section', undefined, 'panel');
  reports.append(sectionHeading('My activity and earnings reports', 'Submitted work is reviewed independently. Approved work value is not confirmation that a payment has been made.'));
  reports.append(node('p', 'Filters and exports include the 200 most recent reports currently loaded.', 'muted'));
  const reportFilters = node('form', undefined, 'form-card inline-form');
  reportFilters.dataset.form = 'worker-report-filters';
  const reportStatus = field('Status', 'status', 'select', false);
  for (const [value, label] of [
    ['all', 'All statuses'],
    ['submitted', 'Submitted'],
    ['approved', 'Approved'],
    ['rejected', 'Returned'],
  ]) {
    const option = node('option', label);
    option.value = value;
    option.selected = state.workerReportFilters.status === value;
    reportStatus.input.append(option);
  }
  reportFilters.append(
    field('Period start', 'start_date', 'date', false, { value: state.workerReportFilters.startDate }).label,
    field('Period end', 'end_date', 'date', false, { value: state.workerReportFilters.endDate }).label,
    reportStatus.label,
    button('Filter reports', 'submit', 'button button-outline'),
    button('Download CSV', 'worker-report-export', 'button button-outline'),
  );
  reports.append(reportFilters);
  const reportList = node('div', undefined, 'list');
  const visibleReports = filterWorkerActivityReports(state.workerPortalReports, state.workerReportFilters);
  if (!visibleReports.length) {
    reportList.append(empty(state.workerPortalReports.length
      ? 'No reports match the selected filters.'
      : 'Work reports you submit for an active engagement will appear here.'));
  }
  for (const report of visibleReports) {
    const item = card(
      `${report.period_start} to ${report.period_end} · ${report.quantity} units`,
      `${report.description} · ETB ${Number(report.worker_amount).toLocaleString(document.documentElement.lang)} worker amount${report.review_reason ? ` · ${report.review_reason}` : ''}`,
      report.status,
    );
    reportList.append(item);
  }
  reports.append(reportList);
  wrap.append(reports);

  const payments = node('section', undefined, 'panel');
  payments.append(sectionHeading('Worker payment records', 'Finance reconciliation records are shown separately from approved work reports. These records are not payslips or payroll exports.'));
  const paymentList = node('div', undefined, 'list');
  if (settlementsUnavailable) {
    const notice = node('p', 'Worker payment records could not be loaded. Select Refresh to try again.', 'alert error');
    notice.setAttribute('role', 'alert');
    paymentList.append(notice);
  } else if (!state.workerPortalSettlements.length) {
    paymentList.append(empty('No worker payment records are available yet.'));
  }
  for (const settlement of state.workerPortalSettlements) {
    const item = card(
      t('ETB {{amount}} · {{date}}', {
        amount: Number(settlement.amount).toLocaleString(document.documentElement.lang, { minimumFractionDigits: 2 }),
        date: settlement.payment_date,
      }),
      [
        t('{{channel}} · reference {{reference}}', { channel: settlement.channel, reference: settlement.reference }),
        settlement.reason ? t('Review note: {{reason}}', { reason: settlement.reason }) : null,
        settlement.reconciled_at ? t('Reconciled {{date}}', {
          date: new Date(settlement.reconciled_at).toLocaleDateString(document.documentElement.lang),
        }) : null,
      ].filter(Boolean).join(' · '),
      settlement.status,
    );
    paymentList.append(item);
  }
  payments.append(paymentList);
  wrap.append(payments);

  const support = node('section', undefined, 'panel');
  support.append(sectionHeading('AfroLife worker support', 'Ask for help with an assignment, contract terms, work reports or pay, safety, or another work-related concern.'));
  const supportForm = node('form', undefined, 'panel form-card inline-form');
  supportForm.dataset.form = 'worker-support';
  const category = field('Support topic', 'category', 'select');
  for (const [value, label] of [
    ['work_assignment', 'Work assignment'],
    ['contract_terms', 'Contract terms'],
    ['work_report_or_pay', 'Work report or pay'],
    ['safety_and_wellbeing', 'Safety and wellbeing'],
    ['other', 'Other'],
  ]) {
    const option = node('option', label);
    option.value = value;
    category.input.append(option);
  }
  supportForm.append(
    category.label,
    field('Subject', 'subject', 'text', true, { minlength: 3, maxlength: 160 }).label,
    field('How can we help?', 'description', 'textarea', true, { minlength: 10, maxlength: 4000, rows: 4 }).label,
    button('Send support request', 'submit', 'button button-primary'),
  );
  support.append(supportForm);
  const ticketList = node('div', undefined, 'list');
  if (!state.workerSupportRequests.length) ticketList.append(empty('Your support requests and replies will appear here.'));
  for (const request of state.workerSupportRequests) {
    const item = card(request.subject, `${request.category.replaceAll('_', ' ')} · ${request.description}${request.response ? ` · AfroLife response: ${request.response}` : ''}`, request.status);
    ticketList.append(item);
  }
  support.append(ticketList);
  wrap.append(support);
  return wrap;
}

function renderWorkerSupportQueue() {
  const section = node('section', undefined, 'panel');
  section.append(sectionHeading('Worker support queue', 'Respond to worker requests and record the current resolution status.'));
  const list = node('div', undefined, 'list');
  if (!state.workerSupportQueue.length) list.append(empty('There are no worker support requests in the queue.'));
  for (const request of state.workerSupportQueue) {
    const item = card(
      request.subject,
      `${request.legal_name} · ${request.phone} · ${request.category.replaceAll('_', ' ')} · ${request.description}${request.response ? ` · latest response: ${request.response}` : ''}`,
      request.status,
    );
    if (request.status !== 'resolved') {
      item.append(
        button('Reply and keep open', 'worker-support-respond', 'button button-outline', { id: request.id, status: 'in_progress' }),
        button('Reply and resolve', 'worker-support-respond', 'button button-primary', { id: request.id, status: 'resolved' }),
      );
    }
    list.append(item);
  }
  section.append(list);
  return section;
}

function renderWorkforceOperations() {
  const wrap = node('div');
  wrap.append(sectionHeading('Workforce operations', 'Schedule accepted engagements, review attendance and leave, maintain labor-policy evidence, and record payroll handoff status.'));
  if (hasActivity('workforce.shifts.manage')) {
    const shifts = node('section', undefined, 'panel');
    shifts.append(sectionHeading('Shift scheduling', 'Assign shifts only to active worker engagements. Workers must accept a shift before clocking.'));
    const scheduleForm = node('form', undefined, 'panel form-card inline-form');
    scheduleForm.dataset.form = 'workforce-shift';
    const engagement = field('Active engagement', 'engagement_id', 'select', true);
    for (const record of state.workforceEngagements) {
      const option = node('option', `${record.worker_name} · ${record.employer_client ?? 'Employer client'} · ${WORKER_TYPE_LABELS[record.worker_type] ?? record.worker_type} · worker ETB ${Number(record.worker_rate).toLocaleString(document.documentElement.lang)} per ${record.billing_unit}`);
      option.value = record.id;
      engagement.input.append(option);
    }
    scheduleForm.append(engagement.label,
      field('Shift starts', 'starts_at', 'datetime-local', true).label,
      field('Shift ends', 'ends_at', 'datetime-local', true).label,
      button('Schedule shift', 'submit', 'button button-primary'));
    if (!state.workforceEngagements.length) scheduleForm.append(empty('No active worker engagements are available for scheduling.'));
    shifts.append(scheduleForm);
    const list = node('div', undefined, 'list');
    if (!state.workforceShifts.length) list.append(empty('No workforce shifts are scheduled.'));
    for (const shift of state.workforceShifts) {
      const item = card(
        `${shift.worker_name} · ${shift.employer_client ?? 'Employer client'} · ${new Date(shift.starts_at).toLocaleString(document.documentElement.lang)}`,
        `${new Date(shift.starts_at).toLocaleString(document.documentElement.lang)} to ${new Date(shift.ends_at).toLocaleString(document.documentElement.lang)} · ${WORKER_TYPE_LABELS[shift.worker_type] ?? shift.worker_type} · worker ${shift.worker_response} · attendance ${shift.time_status ?? 'not recorded'}${shift.exception_reason ? ` · ${shift.exception_reason}` : ''}`,
        shift.status,
      );
      item.append(node('p', shift.scheduled_labor_cost_estimate == null
        ? `Worker rate ETB ${Number(shift.worker_rate).toLocaleString(document.documentElement.lang)} per ${shift.billing_unit}. Scheduled cost is not estimated for this billing unit.`
        : `Estimated scheduled direct labor cost ETB ${Number(shift.scheduled_labor_cost_estimate).toLocaleString(document.documentElement.lang)} at ETB ${Number(shift.worker_rate).toLocaleString(document.documentElement.lang)} per hour. This is a schedule estimate, not approved or payable time.`,'muted'));
      if (shift.status === 'scheduled' && !shift.time_entry_id) item.append(button('Cancel shift', 'workforce-shift-cancel', 'button button-outline', { id: shift.id }));
      list.append(item);
    }
    shifts.append(list);
    wrap.append(shifts);
  }
  if (hasActivity('workforce.time.review')) {
    const review = node('section', undefined, 'panel');
    review.append(sectionHeading('Attendance exceptions and approvals', 'Clock events remain unchanged. Corrections are separately reviewed, and approved time remains distinct from payable time.'));
    const list = node('div', undefined, 'list');
    if (!state.workforceTimeQueue.length) list.append(empty('There are no attendance exceptions or pending corrections.'));
    for (const entry of state.workforceTimeQueue) {
      const item = card(
        `${entry.worker_name} · ${entry.employer_client ?? 'Employer client'} · ${new Date(entry.starts_at).toLocaleString(document.documentElement.lang)}`,
        `Clock in ${entry.clock_in_at ? new Date(entry.clock_in_at).toLocaleString(document.documentElement.lang) : 'missing'} · clock out ${entry.clock_out_at ? new Date(entry.clock_out_at).toLocaleString(document.documentElement.lang) : 'missing'}${entry.exception_reason ? ` · ${entry.exception_reason}` : ''}${entry.correction_reason ? ` · Correction: ${entry.correction_reason}` : ''}${entry.proposed_clock_in_at ? ` · Proposed clock-in: ${new Date(entry.proposed_clock_in_at).toLocaleString(document.documentElement.lang)}` : ''}${entry.proposed_clock_out_at ? ` · Proposed clock-out: ${new Date(entry.proposed_clock_out_at).toLocaleString(document.documentElement.lang)}` : ''}`,
        entry.correction_status === 'pending' ? 'correction pending' : entry.time_status ?? 'needs review',
      );
      if (entry.correction_id && entry.correction_status === 'pending') {
        item.append(
          button('Approve correction', 'workforce-correction-decision', 'button button-primary', { id: entry.correction_id, decision: 'approve' }),
          button('Reject correction', 'workforce-correction-decision', 'button button-outline', { id: entry.correction_id, decision: 'reject' }),
        );
      }
      if (entry.shift_status === 'scheduled' && new Date(entry.ends_at).getTime() <= Date.now()) {
        item.append(button('Approve attendance', 'workforce-time-approve', 'button button-primary', { id: entry.shift_id }));
      }
      list.append(item);
    }
    review.append(list);
    wrap.append(review);
  }
  if (hasActivity('workforce.leave.review')) {
    const leave = node('section', undefined, 'panel');
    leave.append(sectionHeading('Leave and availability review', 'Record a reason for every decision.'));
    const list = node('div', undefined, 'list');
    if (!state.workforceLeaveQueue.length) list.append(empty('There are no submitted leave or availability requests.'));
    for (const request of state.workforceLeaveQueue) {
      const item = card(
        `${request.worker_name} · ${request.employer_client ?? 'Employer client'} · ${request.request_type} · ${request.starts_on} to ${request.ends_on}`,
        request.reason,
        request.status,
      );
      item.append(
        button('Approve', 'workforce-leave-decision', 'button button-primary', { id: request.id, decision: 'approve' }),
        button('Reject', 'workforce-leave-decision', 'button button-outline', { id: request.id, decision: 'reject' }),
      );
      list.append(item);
    }
    leave.append(list);
    wrap.append(leave);
  }
  if (hasActivity('workforce.policy.manage')) {
    const policies = node('section', undefined, 'panel');
    policies.append(sectionHeading('Effective-dated workforce policies', 'Record the policy citation and test evidence. Compliance approval is independent from policy creation.'));
    const policyForm = node('form', undefined, 'panel form-card inline-form');
    policyForm.dataset.form = 'workforce-policy';
    policyForm.append(
      field('Policy version', 'policy_version', 'text', true, { maxlength: 80 }).label,
      field('Jurisdiction', 'jurisdiction', 'text', true, { maxlength: 80, value: 'Ethiopia' }).label,
      field('Legal citation', 'citation', 'textarea', true, { minlength: 10, maxlength: 2000, rows: 2 }).label,
      field('Effective from', 'effective_from', 'date', true).label,
      field('Effective to (optional)', 'effective_to', 'date').label,
      field('Daily warning threshold (minutes)', 'warning_daily_minutes', 'number', true, { min: 1, step: 1 }).label,
      field('Weekly warning threshold (minutes)', 'warning_weekly_minutes', 'number', true, { min: 1, step: 1 }).label,
      field('Test evidence', 'test_evidence', 'textarea', true, { minlength: 10, maxlength: 4000, rows: 3 }).label,
      button('Save policy draft', 'submit', 'button button-primary'),
    );
    policies.append(policyForm);
    const list = node('div', undefined, 'list');
    if (!state.workforcePolicies.length) list.append(empty('No workforce policies are recorded yet.'));
    for (const policy of state.workforcePolicies) {
      const item = card(`${policy.policy_version} · ${policy.jurisdiction} · ${policy.effective_from}${policy.effective_to ? ` to ${policy.effective_to}` : ''}`,
        `${policy.citation} · daily warning ${policy.warning_daily_minutes} minutes · weekly warning ${policy.warning_weekly_minutes} minutes`, policy.status);
      if (policy.status === 'draft' && state.user.role === 'compliance') {
        item.append(button('Approve policy', 'workforce-policy-approve', 'button button-primary', { id: policy.id }));
      }
      list.append(item);
    }
    policies.append(list);
    wrap.append(policies);
  }
  if (hasActivity('workforce.payroll.export')) {
    const payroll = node('section', undefined, 'panel');
    payroll.append(sectionHeading('Payable time and payroll export', 'Thresholds are warnings, not automatic legal or payroll decisions. Generated files are encrypted; recording a handoff does not mean payroll was filed or paid.'));
    if (state.workforcePayableCalculation?.requestedBy === state.user.id
      && state.workforcePayableCalculation.calculated?.length) {
      const results = node('section', undefined, 'panel');
      results.append(sectionHeading(
        `Payable-time review · ${state.workforcePayableCalculation.period_start} to ${state.workforcePayableCalculation.period_end}`,
        'Review all threshold warnings before generating an export.',
      ));
      const resultList = node('div', undefined, 'list');
      for (const result of state.workforcePayableCalculation.calculated) {
        resultList.append(card(
          `${result.worker_name} · ${WORKER_TYPE_LABELS[result.worker_type] ?? result.worker_type} · ${new Date(result.shift_start).toLocaleString(document.documentElement.lang)}`,
          `${result.payable_minutes} payable minutes · ${result.policy_warnings.length ? result.policy_warnings.map((warning) => warning.replaceAll('_', ' ')).join(', ') : 'No warning thresholds exceeded'}`,
          result.policy_warnings.length ? 'warning' : 'calculated',
        ));
      }
      results.append(resultList);
      if (state.workforcePayableCalculation.has_more) {
        results.append(node('p', t('More attendance rows remain in this period. Continue with the next batch.'), 'muted'));
        results.append(button('Calculate next payable-time batch', 'workforce-payable-next-batch', 'button button-outline', {
          periodStart: state.workforcePayableCalculation.period_start,
          periodEnd: state.workforcePayableCalculation.period_end,
        }));
      }
      payroll.append(results);
    }
    const calculateForm = node('form', undefined, 'panel form-card inline-form');
    calculateForm.dataset.form = 'workforce-payable-calc';
    calculateForm.append(
      field('Period start', 'period_start', 'date', true).label,
      field('Period end', 'period_end', 'date', true).label,
      button('Calculate payable time', 'submit', 'button button-outline'),
    );
    const exportForm = node('form', undefined, 'panel form-card inline-form');
    exportForm.dataset.form = 'workforce-payroll-export';
    exportForm.append(
      field('Period start', 'period_start', 'date', true).label,
      field('Period end', 'period_end', 'date', true).label,
      field('Payroll mapping version', 'mapping_version', 'text', true, { maxlength: 80 }).label,
      button('Generate encrypted export', 'submit', 'button button-primary'),
    );
    payroll.append(calculateForm, exportForm);
    if (state.workforcePayrollExportBatch?.requestedBy === state.user.id
      && state.workforcePayrollExportBatch.has_more) {
      const nextExport = node('section', undefined, 'panel');
      nextExport.append(
        node('p', t('More payable rows remain in this period. Continue with the next encrypted export.'), 'muted'),
        button('Generate next encrypted export batch', 'workforce-payroll-next-batch', 'button button-outline', {
          periodStart: state.workforcePayrollExportBatch.period_start,
          periodEnd: state.workforcePayrollExportBatch.period_end,
          mappingVersion: state.workforcePayrollExportBatch.mapping_version,
        }),
      );
      payroll.append(nextExport);
    }
    const list = node('div', undefined, 'list');
    if (!state.workforcePayrollExports.length) list.append(empty('No payroll exports have been generated.'));
    for (const record of state.workforcePayrollExports) {
      const item = card(
        `${record.period_start} to ${record.period_end} · ${record.row_count} rows · ${record.total_payable_minutes} payable minutes`,
        `Control hash ${record.control_hash} · key ${record.encryption_key_id}${record.handoff_reason ? ` · ${record.handoff_reason}` : ''}${record.handoff_reference ? ` · reference ${record.handoff_reference}` : ''}`,
        record.status,
      );
      item.dataset.payrollExport = record.id;
      item.append(button('Download encrypted payload', 'workforce-payroll-download', 'button button-outline', { id: record.id }));
      item.append(button('View handoff history', 'workforce-payroll-events', 'button button-outline', { id: record.id }));
      item.append(button('Review export rows', 'workforce-payroll-items', 'button button-outline', { id: record.id }));
      if (record.status === 'handed_off' || record.status === 'handoff_failed') {
        item.append(button('Create retry for failed rows', 'workforce-payroll-requeue-failed-rows', 'button button-primary', { id: record.id }));
      }
      if (record.status !== 'handed_off') item.append(button('Record handoff status', 'workforce-payroll-handoff', 'button button-primary', { id: record.id }));
      list.append(item);
    }
    payroll.append(list);
    wrap.append(payroll);
  }
  return wrap;
}

function renderWorkers() {
  if (state.user.role === 'worker') return renderWorkerPortal();
  if (!hasActivity('workforce.workers.view') && !hasActivity('workforce.workers.register')
      && ['global_admin','super_admin','corporate_business_manager','master_agent'].includes(state.user.role)) {
    const supportWorkspace = node('div');
    supportWorkspace.append(sectionHeading('Worker support service', 'Review worker questions and follow up on work, contract, reporting and safety concerns.'));
    supportWorkspace.append(renderWorkerSupportQueue());
    return supportWorkspace;
  }
  const wrap = node('div');
  wrap.append(sectionHeading('Worker directory', 'Register potential workers. Compliance must verify required documents before matching.'));
  const metrics = workforceDashboardMetrics(state.workers);
  wrap.append(renderAppDashboard({
    title: 'Workforce Management dashboard',
    description: 'A summary of worker records available to your account. Counts use the currently loaded worker data only.',
    source: '/workers',
    metrics,
    statusTitle: 'Worker verification status',
    statuses: metrics.byVerification,
    emptyMessage: 'No worker records are currently available for this dashboard.',
    values: (data) => [['Registered workers', data.total]],
  }));
  if (hasActivity('workforce.documents.view')) {
    const expirySection = node('section', undefined, 'panel');
    expirySection.append(sectionHeading('Document expiry · next 30 days', 'Replace expired credentials promptly. A replacement becomes current only after a separate compliance review.'));
    if (!state.workerDocumentExpiry.length) expirySection.append(empty('No worker documents are expired or due to expire in the next 30 days.'));
    else {
      const expiryList = node('div', undefined, 'list');
      for (const documentRecord of state.workerDocumentExpiry) {
        const item = card(documentRecord.worker_name, `${documentRecord.doc_type.replaceAll('_', ' ')} · ${documentRecord.expiry_state} · ${documentRecord.expires_on}`, documentRecord.expiry_state);
        item.append(button('Open worker documents', 'worker-documents', 'button button-outline', { id: documentRecord.worker_id }));
        expiryList.append(item);
      }
      expirySection.append(expiryList);
    }
    wrap.append(expirySection);
  }
  const columns = node('div', undefined, 'columns');
  const form = node('form', undefined, 'panel form-card inline-form');
  form.dataset.form = 'worker';
  const title = node('h3', 'Add a worker');
  title.className = 'span-2';
  form.append(title);
  form.append(field('Full name', 'name').label, field('Phone', 'phone', 'tel', true, { placeholder: '0911 234 567' }).label);
  form.append(field('Service sector', 'sector').label, field('Expected monthly rate (ETB)', 'rate_expected', 'number', true, { min: '0', step: '0.01' }).label);
  form.append(field('Experience (years)', 'experience_years', 'number', false, { min: '0', step: '1', value: '0' }).label);
  const territory = field('Territory', 'territory_id', 'select');
  const emptyOption = node('option', 'Choose an area'); emptyOption.value = ''; emptyOption.disabled = true; emptyOption.selected = true; territory.input.append(emptyOption);
  for (const area of state.territories) {
    const option = node('option', area.name); option.value = area.id; territory.input.append(option);
  }
  form.append(territory.label);
  const skills = field('Skills (comma-separated)', 'skills', 'text', false, { placeholder: 'Cooking, cleaning' });
  form.append(skills.label);
  const languages = field('Languages (comma-separated)', 'languages', 'text', false, { placeholder: 'Amharic, English' });
  form.append(languages.label);
  const submit = button('Register worker', 'submit', 'button button-primary span-2');
  form.append(submit);
  const list = node('div', undefined, 'list');
  if (!state.workers.length) list.append(empty('Workers you register will appear here.'));
  for (const worker of state.workers) {
    const item = card(worker.name, t('{{sector}} · ETB {{rate}} · {{territory}}', {
      sector: worker.sector,
      rate: Number(worker.rate_expected).toLocaleString(document.documentElement.lang),
      territory: state.territories.find((area) => area.id === worker.territory_id)?.name ?? worker.territory_id,
    }), worker.employment_status === 'terminated' ? 'terminated' : worker.verification);
    if (hasActivity('workforce.documents.upload')) item.append(button('Upload documents', 'worker-upload', 'button button-outline', { id: worker.id }));
    if (hasActivity('workforce.documents.view')) {
      item.append(button('Documents', 'worker-documents', 'button button-outline', { id: worker.id }));
    }
    if (worker.verification !== 'verified' && hasActivity('workforce.workers.verify')) item.append(button('Verify worker', 'worker-verify', 'button button-primary', { id: worker.id }));
    if (worker.employment_status !== 'terminated' && hasActivity('workforce.workers.offboard')) {
      item.append(button('Offboard worker', 'workforce-worker-offboard', 'button button-outline', { id: worker.id }));
    }
    list.append(item);
  }
  columns.append(form, list);
  wrap.append(columns);
  if (['global_admin','super_admin','corporate_business_manager','master_agent'].includes(state.user.role)) {
    wrap.append(renderWorkerSupportQueue());
  }
  if (['workforce.shifts.manage','workforce.time.review','workforce.leave.review','workforce.payroll.export','workforce.policy.manage']
    .some((activity) => hasActivity(activity))) {
    wrap.append(renderWorkforceOperations());
  }
  return wrap;
}

function renderRequests() {
  const wrap = node('div');
  wrap.append(sectionHeading('Service requests & matching', 'Agents create demand; Super Admin reviews eligible, verified candidates and controls match decisions.'));
  const metrics = staffingDashboardMetrics(state.requests);
  wrap.append(renderAppDashboard({
    title: 'Staffing dashboard',
    description: 'A summary of staffing requests available to your account. Counts use the currently loaded request data only.',
    source: '/requests',
    metrics,
    statusTitle: 'Request status',
    statuses: metrics.byStatus,
    emptyMessage: 'No staffing requests are currently available for this dashboard.',
    values: (data) => [['Service requests', data.total]],
  }));
  const columns = node('div', undefined, 'columns');
  const form = node('form', undefined, 'panel form-card inline-form');
  form.dataset.form = 'request';
  const title = node('h3', 'Create a request'); title.className = 'span-2'; form.append(title);
  const leadField = field('Customer lead', 'lead_id', 'select');
  const optionEmpty = node('option', 'Choose a household or business lead'); optionEmpty.value = ''; optionEmpty.disabled = true; optionEmpty.selected = true; leadField.input.append(optionEmpty);
  for (const lead of state.leads.filter((item) => ['household','business'].includes(item.lead_type))) {
    const option = node('option', `${lead.name} · ${lead.phone}`); option.value = lead.id; leadField.input.append(option);
  }
  form.append(leadField.label, field('Service sector', 'sector').label);
  form.append(field('Skills to match', 'skills_required', 'text', false, { placeholder: 'Cooking, childcare' }).label, field('Languages to match', 'languages_required', 'text', false, { placeholder: 'Amharic' }).label);
  form.append(field('Minimum experience (years)', 'min_experience', 'number', false, { min: '0', value: '0' }).label, field('Monthly budget (ETB)', 'rate_offered', 'number', true, { min: '1', step: '0.01' }).label);
  const area = field('Territory', 'territory_id', 'select');
  const noArea = node('option', 'Choose an area'); noArea.value = ''; noArea.disabled = true; noArea.selected = true; area.input.append(noArea);
  for (const territory of state.territories) { const option = node('option', territory.name); option.value = territory.id; area.input.append(option); }
  form.append(area.label);
  const submit = button('Create request', 'submit', 'button button-primary span-2'); form.append(submit);
  form.hidden = !hasActivity('staffing.requests.manage');
  const list = node('div', undefined, 'list');
  if (!state.requests.length) list.append(empty('No service requests yet.'));
  for (const request of state.requests) {
    const item = card(request.sector, t('ETB {{rate}} · {{skills}} · {{status}}', {
      rate: Number(request.rate_offered).toLocaleString(document.documentElement.lang),
      skills: request.skills_required?.join(', ') || t('Open skills'),
      status: t(request.status),
    }), request.status);
    item.dataset.request = request.id;
    if (hasActivity('staffing.requests.manage') && request.status === 'open') item.append(button('Find candidates', 'candidates', 'button button-outline', { id: request.id }));
    if (hasActivity('staffing.requests.manage')) item.append(button('Matches', 'matches', 'button button-outline', { id: request.id }));
    list.append(item);
  }
  columns.append(form, list);
  wrap.append(columns);
  return wrap;
}

function createLearningForm(content = null) {
  const form = node('form', undefined, 'panel form-card inline-form learning-content-form');
  form.dataset.form = 'learning-content';
  if (content) form.dataset.content = content.id;
  form.append(node('h3', content ? 'Edit training content' : 'Publish training or support content'));
  const title = field('Title', 'title', 'text', true, { minlength: 3, maxlength: 200 });
  const summary = field('Summary', 'summary', 'textarea', true, { minlength: 5, maxlength: 1000, rows: 2 });
  const category = field('Category', 'category', 'select');
  for (const [value, label] of [
    ['workforce_onboarding', 'Workforce onboarding'], ['property_management', 'Property management'],
    ['tenant_support', 'Tenant support'], ['landlord_support', 'Landlord support'],
    ['buyer_support', 'Buyer support'], ['seller_support', 'Seller support'],
    ['agent_training', 'Agent training'], ['general_support', 'General support'],
  ]) {
    const option = node('option', label); option.value = value; category.input.append(option);
  }
  const type = field('Format', 'content_type', 'select');
  for (const [value, label] of [['video', 'Video'], ['tutorial', 'Tutorial'], ['article', 'Article']]) {
    const option = node('option', label); option.value = value; type.input.append(option);
  }
  const video = field('Video URL (HTTPS)', 'video_url', 'url', false, { placeholder: 'https://example.com/training.mp4' });
  const body = field('Tutorial or support notes', 'body', 'textarea', false, { maxlength: 20000, rows: 5 });
  const visibility = field('Publication status', 'status', 'select');
  for (const [value, label] of [['draft', 'Draft'], ['published', 'Published']]) {
    const option = node('option', label); option.value = value; visibility.input.append(option);
  }
  if (content) {
    title.input.value = content.title;
    summary.input.value = content.summary;
    category.input.value = content.category;
    type.input.value = content.content_type;
    video.input.value = content.video_url ?? '';
    body.input.value = content.body ?? '';
    visibility.input.value = content.status === 'published' ? 'published' : 'draft';
  }
  form.append(title.label, summary.label, category.label, type.label, video.label, body.label, visibility.label);
  const audiences = node('fieldset', undefined, 'learning-audiences');
  audiences.append(node('legend', 'Audience roles'));
  for (const [role, label] of [
    ['worker', 'Workers'], ['customer', 'Tenants and buyers'], ['property_owner', 'Landlords and sellers'],
    ['master_agent', 'Master Agents'], ['field_agent', 'Agents'], ['corporate_business_manager', 'Corporate Business Managers'],
    ['compliance', 'Compliance'], ['finance', 'Finance'], ['finance_manager', 'Finance managers'],
    ['global_admin', 'Global Admins'], ['super_admin', 'Super Admins'],
  ]) {
    const option = document.createElement('input');
    option.type = 'checkbox';
    option.name = 'audience_roles';
    option.value = role;
    option.checked = content ? content.audience_roles.includes(role) : ['worker', 'customer', 'property_owner', 'master_agent', 'field_agent'].includes(role);
    const labelElement = node('label', label, 'learning-audience-option');
    labelElement.prepend(option);
    audiences.append(labelElement);
  }
  form.append(audiences, button(content ? 'Save content changes' : 'Save training content', 'submit', 'button button-primary'));
  return form;
}

function renderLearning() {
  const wrap = node('div');
  wrap.append(sectionHeading('Training & support library', 'Role-targeted tutorials, videos, and practical guidance for workforce and property services.'));
  const manager = hasActivity('learning.content.manage');
  if (manager) wrap.append(createLearningForm());
  const list = node('div', undefined, 'list');
  if (!state.learningContent.length) list.append(empty('No training content is available for your role yet.'));
  for (const content of state.learningContent) {
    const item = card(content.title, content.summary, content.status);
    item.append(node('p', `${content.category.replaceAll('_', ' ')} · ${content.content_type} · For ${content.audience_roles.map(roleLabel).join(', ')}`));
    if (content.body) item.append(node('p', content.body, 'learning-content-body'));
    if (content.video_url) {
      const link = node('a', content.content_type === 'video' ? 'Open training video' : 'Open related video');
      link.href = content.video_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.referrerPolicy = 'no-referrer';
      item.append(link);
    }
    if (manager && content.status !== 'archived') {
      item.append(button('Edit', 'learning-edit', 'button button-outline', { id: content.id }));
      item.append(button('Archive', 'learning-archive', 'button button-outline', { id: content.id }));
    }
    list.append(item);
  }
  wrap.append(list);
  return wrap;
}

function propertyOfferSummary(property) {
  const periods = state.marketplaceConfig.rentals?.periods ?? [];
  return propertyOfferTerms(property).map((term) => {
    const amount = term.amount == null ? null : Number(term.amount).toLocaleString(document.documentElement.lang);
    if (term.type === 'sale') return t('For sale · ETB {{amount}}', { amount });
    if (amount == null) return t('For rent · Price on request');
    const period = t(periods.find((item) => item.key === term.period)?.label ?? term.period);
    return t('For rent from ETB {{amount}} / {{period}}', { amount, period });
  }).join(' · ');
}

function renderPropertyListings(canManage, emptyMessage = 'No property listings yet. Add a property to start the listing.') {
  const listings = node('div', undefined, 'list property-list');
  if (!state.properties.length) listings.append(empty(emptyMessage));
  for (const property of state.properties) {
    const details = t('{{type}} · {{territory}} · {{units}} units', {
      type: t(property.ptype.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')),
      territory: state.territories.find((area) => area.id === property.territory_id)?.name ?? property.territory_id,
      units: property.units?.length ?? 0,
    });
    const reviewStatus = property.listing_review_status ?? 'approved';
    const statusLabel = reviewStatus === 'pending_review'
      ? 'Pending review'
      : reviewStatus === 'rejected' ? 'Changes requested' : property.status;
    const authorityStatus = property.authority_review_status;
    const itemStatus = authorityStatus
      ? `${t(statusLabel)} · ${t('Authority')}: ${t(authorityStatus.replaceAll('_', ' '))}`
      : t(statusLabel);
    const item = card(property.address, [details, propertyOfferSummary(property)].filter(Boolean).join(' · '), itemStatus);
    item.classList.add('property-card');
    item.dataset.property = property.id;
    if (property.listing_review_note) item.append(node('p', property.listing_review_note, 'form-error'));
    if (property.authority_review_note) item.append(node('p', property.authority_review_note, 'form-error'));
    if (property.authority_evidence?.length) {
      const evidenceList = node('div', undefined, 'list property-authority-evidence');
      evidenceList.append(node('h4', 'Authority evidence'));
      for (const evidence of property.authority_evidence) {
        evidenceList.append(button(
          `${evidence.evidence_type.replaceAll('_', ' ')} · ${new Date(evidence.created_at).toLocaleDateString(document.documentElement.lang)}`,
          'property-authority-file',
          'button button-outline',
          { id: property.id, evidence: evidence.id },
        ));
      }
      item.append(evidenceList);
    }
    if (canManage && authorityStatus && authorityStatus !== 'approved') {
      const evidenceDetails = node('details', undefined, 'property-authority-submit');
      evidenceDetails.append(node('summary', 'Submit ownership or delegated-authority evidence'));
      const evidenceForm = node('form', undefined, 'inline-form');
      evidenceForm.dataset.form = 'property-authority-evidence';
      evidenceForm.dataset.property = property.id;
      const evidenceType = field('Evidence type', 'evidence_type', 'select', true);
      evidenceType.input.append(
        new Option('Ownership or seller authority', 'ownership_authority'),
        new Option('Delegated authority to list', 'delegated_authority'),
      );
      evidenceForm.append(
        evidenceType.label,
        field('Evidence document (PDF, JPEG or PNG · max 10 MB)', 'evidence_file', 'file', true, {
          accept: 'application/pdf,image/jpeg,image/png',
        }).label,
        button('Upload evidence', 'submit', 'button button-primary'),
      );
      evidenceDetails.append(evidenceForm);
      if (['needs_info', 'rejected'].includes(authorityStatus)) {
        evidenceDetails.append(button('Resubmit for authority review', 'property-authority-resubmit', 'button button-outline', { id: property.id }));
      }
      item.append(evidenceDetails);
    }
    if (property.units?.length) {
      const unitSummary = node('p', property.units.map((unit) => `${unit.unit_no} · ${unit.occupancy}${unit.rent == null ? '' : ` · ETB ${Number(unit.rent).toLocaleString(document.documentElement.lang)}`}`).join('  |  '));
      unitSummary.className = 'property-unit-summary';
      item.append(unitSummary);
    }
    if (state.user.role === 'customer' && property.status === 'available'
      && reviewStatus === 'approved' && ['rent', 'sale_or_rent'].includes(property.listing_mode)
      && (!property.units?.length || property.units.some((unit) => unit.occupancy === 'vacant'))) {
      const existing = state.rentalApplications.find((application) => application.property_id === property.id
        && ['submitted', 'needs_info', 'accepted'].includes(application.status));
      if (existing) {
        item.append(node('p', `Rental application: ${existing.status.replaceAll('_', ' ')}`, 'muted'));
      } else {
        const form = node('form', undefined, 'inline-form rental-application-form');
        form.dataset.form = 'rental-application';
        form.dataset.property = property.id;
        form.append(node('h4', 'Apply to rent this property'));
        if (property.units?.length) {
          const unit = field('Available unit', 'unit_id', 'select', true);
          unit.input.append(new Option('Choose a vacant unit', ''));
          for (const entry of property.units.filter((candidate) => candidate.occupancy === 'vacant')) {
            unit.input.append(new Option(`${entry.unit_no}${entry.rent == null ? '' : ` · ETB ${Number(entry.rent).toLocaleString()}`}`, entry.id));
          }
          form.append(unit.label);
        }
        form.append(field('Message to the landlord or listing Agent', 'applicant_message', 'textarea', true, {
          minlength: 10, maxlength: 2000, rows: 3,
        }).label);
        const consent = node('label', 'I agree to share my account name and this message with the listing landlord or Agent to review my application.');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'contact_consent';
        checkbox.value = 'true';
        checkbox.required = true;
        consent.prepend(checkbox);
        form.append(consent, button('Submit rental application', 'submit', 'button button-primary'));
        item.append(form);
      }
    }
    const actions = node('div', undefined, 'property-actions');
    actions.append(button('Photos & video', 'property-photos', 'button button-outline', { id: property.id }));
    if (canManage) actions.append(
      button('Add unit', 'property-units', 'button button-outline', { id: property.id }),
      button('Add media', 'property-upload', 'button button-outline', { id: property.id }),
    );
    if (hasActivity('property.maintenance.manage')) for (const unit of property.units ?? []) {
      if (unit.occupancy === 'turnover') actions.append(button(
        `Complete turnover · ${unit.unit_no}`,
        'property-turnover-complete',
        'button button-outline',
        { id: property.id, unit: unit.id },
      ));
    }
    if (authorityStatus === 'pending_review'
      && ['global_admin', 'super_admin', 'corporate_business_manager'].includes(state.user.role)
      && property.created_by !== state.user.id
      && property.authority_evidence?.length) {
      actions.append(
        button('Approve authority', 'property-authority-review', 'button button-primary', { id: property.id, decision: 'approve' }),
        button('Request more evidence', 'property-authority-review', 'button button-outline', { id: property.id, decision: 'needs_info' }),
        button('Reject authority evidence', 'property-authority-review', 'button button-outline', { id: property.id, decision: 'reject' }),
      );
    }
    if (reviewStatus === 'pending_review'
      && ['global_admin', 'super_admin', 'corporate_business_manager'].includes(state.user.role)
      && property.created_by !== state.user.id) {
      actions.append(
        button('Approve listing', 'property-review', 'button button-primary', { id: property.id, decision: 'approve' }),
        button('Return listing for changes', 'property-review', 'button button-outline', { id: property.id, decision: 'reject' }),
      );
    }
    if (reviewStatus === 'rejected' && property.created_by === state.user.id && canManage) {
      const form = node('form', undefined, 'inline-form property-resubmit');
      form.dataset.form = 'property-resubmit';
      form.dataset.property = property.id;
      const address = field('Street address', 'address');
      address.input.value = property.address;
      const description = field('Description', 'description', 'textarea', false, { maxlength: 5000, rows: 3 });
      description.input.value = property.description ?? '';
      const listingMode = field('Listing transaction', 'listing_mode', 'select');
      for (const [value, label] of [['sale', 'For sale'], ['rent', 'For rent'], ['sale_or_rent', 'Sale or rent']]) {
        const option = node('option', label);
        option.value = value;
        listingMode.input.append(option);
      }
      listingMode.input.value = property.listing_mode;
      const salePrice = field('Sale price (ETB)', 'sale_price', 'number', false, { min: 0.01, step: '0.01' });
      salePrice.input.value = property.sale_price ?? '';
      const rentPeriod = field('Rental period', 'rent_period', 'select', false);
      for (const item of state.marketplaceConfig.rentals?.periods ?? [{ key: 'month', label: 'Monthly', enabled: true }]) {
        if (!item.enabled) continue;
        const option = node('option', item.label);
        option.value = item.key;
        rentPeriod.input.append(option);
      }
      rentPeriod.input.value = property.rent_period ?? 'month';
      const syncOfferFields = () => {
        const includesSale = listingMode.input.value !== 'rent';
        salePrice.label.hidden = !includesSale;
        salePrice.input.disabled = !includesSale;
        salePrice.input.required = includesSale;
        if (!includesSale) salePrice.input.value = '';
      };
      listingMode.input.addEventListener('change', syncOfferFields);
      syncOfferFields();
      form.append(address.label, description.label, listingMode.label, salePrice.label, rentPeriod.label);
      form.append(button('Update and resubmit for review', 'submit', 'button button-primary'));
      item.append(form);
    }
    item.append(actions);
    listings.append(item);
  }
  return listings;
}

function renderResidentPropertyPortal() {
  const workspace = state.residentPropertyWorkspace ?? { leases: [], charges: [], payments: [], maintenance: [] };
  const section = node('section', undefined, 'panel');
  section.append(
    sectionHeading('Resident self-service', 'View your linked lease, recorded charges and receipts, supporting documents, notices, and maintenance requests.'),
    node('p', 'AfroLife displays recorded operational information only. Payment records do not confirm that funds were paid to a landlord; tenant notices are not legal service or termination.', 'muted'),
  );
  if (!workspace.leases.length) {
    section.append(empty('No lease is linked to this account. Ask the property manager to issue a one-time access code, then claim it here.'));
    const claim = node('form', undefined, 'panel form-card inline-form');
    claim.dataset.form = 'resident-access-claim';
    claim.append(
      field('One-time resident access code', 'claim_code', 'text', true, { minlength: 64, maxlength: 64, autocomplete: 'one-time-code' }).label,
      button('Link my lease', 'submit', 'button button-primary'),
    );
    section.append(claim);
    return section;
  }
  const charges = new Map(workspace.leases.map((lease) => [lease.id, []]));
  for (const charge of workspace.charges) charges.get(charge.lease_id)?.push(charge);
  const payments = new Map(workspace.leases.map((lease) => [lease.id, []]));
  for (const payment of workspace.payments) payments.get(payment.lease_id)?.push(payment);
  for (const lease of workspace.leases) {
    const item = card(`${lease.address} · ${lease.unit_no}`,
      t('ETB {{rent}} rent · {{status}} · Lease {{start}} to {{end}} · Rent starts {{rentStart}}', {
        rent: Number(lease.rent).toLocaleString(document.documentElement.lang),
        status: t(lease.status), start: lease.start_date, end: lease.end_date, rentStart: lease.rent_start_on,
      }),
      lease.status);
    item.append(node('p', `Deposit recorded in lease: ETB ${Number(lease.deposit).toLocaleString(document.documentElement.lang)}. Key handover: ${lease.possession_handover_on ?? 'not recorded'}.`, 'muted'));
    for (const inspection of lease.move_out_inspections ?? []) {
      item.append(node('p',
        `Move-out inspection revision ${inspection.revision}: ${inspection.status} · vacated ${inspection.actual_vacated_on} · proposed deposit deduction ETB ${inspection.deposit_deduction}. ${inspection.review_note ?? ''}`,
        'muted'));
      for (const evidence of inspection.evidence ?? []) {
        item.append(button(`Download move-out evidence · ${evidence.mime}`, 'resident-move-out-evidence', 'button button-outline', {
          id: evidence.id,
        }));
      }
    }
    const leaseCharges = charges.get(lease.id) ?? [];
    const chargeSection = node('div', undefined, 'list');
    chargeSection.append(node('h4', 'Charges'));
    if (!leaseCharges.length) chargeSection.append(empty('No rent charges are recorded.'));
    for (const charge of leaseCharges) {
      chargeSection.append(node('p', `${charge.period} · ETB ${Number(charge.amount).toLocaleString(document.documentElement.lang)} · due ${charge.due_on} · ${charge.status}${charge.payment_ref ? ` · receipt ${charge.payment_ref}` : ''}`));
    }
    item.append(chargeSection);
    const leasePayments = payments.get(lease.id) ?? [];
    const paymentSection = node('div', undefined, 'list');
    paymentSection.append(node('h4', 'Recorded receipts'));
    if (!leasePayments.length) paymentSection.append(empty('No payment receipts are recorded.'));
    for (const payment of leasePayments) {
      paymentSection.append(node('p', `${payment.kind.replaceAll('_', ' ')} · ETB ${Number(payment.amount).toLocaleString(document.documentElement.lang)} · ${payment.status} · ${payment.reference} · ${new Date(payment.created_at).toLocaleDateString(document.documentElement.lang)}`));
    }
    item.append(paymentSection);
    if (lease.documents?.length) {
      const documents = node('div', undefined, 'list');
      documents.append(node('h4', 'Lease documents and signature evidence'));
      for (const document of lease.documents) {
        documents.append(button(`Download ${document.party} evidence · ${document.mime}`, 'resident-lease-document', 'button button-outline', {
          id: document.id,
        }));
      }
      documents.append(node('p', 'Signature files are retained as evidence only; they do not establish verified identity, provider-backed e-signature, or legal validity.', 'muted'));
      item.append(documents);
    } else item.append(node('p', 'No lease document is available yet.'));
    if (lease.notices?.length) {
      const notices = node('div', undefined, 'list');
      notices.append(node('h4', 'Operational notices'));
      for (const notice of lease.notices) notices.append(node('p',
        `${notice.notice_type.replaceAll('_', ' ')} · received ${notice.received_on} · proposed ${notice.proposed_effective_on} · ${notice.summary}`));
      item.append(notices);
    }
    for (const offer of lease.renewal_offers ?? []) {
      const offerItem = card(
        `Renewal offer · ETB ${Number(offer.proposed_rent).toLocaleString(document.documentElement.lang)} monthly`,
        `${offer.proposed_start_date} to ${offer.proposed_end_date} · expires ${offer.expires_on}`,
        offer.status,
      );
      offerItem.append(node('p', `Proposed deposit: ETB ${Number(offer.proposed_deposit).toLocaleString(document.documentElement.lang)} · ${offer.term_months} months · rent due day ${offer.due_day}.`));
      if (offer.request_reason) offerItem.append(node('p', `Request: ${offer.request_reason}`));
      if (offer.review_reason) offerItem.append(node('p', offer.review_reason));
      if (offer.response_note) offerItem.append(node('p', offer.response_note));
      for (const event of offer.events ?? []) {
        offerItem.append(node('p', `${event.event_type.replaceAll('_', ' ')} · ${new Date(event.created_at).toLocaleString(document.documentElement.lang)} · ${event.reason}`, 'muted'));
      }
      if (offer.status === 'offered' && offer.expires_on >= new Date().toISOString().slice(0, 10)) {
        offerItem.append(
          button('Accept renewal terms', 'renewal-response-accept', 'button button-primary', {
            id: offer.id, leaseId: lease.id,
          }),
          button('Decline renewal', 'renewal-response-decline', 'button button-outline', {
            id: offer.id, leaseId: lease.id,
          }),
        );
      }
      item.append(offerItem);
    }
    if (lease.status === 'active') {
      const noticeForm = node('form', undefined, 'inline-form');
      noticeForm.dataset.form = 'resident-lease-notice';
      noticeForm.dataset.lease = lease.id;
      noticeForm.append(
        node('h4', 'Send an operational notice to the property manager'),
        field('Proposed effective date', 'proposed_effective_on', 'date', true).label,
        field('Summary', 'summary', 'textarea', true, { minlength: 10, maxlength: 1000, rows: 3 }).label,
        button('Record tenant notice', 'submit', 'button button-outline'),
        node('p', 'This creates an operational record only. It does not verify legal service or change/end your lease.', 'muted'),
      );
      item.append(noticeForm);
      const maintenanceForm = node('form', undefined, 'inline-form');
      maintenanceForm.dataset.form = 'resident-maintenance';
      maintenanceForm.dataset.lease = lease.id;
      const category = field('Issue type', 'category', 'select');
      for (const [value, label] of [
        ['general','General'],['plumbing','Plumbing'],['electrical','Electrical'],['appliance','Appliance'],
        ['structural','Structural'],['cleaning','Cleaning'],['safety','Safety'],['other','Other'],
      ]) {
        const option = node('option', label);
        option.value = value;
        category.input.append(option);
      }
      const priority = field('Priority', 'priority', 'select');
      for (const [value, label] of [['normal','Normal'],['low','Low'],['urgent','Urgent']]) {
        const option = node('option', label);
        option.value = value;
        priority.input.append(option);
      }
      maintenanceForm.append(
        node('h4', 'Report a maintenance issue'),
        category.label,
        priority.label,
        field('Describe the issue', 'description', 'textarea', true, { minlength: 10, maxlength: 2000, rows: 3 }).label,
        field('Optional photo (JPEG or PNG, max 10 MB)', 'evidence', 'file', false, { accept: 'image/jpeg,image/png' }).label,
        button('Submit maintenance request', 'submit', 'button button-primary'),
        node('p', 'Safety issues are escalated as urgent. Photos are stored only after a clean malware scan; if scanning is unavailable, the request will remain recorded and the photo upload will be reported as failed.', 'muted'),
      );
      item.append(maintenanceForm);
    }
    section.append(item);
  }
  const maintenance = node('section', undefined, 'panel');
  maintenance.append(node('h3', 'My maintenance requests'));
  if (!workspace.maintenance.length) maintenance.append(empty('No maintenance issues have been reported from your account.'));
  for (const request of workspace.maintenance) {
    const item = card(`${request.address}${request.unit_no ? ` · ${request.unit_no}` : ''}`,
      `${request.category} · ${request.priority} · ${new Date(request.created_at).toLocaleDateString(document.documentElement.lang)} · ${request.description}`,
      request.status);
    for (const event of request.events ?? []) {
      item.append(node('p', `${event.event_type.replaceAll('_', ' ')}${event.to_status ? ` · ${event.to_status.replaceAll('_', ' ')}` : ''} · ${new Date(event.created_at).toLocaleString(document.documentElement.lang)}`, 'muted'));
    }
    for (const evidence of request.evidence ?? []) {
      item.append(button(`Download photo · ${evidence.mime}`, 'resident-maintenance-evidence', 'button button-outline', {
        id: evidence.id,
      }));
    }
    if (!['completed','done','cancelled'].includes(request.status)) {
      const evidenceForm = node('form', undefined, 'inline-form');
      evidenceForm.dataset.form = 'resident-maintenance-evidence';
      evidenceForm.dataset.maintenance = request.id;
      evidenceForm.append(
        field('Add a photo (JPEG or PNG, max 10 MB)', 'evidence', 'file', true, { accept: 'image/jpeg,image/png' }).label,
        button('Upload scanned photo', 'submit', 'button button-outline'),
      );
      item.append(evidenceForm);
    }
    maintenance.append(item);
  }
  section.append(maintenance);
  return section;
}

function renderProperties() {
  if (state.user.role === 'property_vendor') return renderVendorMaintenancePortal();
  const wrap = node('div');
  const buyer = state.user.role === 'customer';
  const owner = state.user.role === 'property_owner';
  const canManage = hasActivity('property.listings.manage');
  wrap.append(sectionHeading(
    buyer ? 'Available property listings' : owner ? 'Landlord property portfolio' : 'Property listings',
    buyer ? 'Browse available properties and view their pictures.' : owner
      ? 'Manage your properties and units, track listing review, and follow maintenance and rent statements.'
      : 'Create and manage property records, units, rent details, and private listing pictures.',
  ));
  const metrics = propertyDashboardMetrics(state.properties);
  wrap.append(renderAppDashboard({
    title: owner ? 'Landlord dashboard' : 'Property Management dashboard',
    description: owner
      ? 'Your property listings and units. Counts use records currently available to your account.'
      : 'A summary of property listings available to your account. Counts use the currently loaded listing data only.',
    source: '/properties',
    metrics,
    statusTitle: 'Listing status',
    statuses: metrics.byStatus,
    emptyMessage: 'No property listings are currently available for this dashboard.',
    values: (data) => [['Property listings', data.totalListings], ['Units in listed properties', data.totalUnits]],
  }));
  if (['global_admin','super_admin','corporate_business_manager'].includes(state.user.role)) {
    const authorityQueue = node('section', undefined, 'panel');
    authorityQueue.append(
      sectionHeading('Owner-authority review queue', 'Inspect scanned ownership or delegated-authority evidence. This operational review is separate from listing moderation.'),
    );
    if (!state.propertyAuthorityReviewQueue.length) {
      authorityQueue.append(empty('No property authority cases are awaiting review.'));
    }
    for (const property of state.propertyAuthorityReviewQueue) {
      const item = card(property.address,
        `${t(property.ptype.replaceAll('_', ' '))} · ${property.listing_mode.replaceAll('_', ' ')}`,
        property.authority_review_status);
      for (const evidence of property.authority_evidence ?? []) {
        item.append(button(
          `Review ${evidence.evidence_type.replaceAll('_', ' ')} evidence · ${Math.ceil(evidence.size_bytes / 1024)} KB`,
          'property-authority-file',
          'button button-outline',
          { id: property.id, evidence: evidence.id },
        ));
      }
      if (property.created_by !== state.user.id && property.authority_evidence?.length) {
        item.append(
          button('Approve authority', 'property-authority-review', 'button button-primary', { id: property.id, decision: 'approve' }),
          button('Request more evidence', 'property-authority-review', 'button button-outline', { id: property.id, decision: 'needs_info' }),
          button('Reject authority evidence', 'property-authority-review', 'button button-outline', { id: property.id, decision: 'reject' }),
        );
      }
      authorityQueue.append(item);
    }
    wrap.append(authorityQueue);
  }
  if (hasActivity('property.maintenance.manage')) wrap.append(renderMaintenanceOperations());
  if (buyer) {
    wrap.append(renderResidentPropertyPortal());
    const applications = node('section', undefined, 'panel');
    applications.append(node('h3', 'My rental applications'));
    if (!state.rentalApplications.length) applications.append(empty('You have not applied to a rental listing.'));
    for (const application of state.rentalApplications) {
      const item = card(`${application.address ?? 'Listing no longer available'}${application.unit_no ? ` · ${application.unit_no}` : ''}`,
        `Application submitted ${new Date(application.created_at).toLocaleDateString()} · ${application.status.replaceAll('_', ' ')}`,
        application.status);
      if (application.status === 'accepted') {
        item.append(node('p', 'Your application was accepted for follow-up. This is not an executed lease and does not authorize occupancy.', 'muted'));
      }
      if (application.review_reason) item.append(node('p', `Reviewer update: ${application.review_reason}`));
      for (const event of application.events ?? []) {
        item.append(node('p', `${new Date(event.created_at).toLocaleString()} · ${event.to_status.replaceAll('_', ' ')} · ${event.reason}`, 'muted'));
      }
      if (application.status === 'needs_info') {
        const response = node('form', undefined, 'inline-form');
        response.dataset.form = 'rental-application-response';
        response.dataset.application = application.id;
        response.append(field('Reply to the reviewer', 'response', 'textarea', true, {
          minlength: 10, maxlength: 2000, rows: 3,
        }).label, button('Send information', 'submit', 'button button-primary'));
        item.append(response);
      }
      applications.append(item);
    }
    wrap.append(applications);
  }
  if (canManage && state.rentalApplications.length) {
    const applications = node('section', undefined, 'panel');
    applications.append(node('h3', 'Rental application review'),
      node('p', 'Review applications manually. AfroLife does not run automated tenant screening. Rejections and requests for information require a reason.', 'muted'));
    for (const application of state.rentalApplications) {
      const item = card(`${application.address}${application.unit_no ? ` · ${application.unit_no}` : ''}`,
        `${application.applicant_name} · ${new Date(application.created_at).toLocaleDateString()}`,
        application.status);
      item.append(node('p', application.applicant_message));
      if (application.applicant_response) item.append(node('p', `Applicant response: ${application.applicant_response}`));
      if (application.review_reason) item.append(node('p', `Prior review: ${application.review_reason}`, 'muted'));
      for (const event of application.events ?? []) {
        item.append(node('p', `${new Date(event.created_at).toLocaleString()} · ${event.to_status.replaceAll('_', ' ')} · ${event.reason}`, 'muted'));
      }
      if (['submitted', 'needs_info'].includes(application.status)) {
        item.append(
          button('Accept application', 'rental-application-review', 'button button-primary', { id: application.id, decision: 'accept' }),
          button('Request information', 'rental-application-review', 'button button-outline', { id: application.id, decision: 'needs_info' }),
          button('Reject application', 'rental-application-review', 'button button-outline', { id: application.id, decision: 'reject' }),
        );
      }
      applications.append(item);
    }
    wrap.append(applications);
  }
  const columns = node('div', undefined, 'columns');
  if (canManage) {
    const form = node('form', undefined, 'panel form-card inline-form');
    form.dataset.form = 'property';
    const title = node('h3', 'Add a property listing');
    title.className = 'span-2';
    form.append(title);
    form.append(field('Street address', 'address', 'text', true, { minlength: '5' }).label);
    const type = field('Property type', 'ptype', 'select');
    for (const item of state.marketplaceConfig.properties?.property_types ?? [{key:'apartment_building',label:'Apartment building',enabled:true},{key:'house',label:'House',enabled:true},{key:'commercial',label:'Commercial',enabled:true},{key:'land',label:'Land',enabled:true}]) if(item.enabled) { const option=node('option',item.label);option.value=item.key;type.input.append(option); }
    form.append(type.label);
    const territory = field('Territory', 'territory_id', 'select');
    const choose = node('option', 'Choose an area');
    choose.value = '';
    choose.disabled = true;
    choose.selected = true;
    territory.input.append(choose);
    for (const area of state.territories) {
      const option = node('option', area.name);
      option.value = area.id;
      territory.input.append(option);
    }
    form.append(territory.label);
    if(['global_admin','super_admin','corporate_business_manager'].includes(state.user.role)){
      const seller=field('Seller / agent represented','owner_user_id','select',false);const none=node('option','AfroLife managed listing');none.value='';seller.input.append(none);for(const user of state.marketplaceSellers){const option=node('option',`${user.legal_name} · ${roleLabel(user.role)}`);option.value=user.id;seller.input.append(option);}form.append(seller.label);
    }
    form.append(field('Description','description','textarea',false,{maxlength:5000,rows:3}).label);
    const listingMode=field('Listing transaction','listing_mode','select');for(const [value,label] of [['sale','For sale'],['rent','For rent'],['sale_or_rent','Sale or rent']]){const option=node('option',label);option.value=value;listingMode.input.append(option);}form.append(listingMode.label);
    const salePrice=field('Sale price (ETB)','sale_price','number',false,{min:0.01,step:'0.01'});form.append(salePrice.label);
    const rentPeriod=field('Rental period','rent_period','select',false);for(const item of state.marketplaceConfig.rentals?.periods??[{key:'month',label:'Monthly',enabled:true}])if(item.enabled){const option=node('option',item.label);option.value=item.key;rentPeriod.input.append(option);}form.append(rentPeriod.label);
    form.append(field('First unit number', 'unit_no', 'text', false).label);
    form.append(field('Floor (optional)', 'floor', 'number', false, { step: '1' }).label);
    const monthlyRent=field('Unit rent (ETB, optional)','rent','number',false,{min:'0',step:'0.01'});form.append(monthlyRent.label);
    const syncPropertyOfferFields=()=>{
      const includesSale=listingMode.input.value!=='rent';
      const includesRent=listingMode.input.value!=='sale';
      salePrice.label.hidden=!includesSale;
      monthlyRent.label.hidden=!includesRent;
      salePrice.input.disabled=!includesSale;
      salePrice.input.required=includesSale;
      monthlyRent.input.disabled=!includesRent;
      if(!includesSale)salePrice.input.value='';
      if(!includesRent)monthlyRent.input.value='';
    };
    listingMode.input.addEventListener('change',syncPropertyOfferFields);
    syncPropertyOfferFields();
    const pictureLabel = field('Listing pictures or video (JPEG, PNG, MP4 or WebM)', 'photos', 'file', false, { accept: 'image/jpeg,image/png,video/mp4,video/webm', multiple: true }).label;
    pictureLabel.className = 'span-2';
    form.append(pictureLabel);
    const hint = node('p', 'On Android, take or choose photos and videos. Media stays private and is shown only to authorized users.');
    hint.className = 'muted span-2 upload-help';
    form.append(hint);
    form.append(button('Save property listing', 'submit', 'button button-primary span-2'));
    columns.append(form);
  }

  columns.append(renderPropertyListings(canManage, buyer
    ? 'No available property listings are currently published.'
    : 'No property listings yet. Add a property to start the listing.'));
  wrap.append(columns);
  if (state.user.role === 'property_owner') {
    const statements = node('section', undefined, 'panel form-card');
    statements.append(node('h2','Landlord rent & deposit statements'));
    statements.append(node('p','These read-only records show lease charges and reconciled rent/deposit receipts. They do not initiate or confirm a payout to you.'));
    statements.append(button('Download CSV statement', 'owner-statement-download', 'button button-outline'));
    if (!state.ownerStatements.length) statements.append(empty('No lease statements are available for your listings yet.'));
    for (const item of state.ownerStatements) {
      const statement = card(`${item.address} · ${item.unit_no}`, `Lease ${item.start_date} to ${item.end_date} · ${item.status}`);
      statement.append(node('p', t('Rent commencement: {{date}}.', { date: item.rent_start_on })));
      statement.append(node('p',`Rent charged ETB ${item.rent_charged} · reconciled ETB ${item.rent_reconciled} · pending reconciliation ETB ${item.rent_pending_reconciliation}`));
      statement.append(node('p',`Deposit received ETB ${item.deposit_reconciled} · refunded ETB ${item.deposit_refunded} · pending refund ETB ${item.deposit_refund_pending} · approved deduction ETB ${item.approved_deposit_deduction} · reviewed refundable balance ETB ${item.approved_deposit_refund_remaining} · agreed deposit ETB ${item.agreed_deposit}`));
      statements.append(statement);
    }
    wrap.append(statements);
  }
  return wrap;
}

function renderVendorMaintenancePortal() {
  const wrap = node('div');
  wrap.append(sectionHeading(
    'Vendor maintenance workspace',
    'Review only work orders assigned to your vendor account. Accept work, record progress, attach scanned evidence, and submit invoices for completed work.',
  ));
  const summary = node('section', undefined, 'panel');
  summary.append(node('h3', 'Assigned work orders'));
  summary.append(node('p', `${state.maintenanceRequests.length} assigned work orders are currently available to this account.`, 'muted'));
  wrap.append(summary);
  if (!state.maintenanceRequests.length) {
    wrap.append(empty('No maintenance work has been assigned to this vendor account.'));
    return wrap;
  }
  for (const request of state.maintenanceRequests) {
    const item = node('article', undefined, 'record-card');
    item.dataset.maintenance = request.id;
    item.append(
      node('h3', `${request.address}${request.unit_no ? ` · ${request.unit_no}` : ''}`),
      node('p', `${request.category} · ${request.priority} priority · ${request.status.replaceAll('_', ' ')}`, 'muted'),
      node('p', request.description),
    );
    if (request.sla_due_at) {
      const due = new Date(request.sla_due_at);
      const overdue = due.getTime() < Date.now() && !['completed','done','cancelled'].includes(request.status);
      item.append(node('p', `${overdue ? 'SLA overdue since' : 'SLA deadline'} ${due.toLocaleString(document.documentElement.lang)}`, overdue ? 'notice notice-warning' : 'muted'));
    }
    item.append(node('p', `${request.evidence_count} scanned evidence item(s)`, 'muted'));
    const actions = node('div', undefined, 'property-actions');
    if (request.status === 'assigned') actions.append(button('Accept assignment', 'maintenance-vendor-accept', 'button button-primary', { id: request.id }));
    if (['accepted','rework_required'].includes(request.status)) actions.append(button('Start work', 'maintenance-vendor-start', 'button button-outline', { id: request.id }));
    if (['accepted','in_progress','rework_required'].includes(request.status)) {
      actions.append(
        button('Upload evidence', 'maintenance-vendor-evidence', 'button button-outline', { id: request.id }),
        button('Request additional cost', 'maintenance-vendor-cost', 'button button-outline', { id: request.id }),
      );
    }
    if (request.status === 'in_progress') actions.append(button('Submit completed work', 'maintenance-vendor-complete', 'button button-primary', { id: request.id }));
    if (['completed','done'].includes(request.status)) actions.append(button('Submit invoice', 'maintenance-vendor-invoice', 'button button-outline', { id: request.id }));
    item.append(actions);
    wrap.append(item);
  }
  return wrap;
}

function renderMaintenanceOperations() {
  const section = node('section', undefined, 'panel');
  section.append(sectionHeading('Maintenance operations', 'Track requests from intake through assigned work and documented completion. Cost entered here is an estimate only; vendor invoices use the separate Finance approval and reconciliation workflow.'));
  const metrics = state.maintenanceMetrics ?? {};
  const summary = node('div', undefined, 'maintenance-metrics');
  for (const [label, value] of [
    ['Open requests', metrics.open_count ?? 0], ['Urgent open', metrics.urgent_open_count ?? 0],
    ['Overdue SLA', metrics.overdue_count ?? 0],
    ['Completed in 30 days', metrics.completed_last_30_days ?? 0],
    ['Average resolution hours (30d)', metrics.avg_resolution_hours_30d ?? '—'],
  ]) {
    const item = node('article', undefined, 'maintenance-metric');
    item.append(node('span', label), node('strong', String(value)));
    summary.append(item);
  }
  section.append(summary);
  const form = node('form', undefined, 'panel form-card inline-form');
  form.dataset.form = 'maintenance';
  form.append(node('h3', 'Open a maintenance request'));
  const property = field('Property', 'property_id', 'select');
  const placeholder = node('option', 'Choose a property'); placeholder.value = ''; placeholder.disabled = true; placeholder.selected = true; property.input.append(placeholder);
  for (const item of state.properties) { const option = node('option', item.address); option.value = item.id; property.input.append(option); }
  form.append(property.label);
  const unit = field('Unit (optional)', 'unit_id', 'select', false);
  const noUnit = node('option', 'Common area / property'); noUnit.value = ''; unit.input.append(noUnit);
  for (const item of state.properties.flatMap((p) => (p.units ?? []).map((u) => ({ ...u, property_id: p.id })))) {
    const option = node('option', `${item.unit_no} · ${state.properties.find((p) => p.id === item.property_id)?.address ?? ''}`);
    option.value = item.id; option.dataset.property = item.property_id; unit.input.append(option);
  }
  property.input.addEventListener('change', () => { for (const option of unit.input.options) if (option.value) option.hidden = option.dataset.property !== property.input.value; unit.input.value = ''; });
  form.append(unit.label);
  const category = field('Category', 'category', 'select');
  for (const [value, label] of [['general','General'],['plumbing','Plumbing'],['electrical','Electrical'],['appliance','Appliance'],['structural','Structural'],['cleaning','Cleaning'],['safety','Safety'],['other','Other']]) { const option = node('option', label); option.value = value; category.input.append(option); }
  const priority = field('Priority', 'priority', 'select');
  for (const [value, label] of [['normal','Normal'],['low','Low'],['urgent','Urgent']]) { const option = node('option', label); option.value = value; priority.input.append(option); }
  form.append(category.label, priority.label, field('Describe the issue', 'description', 'textarea', true, { minlength: 10, maxlength: 2000, rows: 3 }).label, button('Submit request', 'submit', 'button button-primary'));
  if (state.user.role !== 'field_agent') section.append(form);
  const tenantMembership = state.propertyTenantMemberships.find((tenant) =>
    tenant.id === state.propertyTenantContextId && tenant.status === 'active');
  if (['tenant_admin','master_agent'].includes(tenantMembership?.tenant_role)
    && !state.propertyTenantSupportGrantId) {
    const scopePanel = node('section', undefined, 'panel form-card');
    scopePanel.append(
      node('h3', 'Property agent assignments'),
      node('p', 'Assign tenant agents to specific properties before routing field work. Suspended or ended assignments immediately remove field-agent access.'),
    );
    const scopeForm = node('form', undefined, 'inline-form');
    scopeForm.dataset.form = 'property-agent-scope';
    const scopeProperty = field('Property', 'property_id', 'select', true);
    scopeProperty.input.append(new Option('Choose a property', ''));
    for (const property of state.properties) {
      scopeProperty.input.append(new Option(property.address, property.id));
    }
    const scopeAgent = field('Tenant agent', 'user_id', 'select', true);
    const renderCandidates = () => {
      scopeAgent.input.replaceChildren(new Option('Choose an active agent', ''));
      for (const candidate of state.propertyTenantAgentCandidates) {
        if (candidate.property_id && candidate.property_id !== scopeProperty.input.value) continue;
        scopeAgent.input.append(new Option(
          `${candidate.legal_name} · ${candidate.tenant_role.replaceAll('_', ' ')}`,
          candidate.user_id,
        ));
      }
    };
    scopeProperty.input.addEventListener('change', renderCandidates);
    renderCandidates();
    scopeForm.append(
      scopeProperty.label,
      scopeAgent.label,
      field('Assignment reason (minimum 10 characters)', 'reason', 'textarea', true, {
        minlength: 10, maxlength: 1000, rows: 2,
      }).label,
      button('Assign agent to property', 'submit', 'button button-primary'),
    );
    const submit = scopeForm.querySelector('button[type="submit"]');
    if (!state.properties.length || !state.propertyTenantAgentCandidates.length) submit.disabled = true;
    scopePanel.append(scopeForm);
    const activeScopes = state.propertyAgentScopes.filter((scope) => scope.status === 'active');
    if (!activeScopes.length) scopePanel.append(empty('No property agent assignments are active.'));
    for (const scope of activeScopes) {
      const item = card(
        scope.address,
        `${scope.legal_name} · ${scope.tenant_role.replaceAll('_', ' ')} · assigned ${new Date(scope.assigned_at).toLocaleDateString(document.documentElement.lang)}`,
        scope.status,
      );
      if (tenantMembership.tenant_role === 'tenant_admin'
        || (scope.tenant_role === 'field_agent' && scope.user_id !== state.user.id)) {
        item.append(
          button('Suspend', 'property-agent-scope-status', 'button button-outline', {
            propertyId: scope.property_id, userId: scope.user_id, status: 'suspended',
          }),
          button('End assignment', 'property-agent-scope-status', 'button button-quiet', {
            propertyId: scope.property_id, userId: scope.user_id, status: 'ended',
          }),
        );
      }
      scopePanel.append(item);
    }
    section.append(scopePanel);
  }
  const filters = node('div', undefined, 'maintenance-filters');
  const search = field('Search requests', 'maintenance_search', 'search', false, { placeholder: 'Property, unit, or issue' });
  search.input.setAttribute('aria-label', 'Search maintenance requests by property, unit, or issue');
  const statusFilter = field('Status', 'maintenance_status', 'select', false);
  for (const [value, label] of [['','All statuses'],['open','Open'],['triaged','Triaged'],['assigned','Assigned'],['accepted','Accepted'],['in_progress','In progress'],['awaiting_review','Awaiting review'],['rework_required','Rework required'],['completed','Completed'],['done','Completed (legacy)'],['cancelled','Cancelled']]) {
    const option = node('option', label); option.value = value; statusFilter.input.append(option);
  }
  const priorityFilter = field('Priority', 'maintenance_priority', 'select', false);
  for (const [value, label] of [['','All priorities'],['urgent','Urgent'],['normal','Normal'],['low','Low']]) {
    const option = node('option', label); option.value = value; priorityFilter.input.append(option);
  }
  const propertyFilter = field('Property', 'maintenance_property', 'select', false);
  const allProperties = node('option', 'All properties'); allProperties.value = ''; propertyFilter.input.append(allProperties);
  for (const item of state.properties) { const option = node('option', item.address); option.value = item.id; propertyFilter.input.append(option); }
  filters.append(search.label, statusFilter.label, priorityFilter.label, propertyFilter.label);
  section.append(filters);
  const resultCount = node('p', undefined, 'maintenance-result-count');
  resultCount.setAttribute('role', 'status');
  resultCount.setAttribute('aria-live', 'polite');
  section.append(resultCount);
  const list = node('div', undefined, 'list');
  const renderRequests = () => {
    list.replaceChildren();
    const query = search.input.value.trim().toLocaleLowerCase();
    const matches = state.maintenanceRequests.filter((request) => {
      const haystack = `${request.address} ${request.unit_no ?? ''} ${request.description} ${request.category}`.toLocaleLowerCase();
      return (!query || haystack.includes(query))
        && (!statusFilter.input.value || request.status === statusFilter.input.value)
        && (!priorityFilter.input.value || request.priority === priorityFilter.input.value)
        && (!propertyFilter.input.value || request.property_id === propertyFilter.input.value);
    }).sort((a, b) => {
      const activeStatuses = ['open','triaged','assigned','in_progress','awaiting_review','rework_required'];
      const activeDifference = Number(activeStatuses.includes(b.status)) - Number(activeStatuses.includes(a.status));
      const priorityRank = { urgent: 0, normal: 1, low: 2 };
      return activeDifference || (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3)
        || Number(b.age_hours ?? 0) - Number(a.age_hours ?? 0);
    });
    resultCount.textContent = `Showing ${matches.length} of ${state.maintenanceRequests.length} loaded requests${state.maintenanceHasMore ? ' · Load more to include older requests in search results.' : ''}`;
    if (!state.maintenanceRequests.length) list.append(empty('No maintenance requests are recorded for your account.'));
    else if (!matches.length) list.append(empty('No requests match these filters. Try changing the search or filters.'));
    for (const request of matches) {
      const item = card(`${request.address}${request.unit_no ? ` · ${request.unit_no}` : ''}`, `${request.category} · ${request.priority} priority · opened ${new Date(request.created_at).toLocaleDateString(document.documentElement.lang)} · ${Math.floor(Number(request.age_hours ?? 0))}h old`, request.status);
      item.dataset.maintenance = request.id;
      item.append(node('p', request.description));
      if (request.latest_event_at) {
        const note = String(request.latest_event_note ?? '').trim().replace(/\s+/g, ' ');
        const shortNote = note.length > 180 ? `${note.slice(0, 177)}…` : note;
        const updatedAt = new Date(request.latest_event_at).toLocaleString(document.documentElement.lang);
        item.append(node('p', `Last update: ${String(request.latest_event_type ?? 'updated').replaceAll('_', ' ')} · ${updatedAt}${shortNote ? ` · ${shortNote}` : ''}`, 'maintenance-latest-update'));
      }
      if (request.assigned_to) item.append(node('p', `Assigned to: ${request.assigned_to}`));
      if (request.vendor_name) item.append(node('p', `Assigned vendor: ${request.vendor_name}`));
      if (request.sla_due_at) {
        const overdue = new Date(request.sla_due_at).getTime() < Date.now() && !['completed','done','cancelled'].includes(request.status);
        item.append(node('p', `${overdue ? 'SLA overdue since' : 'SLA deadline'} ${new Date(request.sla_due_at).toLocaleString(document.documentElement.lang)}`, overdue ? 'notice notice-warning' : 'muted'));
      }
      if (request.resolution_note) item.append(node('p', `Triage / work notes: ${request.resolution_note}`));
      if (request.review_note) item.append(node('p', `Review decision: ${request.review_note}`));
      if (request.cost != null) item.append(node('p', `Cost estimate: ETB ${Number(request.cost).toLocaleString(document.documentElement.lang)} (not an approved invoice)`));
      const actions = node('div', undefined, 'property-actions');
      actions.append(button('History', 'maintenance-events', 'button button-outline', { id: request.id }));
      if (request.evidence_count) actions.append(button(`Evidence (${request.evidence_count})`, 'maintenance-evidence', 'button button-outline', { id: request.id }));
      if (['open','triaged','assigned','in_progress','rework_required'].includes(request.status)) {
        actions.append(button('Add request photo', 'maintenance-evidence-upload', 'button button-outline', { id: request.id }));
      }
      if (mayUpdate && request.status === 'open') actions.append(button('Triage', 'maintenance-update', 'button button-outline', { id: request.id, status: 'triaged' }));
      if (mayUpdate && request.status === 'triaged') {
        actions.append(button('Assign technician', 'maintenance-update', 'button button-outline', { id: request.id, status: 'assigned' }));
        if (mayAssignVendor) actions.append(button('Assign external vendor', 'maintenance-assign-vendor', 'button button-outline', { id: request.id }));
      }
      if (mayUpdate && request.status === 'assigned' && !request.assigned_vendor_id) actions.append(button('Start work', 'maintenance-update', 'button button-outline', { id: request.id, status: 'in_progress' }));
      if (mayUpdate && request.status === 'in_progress') actions.append(button('Submit for review', 'maintenance-update', 'button button-primary', { id: request.id, status: 'awaiting_review' }));
      if (mayReviewMaintenance && request.status === 'awaiting_review') {
        actions.append(button('Approve completion', 'maintenance-update', 'button button-primary', { id: request.id, status: 'completed' }));
        actions.append(button('Return for rework', 'maintenance-update', 'button button-outline', { id: request.id, status: 'rework_required' }));
      }
      if (mayUpdate && request.status === 'rework_required') actions.append(button('Resume rework', 'maintenance-update', 'button button-outline', { id: request.id, status: 'in_progress' }));
      if (mayUpdate && state.user.role !== 'field_agent'
        && ['open','triaged','assigned','in_progress','rework_required'].includes(request.status)) {
        actions.append(button('Cancel', 'maintenance-update', 'button button-outline', { id: request.id, status: 'cancelled' }));
      }
      item.append(actions); list.append(item);
    }
    if (state.maintenanceHasMore) {
      const loadMore = button(state.maintenanceLoadingMore ? 'Loading more requests…' : 'Load 200 older requests', 'load-more-maintenance', 'button button-outline');
      loadMore.disabled = state.maintenanceLoadingMore;
      list.append(loadMore);
    }
  };
  const mayUpdate = ['master_agent','field_agent','corporate_business_manager','super_admin','global_admin'].includes(state.user.role);
  const mayReviewMaintenance = ['corporate_business_manager','super_admin','global_admin'].includes(state.user.role);
  const mayAssignVendor = mayReviewMaintenance;
  search.input.addEventListener('input', renderRequests);
  for (const input of [statusFilter.input, priorityFilter.input, propertyFilter.input]) input.addEventListener('change', renderRequests);
  renderRequests();
  section.append(list);
  return section;
}

function renderMaintenanceFinanceQueue() {
  if (!['global_admin','super_admin','finance_manager'].includes(state.user.role)) return null;
  const section = node('section', undefined, 'panel form-card');
  section.append(node('h3', 'Vendor additional-cost and invoice review'));
  section.append(node('p', 'Additional costs and invoices remain separate Finance decisions. Invoice mismatches must be explicitly resolved before invoice approval.'));

  const addReasonForm = (item, formName, actionLabel, choices) => {
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = formName;
    form.dataset.id = item.id;
    const decision = field('Decision', 'decision', 'select');
    for (const [value, label] of choices) {
      const option = node('option', label); option.value = value; decision.input.append(option);
    }
    form.append(decision.label, field('Reason (minimum 10 characters)', 'reason', 'textarea', true, { minlength: 10, maxlength: 1000, rows: 2 }).label,
      button(actionLabel, 'submit', 'button button-primary'));
    return form;
  };

  const costs = node('div', undefined, 'list');
  costs.append(node('h4', 'Additional-cost requests'));
  if (!state.maintenanceCostQueue.length) costs.append(empty('No additional-cost requests are awaiting review.'));
  for (const request of state.maintenanceCostQueue) {
    const item = card(request.vendor_name, `ETB ${Number(request.amount).toLocaleString(document.documentElement.lang)} · ${new Date(request.created_at).toLocaleDateString(document.documentElement.lang)}`, 'pending');
    item.append(node('p', request.rationale), renderMaintenanceRequestLink(request.maintenance_request_id));
    item.append(addReasonForm(request, 'maintenance-cost-decision', 'Record decision', [['approve','Approve additional cost'],['reject','Reject request']]));
    costs.append(item);
  }
  section.append(costs);

  const mismatches = node('div', undefined, 'list');
  mismatches.append(node('h4', 'Invoice amount mismatches'));
  if (!state.maintenanceInvoiceMismatchQueue.length) mismatches.append(empty('No invoice mismatches are awaiting resolution.'));
  for (const bill of state.maintenanceInvoiceMismatchQueue) {
    const item = card(`${bill.vendor_name} · ${bill.invoice_reference}`,
      `Invoice ETB ${Number(bill.amount).toLocaleString(document.documentElement.lang)} · approved work ETB ${Number(bill.expected_amount).toLocaleString(document.documentElement.lang)} · variance ETB ${Number(bill.match_variance).toLocaleString(document.documentElement.lang)}`,
      bill.match_status);
    item.append(renderMaintenanceRequestLink(bill.maintenance_request_id));
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'maintenance-invoice-mismatch';
    form.dataset.id = bill.id;
    form.append(field('Exception rationale (minimum 10 characters)', 'reason', 'textarea', true, { minlength: 10, maxlength: 1000, rows: 2 }).label,
      button('Accept documented exception', 'submit', 'button button-primary'));
    item.append(form);
    mismatches.append(item);
  }
  section.append(mismatches);

  const invoices = node('div', undefined, 'list');
  invoices.append(node('h4', 'Matched invoices awaiting approval'));
  if (!state.maintenanceInvoiceApprovalQueue.length) invoices.append(empty('No matched invoices are awaiting approval.'));
  for (const bill of state.maintenanceInvoiceApprovalQueue) {
    const item = card(`${bill.vendor_name} · ${bill.invoice_reference}`,
      `ETB ${Number(bill.amount).toLocaleString(document.documentElement.lang)} · ${bill.match_status}`,
      bill.status);
    item.append(renderMaintenanceRequestLink(bill.maintenance_request_id));
    item.append(addReasonForm(bill, 'maintenance-invoice-decision', 'Record invoice decision', [['approve','Approve invoice'],['reject','Reject invoice']]));
    invoices.append(item);
  }
  section.append(invoices);
  return section;
}

function renderMaintenanceRequestLink(id) {
  const link = node('p', `Maintenance request ${id}`);
  return link;
}

function renderMarketplace() {
  const wrap = node('div');
  const manager = ['global_admin','super_admin','corporate_business_manager'].includes(state.user.role);
  const config = state.marketplaceConfig ?? {};
  const enabled = config.system?.enabled_domains ?? ['products','services','equipment','properties'];
  wrap.append(sectionHeading('Marketplace', 'Post and discover products, services, equipment and property with private photo and video uploads.'));
  const columns = node('div', undefined, 'columns');
  if (state.user.role !== 'customer') {
    const form = node('form', undefined, 'panel form-card inline-form marketplace-form');
    form.dataset.form = 'marketplace';
    form.append(node('h3', 'Create a listing'));
    if (manager) {
      const seller = field('Seller / agent represented', 'seller_user_id', 'select');
      const emptyOption = node('option', 'Choose an active seller'); emptyOption.value = ''; emptyOption.disabled = true; emptyOption.selected = true; seller.input.append(emptyOption);
      for (const person of state.marketplaceSellers) { const option = node('option', `${person.legal_name} · ${roleLabel(person.role)}`); option.value = person.id; seller.input.append(option); }
      form.append(seller.label);
    }
    const domain = field('Listing domain', 'domain', 'select');
    for (const [value,label] of [['products','Products'],['services','Services'],['equipment','Equipment']]) if (enabled.includes(value)) { const option=node('option',label); option.value=value; domain.input.append(option); }
    form.append(domain.label);
    const catalog = node('label','Category'); const categories = document.createElement('select'); categories.name='category_key'; categories.required=true; catalog.append(categories);
    const fillCategories = () => { categories.replaceChildren(); const scope=domain.input.value==='services'?'services':'products'; for (const item of config[scope]?.categories ?? []) if (item.enabled) { const option=node('option',item.label); option.value=item.key; categories.append(option); } };
    domain.input.addEventListener('change', fillCategories); fillCategories(); form.append(catalog);
    form.append(field('Title','title','text',true,{minlength:3,maxlength:140}).label);
    form.append(field('Price (ETB)','price','number',false,{min:0.01,step:'0.01'}).label);
    const mode=field('Offer type','transaction_mode','select');
    for(const [value,label] of [['sale','For sale'],['rental','For rent / hire'],['service','Service']]) { const option=node('option',label); option.value=value; mode.input.append(option); }
    mode.input.value=domain.input.value==='services'?'service':'sale';
    domain.input.addEventListener('change',()=>{ mode.input.value=domain.input.value==='services'?'service':'sale'; });
    form.append(mode.label);
    const period=field('Rental period','rent_period','select',false); for(const item of config.rentals?.periods??[]) if(item.enabled){const option=node('option',item.label);option.value=item.key;period.input.append(option);} form.append(period.label);
    const syncRentalPeriod=()=>{
      const isRental=mode.input.value==='rental';
      period.label.hidden=!isRental;
      period.input.disabled=!isRental;
      period.input.required=isRental;
      if(!isRental)period.input.value='';
    };
    mode.input.addEventListener('change',syncRentalPeriod);
    domain.input.addEventListener('change',syncRentalPeriod);
    syncRentalPeriod();
    const condition=field('Condition','condition','select',false); for(const [value,label] of [['new','New'],['like_new','Like new'],['good','Good'],['fair','Fair'],['not_applicable','Not applicable']]){const option=node('option',label);option.value=value;condition.input.append(option);} form.append(condition.label);
    const area=field('Territory','territory_id','select'); const choose=node('option','Choose an area');choose.value='';choose.disabled=true;choose.selected=true;area.input.append(choose);for(const territory of state.territories){const option=node('option',territory.name);option.value=territory.id;area.input.append(option);}form.append(area.label);
    form.append(field('Description','description','textarea',true,{minlength:10,maxlength:5000}).label);
    const media=field('Photos and videos (add at least one photo to post)','media','file',true,{accept:'image/jpeg,image/png,video/mp4,video/webm',multiple:true}).label; media.className='span-2';form.append(media);
    const hint=node('p',`Private uploads · max ${Math.round(Number(config.system?.image_max_bytes??10485760)/1048576)} MB/photo · ${Math.round(Number(config.system?.video_max_bytes??52428800)/1048576)} MB/video · ${config.system?.max_media_per_listing??10} files/listing`,'muted span-2 upload-help');form.append(hint);
    form.append(button('Post listing','submit','button button-primary span-2'));
    columns.append(form);
  }
  const listingList=node('div',undefined,'list marketplace-list');
  if(!state.marketplaceListings.length) listingList.append(empty('No listings are available yet.'));
  for(const listing of state.marketplaceListings){
    const transaction = listing.transaction_mode === 'rental' ? 'For rent / hire' : listing.transaction_mode === 'service' ? 'Service' : 'For sale';
    const rentalPeriod = listing.rent_period
      ? t(config.rentals?.periods?.find((period) => period.key === listing.rent_period)?.label ?? listing.rent_period)
      : '';
    const price = listing.price == null ? '' : ` · ETB ${Number(listing.price).toLocaleString(document.documentElement.lang)}${rentalPeriod ? ` / ${rentalPeriod}` : ''}`;
    const details = `${listing.seller_name} · ${t(listing.domain)} · ${t(transaction)}${price}`;
    const item=card(listing.title,details,listing.status);
    item.classList.add('marketplace-card');
    item.append(node('p',listing.description,'marketplace-description'));
    if(listing.review_note) item.append(node('p',`Review note: ${listing.review_note}`,'form-error'));
    if(listing.media?.length){const gallery=node('div',undefined,'marketplace-gallery'); for(const media of listing.media){const figure=node('figure',undefined,'property-photo');const buttonEl=button(media.mime.startsWith('video/')?'Play video':'View photo','marketplace-media','button button-outline',{id:media.id,mime:media.mime});figure.append(buttonEl);if(media.caption)figure.append(node('figcaption',media.caption));gallery.append(figure);}item.append(gallery);}
    if(state.user.role==='customer'&&listing.status==='published'&&listing.transaction_mode==='sale'&&listing.price&&config.sandbox_checkout_available){const quantity=field('Quantity','quantity','number',true,{min:1,max:1000,step:1});quantity.input.value='1';const checkout=button('Create sandbox order & simulate payment','marketplace-sandbox-checkout','button button-outline',{id:listing.id});checkout.addEventListener('click',async()=>{checkout.disabled=true;try{const order=await api(`/marketplace/listings/${listing.id}/sandbox-orders`,{method:'POST',body:JSON.stringify({quantity:Number(quantity.input.value),idempotency_key:crypto.randomUUID()})});const paid=await api(`/marketplace/sandbox-orders/${order.id}/mock-payment`,{method:'POST',body:'{}'});showAlert(paid.notice);}catch(error){showAlert(error.message,true);}finally{checkout.disabled=false;}});const sandboxNote=node('p','Test checkout only. No real payment is taken.','muted');item.append(quantity.label,sandboxNote,checkout);}
    if(['draft','rejected'].includes(listing.status)&&listing.created_by===state.user.id){
      const form=document.createElement('form');form.className='inline-form marketplace-resume';form.dataset.form='marketplace-existing-media';form.dataset.listing=listing.id;
      form.append(field('Add photos or video','media','file',true,{accept:'image/jpeg,image/png,video/mp4,video/webm',multiple:true}).label);
      form.append(button('Upload & post','submit','button button-primary'));
      item.append(form);
    }
    if(listing.status==='pending_review'&&manager&&listing.created_by!==state.user.id){item.append(button('Publish','marketplace-review','button button-primary',{id:listing.id,decision:'publish'}),button('Return for changes','marketplace-review','button button-outline',{id:listing.id,decision:'reject'}));}
    listingList.append(item);
  }
  columns.append(listingList); wrap.append(columns);
  if (enabled.includes('properties') && hasActivity('property.listings.view')) {
    const propertySection = node('section', undefined, 'panel form-card marketplace-property-listings');
    propertySection.append(sectionHeading('Property sale and rental listings', 'Browse available properties, prices, rental terms, and listing media.'));
    propertySection.append(renderPropertyListings(
      hasActivity('property.listings.manage'),
      'No available property listings are currently published.',
    ));
    wrap.append(propertySection);
  }
  if(manager) wrap.append(renderMarketplaceConfig());
  const ownedListings = state.marketplaceListings.filter((listing) =>
    listing.created_by === state.user.id || listing.seller_user_id === state.user.id);
  const marketplaceMetrics = marketplaceDashboardMetrics(state.marketplaceListings, state.user.id);
  const report = renderAppDashboard({
    title: 'Marketplace BI dashboard',
    description: 'Listing status and ownership metrics from the marketplace records currently loaded for your account.',
    source: '/marketplace/listings',
    metrics: marketplaceMetrics,
    statusTitle: 'Listing status',
    statuses: marketplaceMetrics.byStatus,
    emptyMessage: 'No marketplace listings are currently available for this dashboard.',
    values: (data) => [
      ['Loaded listings', data.totalListings],
      ['Published listings', data.publishedListings],
      ['Your listings', data.ownedListings],
    ],
  });
  report.append(node('p', 'Marketplace listing prices are not payments. Local mock mode supports a sandbox order and simulated payment for published fixed-price sales; it never charges a buyer or posts to Accounting. Real checkout, buyer memberships, wallets, loans, and purchase history remain unavailable.'));
  const activity = node('div', undefined, 'list');
  activity.append(node('h3', 'Your detailed listing activity'));
  if (!ownedListings.length) activity.append(node('p', 'No marketplace listing activity is linked to your account.'));
  for (const listing of ownedListings) {
    activity.append(card(listing.title,
      `${listing.domain} · ${listing.transaction_mode} · Created ${new Date(listing.created_at).toLocaleString(document.documentElement.lang)} · Updated ${new Date(listing.updated_at ?? listing.created_at).toLocaleString(document.documentElement.lang)}`,
      listing.status));
  }
  report.append(activity);
  wrap.append(report);
  return wrap;
}

function renderInsurance() {
  const wrap = node('div');
  wrap.append(sectionHeading('Insurance information', 'Consent-based, non-binding information and referral workflow. No insurance policy or coverage is created by this mini-app.'));
  const notice = node('section', undefined, 'panel form-card');
  const requestCount = state.insuranceRequests.length;
  const pendingCount = state.insuranceRequests.filter((request) => request.status === 'pending').length;
  const metrics = node('div', undefined, 'enterprise-metrics');
  notice.append(
    node('h2', 'Insurance report dashboard'),
    node('p', 'Insurance policy enrollment, claims, member wallets, and loans are not available in this platform. Existing Insurance ledgers are separate organization accounting records and do not prove personal cover or a payment balance.'),
    node('p', 'Agents may only make a consented, non-binding follow-up or refer a customer to the Insurance service team. Product recommendations, comparisons, quotes, premium collection, policy issuance or changes, and claims decisions are not available.'),
  );
  for (const [label, value] of [
    ['Policy membership', 'Not available'],
    ['Requests submitted', requestCount],
    ['Awaiting response', pendingCount],
  ]) {
    const metric = node('div', undefined, 'enterprise-metric');
    metric.append(node('span', label), node('strong', value));
    metrics.append(metric);
  }
  notice.append(metrics);
  const requestForm = node('form', undefined, 'panel form-card inline-form');
  requestForm.dataset.form = 'insurance-request';
  requestForm.append(node('h3', 'Request information'));
  const product = field('Information requested', 'product_interest', 'select');
  for (const [value, label] of [['life', 'Life insurance information'], ['household', 'Household cover information'], ['property', 'Property cover information']]) {
    const option = node('option', label);
    option.value = value;
    product.input.append(option);
  }
  requestForm.append(product.label, field('What would you like to know?', 'message', 'textarea', true, { minlength: 10, maxlength: 500 }).label);
  const consent = node('label', undefined, 'benefit-check span-2');
  const consentInput = document.createElement('input');
  consentInput.type = 'checkbox';
  consentInput.name = 'consent';
  consentInput.required = true;
  consent.append(consentInput, node('span', 'I consent to AfroLife forwarding this information request to the Insurance service team. This is not an application, policy, quote, or coverage confirmation.'));
  const agentConsent = node('label', undefined, 'benefit-check span-2');
  const agentConsentInput = document.createElement('input');
  agentConsentInput.type = 'checkbox';
  agentConsentInput.name = 'agent_referral_consent';
  agentConsent.append(agentConsentInput, node('span', 'Optional: I consent to sharing my name, phone number, and selected topic with one assigned AfroLife Agent for non-binding follow-up and referral to the Insurance service team. The Agent cannot advise, quote, collect premiums, or issue or change a policy.'));
  requestForm.append(consent, agentConsent, button('Submit information request', 'submit', 'button button-primary span-2'));
  wrap.append(notice, requestForm);
  const myRequests = node('section', undefined, 'panel form-card');
  myRequests.append(node('h2', 'Your requests and activity'));
  if (!state.insuranceRequests.length) myRequests.append(node('p', 'No Insurance information requests are linked to your account.'));
  for (const request of state.insuranceRequests) {
    const referral = request.agent_referral_status
      ? ` · Agent referral: ${request.agent_referral_status}${request.assigned_agent_name ? ` (${request.assigned_agent_name})` : ''}`
      : '';
    const item = card(request.product_interest, `${request.message} · Submitted ${new Date(request.created_at).toLocaleString(document.documentElement.lang)}${request.responded_at ? ` · Updated ${new Date(request.responded_at).toLocaleString(document.documentElement.lang)}` : ''}${request.response_note ? ` · Response: ${request.response_note}` : ''}${referral}`, request.status);
    if (request.agent_referral_id && request.agent_referral_status !== 'customer_withdrew') {
      item.append(button('Withdraw Agent-sharing consent', 'insurance-referral-withdraw', 'button button-outline', { id: request.agent_referral_id }));
    }
    if (request.agent_referral_events?.length) {
      item.append(node('p', `Agent-sharing activity: ${request.agent_referral_events.map((event) =>
        `${event.event_type} · ${new Date(event.created_at).toLocaleString(document.documentElement.lang)}`).join(' · ')}`));
    }
    myRequests.append(item);
  }
  wrap.append(myRequests);
  if (state.insuranceStaffRequests.length) {
    const queue = node('section', undefined, 'panel form-card');
    queue.append(node('h2', 'Insurance information request review'));
    for (const request of state.insuranceStaffRequests) {
      const item = card(`${request.legal_name} · ${request.product_interest}`,
        `${request.phone} · ${request.message} · ${new Date(request.created_at).toLocaleString(document.documentElement.lang)}`,
        request.status);
      if (request.status === 'pending' && request.can_respond) {
        item.append(button('Respond', 'insurance-request-decision', 'button button-primary', { id: request.id, status: 'responded' }));
        item.append(button('Close request', 'insurance-request-decision', 'button button-outline', { id: request.id, status: 'closed' }));
      } else if (request.response_note) {
        item.append(node('p', request.response_note));
      }
      queue.append(item);
    }
    wrap.append(queue);
  }
  if (state.insuranceAgentReferrals.length) {
    const referrals = node('section', undefined, 'panel form-card');
    referrals.append(node('h2', 'Consent-based Agent referrals'));
    for (const referral of state.insuranceAgentReferrals) {
      const item = card(
        `${referral.legal_name} · ${referral.product_interest}`,
        `${referral.phone} · ${referral.status} · ${new Date(referral.created_at).toLocaleString(document.documentElement.lang)}`,
        referral.status,
      );
      if (referral.events?.length) {
        item.append(node('p', `Activity: ${referral.events.map((event) =>
          `${event.event_type} · ${new Date(event.created_at).toLocaleString(document.documentElement.lang)}`).join(' · ')}`));
      }
      if (referral.status === 'unassigned' && state.insuranceEligibleAgents.length) {
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Assign referral to an active Agent');
        select.dataset.referralAgent = referral.id;
        select.append(new Option('Select Agent', ''));
        for (const agent of state.insuranceEligibleAgents) {
          select.append(new Option(`${agent.legal_name} · ${agent.role}`, agent.id));
        }
        const reason = document.createElement('select');
        reason.setAttribute('aria-label', 'Referral assignment reason');
        reason.dataset.referralReason = referral.id;
        reason.append(new Option('Select assignment reason', ''));
        for (const [value, label] of [
          ['customer_requested', 'Customer requested this Agent'],
          ['workload_balance', 'Workload balance'],
          ['staff_review', 'Insurance staff review'],
        ]) reason.append(new Option(label, value));
        item.append(select, reason, button('Assign referral', 'insurance-referral-assign', 'button button-primary', { id: referral.id }));
      } else if (referral.assigned_agent_name) {
        item.append(node('p', `Assigned Agent: ${referral.assigned_agent_name}`));
      }
      if (referral.can_update && ['assigned', 'contact_attempted'].includes(referral.status)) {
        item.append(button('Contact attempted', 'insurance-referral-status', 'button button-outline', { id: referral.id, status: 'contact_attempted' }));
        item.append(button('Refer to Insurance team', 'insurance-referral-status', 'button button-outline', { id: referral.id, status: 'referred_to_insurance_team' }));
        item.append(button('Customer declined', 'insurance-referral-status', 'button button-outline', { id: referral.id, status: 'customer_declined' }));
      }
      referrals.append(item);
    }
    wrap.append(referrals);
  } else if (['master_agent', 'field_agent'].includes(state.user.role)) {
    wrap.append(node('p', 'No consented Insurance referrals are assigned in your Agent scope.'));
  }
  if (state.features.insuranceBrokerageSandboxEnabled && state.insuranceSandboxStatus?.enabled) {
    const sandbox = node('section', undefined, 'panel form-card');
    sandbox.append(
      node('h2', 'Brokerage lifecycle training sandbox'),
      node('p', 'Development-only simulated workflow using synthetic product and transaction data. It cannot contact insurers, issue real policies, move money, settle commissions, or decide real claims.'),
    );
    const runForm = node('form', undefined, 'inline-form');
    runForm.dataset.form = 'insurance-sandbox-create';
    const acknowledgement = node('label', undefined, 'benefit-check span-2');
    const acknowledgementInput = document.createElement('input');
    acknowledgementInput.type = 'checkbox';
    acknowledgementInput.name = 'acknowledge_synthetic_only';
    acknowledgementInput.required = true;
    acknowledgement.append(acknowledgementInput, node('span', 'I confirm that this scenario uses no real customer, policy, payment, or claims data.'));
    runForm.append(acknowledgement, button('Create synthetic training case', 'submit', 'button button-primary span-2'));
    sandbox.append(runForm);
    for (const item of state.insuranceSandboxCases) {
      const caseCard = card(item.scenario_reference, `${item.event_count} lifecycle events · Created ${new Date(item.created_at).toLocaleString(document.documentElement.lang)}`, 'synthetic only');
      caseCard.append(button('Run complete demo', 'insurance-sandbox-run', 'button button-outline', { id: item.id }));
      caseCard.append(button('View event trace', 'insurance-sandbox-view', 'button button-outline', { id: item.id }));
      const comparisonCategory = document.createElement('select');
      comparisonCategory.setAttribute('aria-label', 'Synthetic product comparison category');
      for (const [value, label] of [['household', 'Household']]) {
        comparisonCategory.append(new Option(label, value));
      }
      comparisonCategory.dataset.sandboxComparison = item.id;
      caseCard.append(comparisonCategory, button('Compare synthetic products', 'insurance-sandbox-compare', 'button button-outline', { id: item.id }));
      const quoteProduct = document.createElement('select');
      quoteProduct.setAttribute('aria-label', 'Synthetic quote product');
      quoteProduct.append(new Option('Select synthetic product', ''));
      for (const product of state.insuranceSandboxStatus.synthetic_products.filter((item) => item.category === 'household')) {
        quoteProduct.append(new Option(`${product.label} · ETB ${(product.monthlyPremiumMinor / 100).toFixed(2)}/month`, product.key));
      }
      quoteProduct.dataset.sandboxQuoteProduct = item.id;
      caseCard.append(quoteProduct, button('Simulate a 12-month quote', 'insurance-sandbox-quote', 'button button-outline', { id: item.id }));
      sandbox.append(caseCard);
      if (item.events) {
        for (const event of item.events) {
          caseCard.append(node('p', `${event.sequence_number}. ${event.event_type} · ${JSON.stringify(event.event_data)}`));
        }
      }
    }
    wrap.append(sandbox);
  }
  return wrap;
}

function renderMarketplaceConfig() {
  const panel=node('section',undefined,'panel form-card marketplace-config');
  panel.append(node('h3','Marketplace configuration'),node('p','Manage domain availability, approval rules, media limits and listing categories. Changes apply to new submissions immediately.','muted'));
  const form=node('form',undefined,'inline-form');form.dataset.form='marketplace-config';
  const cfg=state.marketplaceConfig??{};
  const domains=['products','services','equipment','properties'];
  const domainsWrap=node('fieldset',undefined,'span-2');domainsWrap.append(node('legend','Enabled domains'));
  for(const domain of domains){const label=node('label',domain);const input=document.createElement('input');input.type='checkbox';input.name=`domain:${domain}`;input.checked=(cfg.system?.enabled_domains??[]).includes(domain);label.prepend(input);domainsWrap.append(label);}form.append(domainsWrap);
  if(state.user.role==='global_admin'){
    const moderation=node('label','Require staff review before publishing');const check=document.createElement('input');check.type='checkbox';check.name='moderation_required';check.checked=cfg.system?.moderation_required!==false;moderation.prepend(check);form.append(moderation);
    form.append(field('Max photo size (MB)','image_max_mb','number',true,{min:0.25,max:20,step:0.25}).label,field('Max video size (MB)','video_max_mb','number',true,{min:1,max:100,step:1}).label,field('Max media per listing','max_media_per_listing','number',true,{min:1,max:30,step:1}).label);
  }
  for(const scope of ['products','services']){const area=field(`${scope[0].toUpperCase()+scope.slice(1)} categories (one key | label per line)`,`${scope}_categories`,'textarea',true,{rows:5});area.input.value=(cfg[scope]?.categories??[]).map((item)=>`${item.key} | ${item.label}`).join('\n');area.label.className='span-2';form.append(area.label);}
  const propertyTypes=field('Property types (one key | label per line)','property_types','textarea',true,{rows:3});propertyTypes.input.value=(cfg.properties?.property_types??[]).map((item)=>`${item.key} | ${item.label}`).join('\n');propertyTypes.label.className='span-2';form.append(propertyTypes.label);
  const rentalPeriods=field('Rental periods (one key | label per line)','rental_periods','textarea',true,{rows:2});rentalPeriods.input.value=(cfg.rentals?.periods??[]).map((item)=>`${item.key} | ${item.label}`).join('\n');rentalPeriods.label.className='span-2';form.append(rentalPeriods.label);
  if(state.user.role==='global_admin'){
    const users=node('div',undefined,'span-2');users.append(node('h4','Self-registration account types and KYC'));
    const types=cfg.users?.account_types??[];for(const item of types){const label=node('label',item.label);const input=document.createElement('input');input.type='checkbox';input.name=`account:${item.key}`;input.checked=item.enabled;label.prepend(input);users.append(label);}
    users.append(node('h4','Required registration documents'));
    for(const role of ['worker','customer','agent','property_owner']) for(const doc of ['national_id','police_clearance']){const label=node('label',`${roleLabel(role)} · ${doc==='national_id'?'National ID':'Police clearance'}`);const input=document.createElement('input');input.type='checkbox';input.name=`kyc:${role}:${doc}`;input.checked=(cfg.users?.kyc_requirements?.[role]??[]).includes(doc);if(role==='worker')input.disabled=true;label.prepend(input);users.append(label);}
    users.append(node('p','Property-vendor accounts are provisioned by Global Admin and require the contact person’s National ID before independent activation. Business registration checks are not represented by this document requirement.'));
    form.append(users);
  }
  form.append(button('Save configuration','submit','button button-primary span-2'));panel.append(form);return panel;
}

function renderContracts() {
  const wrap = node('div');
  wrap.append(sectionHeading('Contracts', 'Move each contract through review, approval, signature, and two-person payment reconciliation.'));
  const columns = node('div', undefined, 'columns');
  if (['global_admin', 'super_admin', 'master_agent', 'field_agent'].includes(state.user.role)) {
    const form = node('form', undefined, 'panel form-card inline-form');
    form.dataset.form = 'contract';
    form.append(node('h3', 'Create a contract'));
    const lead = field('Customer lead', 'lead_id', 'select');
    const emptyOption = node('option', 'Choose an eligible lead'); emptyOption.value = ''; emptyOption.disabled = true; emptyOption.selected = true; lead.input.append(emptyOption);
    for (const item of state.leads.filter((x) => ['household', 'business'].includes(x.lead_type) && ['new', 'qualified'].includes(x.status))) {
      const option = node('option', `${item.name} · ${item.phone}`); option.value = item.id; lead.input.append(option);
    }
    const track = field('Contract track', 'track', 'select');
    for (const [value, label] of [['A', 'Track A'], ['B', 'Track B']]) { const option = node('option', label); option.value = value; track.input.append(option); }
    form.append(lead.label, track.label, field('Base value (ETB)', 'base_value', 'number', true, { min: '0.01', step: '0.01' }).label, button('Create contract', 'submit', 'button button-primary'));
    columns.append(form);
  }
  const list = node('div', undefined, 'list');
  if (!state.contracts.length) list.append(empty('No contracts are available for your account.'));
  for (const contract of state.contracts) {
    const fees = ['onboarding_amt', 'guarantee_amt', 'monthly_mgmt_amt', 'employer_fee_amt', 'other_fee_amt'].reduce((sum, key) => sum + Number(contract[key] ?? 0), 0);
    const item = card(contract.contract_no, t('Track {{track}} · ETB {{amount}} · {{state}}', { track: contract.track, amount: fees.toLocaleString(document.documentElement.lang), state: t(contract.state) }), contract.state);
    const steps = {
      draft: [['submit', 'Submit for review', ['super_admin', 'master_agent', 'field_agent']],
        ['cancel', 'Cancel contract', ['super_admin', 'master_agent', 'field_agent']]],
      compliance_review: [['verify_kyc', 'Verify contract KYC', ['compliance']],
        ['reject', 'Reject contract', ['compliance']], ['cancel', 'Cancel contract', ['super_admin', 'master_agent', 'field_agent']]],
      approval_pending: [['approve', 'Approve contract', ['super_admin']], ['cancel', 'Cancel contract', ['super_admin', 'master_agent', 'field_agent']]],
      signature_pending: [['sign', 'Sign contract', ['super_admin', 'corporate_business_manager']], ['cancel', 'Cancel contract', ['super_admin', 'master_agent', 'field_agent']]],
      payment_pending: [['record_payment', 'Record payment', ['finance']], ['cancel', 'Cancel contract', ['super_admin', 'master_agent', 'field_agent']]],
      payment_received: [['reconcile', 'Reconcile payment', ['finance', 'finance_manager']]],
    }[contract.state] ?? [];
    for (const [action, label, roles] of steps) {
      if (roles.includes(state.user.role) || (state.user.role === 'global_admin' && roles.includes('super_admin'))) {
        const actionButton = button(label, 'contract-step', 'button button-outline', { id: contract.id, step: action });
        if (action === 'sign' && !(contract.documents ?? []).some((doc) => doc.document_stage === 'company_countersigned' && doc.uploaded_by === state.user.id)
          || action === 'sign' && !(contract.documents ?? []).some((doc) => doc.document_stage === 'party_signed')) actionButton.disabled = true;
        item.append(actionButton);
      }
    }
    for (const doc of contract.documents ?? []) {
      const download = button(doc.document_stage === 'company_countersigned' ? 'Download company-countersigned contract' : 'Download party-signed contract', 'contract-document-download', 'button button-outline', { id: doc.id });
      item.append(download);
    }
    if (contract.signature) item.append(node('p', `Company signature recorded by ${contract.signature.signer_name} (${roleLabel(contract.signature.signer_role)}).`));
    if (contract.state === 'signature_pending' && ['master_agent', 'field_agent', 'global_admin', 'super_admin', 'corporate_business_manager'].includes(state.user.role)) {
      const file = document.createElement('input');
      file.type = 'file'; file.accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
      const isAgent = ['master_agent', 'field_agent'].includes(state.user.role);
      file.setAttribute('aria-label', t(isAgent ? 'Party-signed contract document (PDF, JPEG or PNG, up to 10 MB)' : 'Company-countersigned contract document (PDF, JPEG or PNG, up to 10 MB)'));
      const upload = button(isAgent ? 'Upload party-signed contract' : 'Upload company-countersigned contract', 'contract-document-upload', 'button button-outline', { id: contract.id, stage: isAgent ? 'party_signed' : 'company_countersigned' });
      item.append(file, upload);
    }
    list.append(item);
  }
  columns.append(list);
  wrap.append(columns);
  return wrap;
}

function renderCommissions() {
  const wrap = node('div');
  wrap.append(sectionHeading('Commissions', 'Review earned commissions, current holdbacks, and eligible releases.'));
  const list = node('div', undefined, 'list');
  if (!state.commissions.length) list.append(empty('No commission events are available for your account.'));
  for (const commission of state.commissions) {
    const total = Number(commission.amount);
    const held = Number(commission.held_amount ?? 0);
    const immediate = Math.round((total - held) * 100) / 100;
    let details = t('Contract {{contract}} · Total ETB {{total}} · First payment ETB {{immediate}} · Held ETB {{held}}', {
      contract: commission.contract_no ?? commission.contract_id,
      total: total.toLocaleString(document.documentElement.lang),
      immediate: immediate.toLocaleString(document.documentElement.lang),
      held: held.toLocaleString(document.documentElement.lang),
    });
    if (held) details += ` · ${t('Release date {{date}}', { date: commission.holdback_release_on })}`;
    const item = card(commission.agent_name ?? commission.agent_id, details, commission.held_status === 'held' ? 'held' : commission.status);
    if (commission.status === 'qualified' && ['finance','finance_manager'].includes(state.user.role)) {
      item.append(button('Approve commission', 'commission-approve', 'button button-outline', { id: commission.id }));
    }
    if (commission.status === 'approved' && immediate > 0 && ['global_admin','super_admin'].includes(state.user.role)) {
      item.append(button('Pay first installment', 'commission-pay', 'button button-outline', { id: commission.id }));
    }
    if (commission.held_status === 'held' && ['global_admin','super_admin'].includes(state.user.role)) {
      item.append(button('Release eligible holdback', 'commission-release-held', 'button button-outline', { id: commission.id }));
    }
    list.append(item);
  }
  wrap.append(list);
  return wrap;
}

function renderAgents() {
  const wrap = node('div');
  wrap.append(sectionHeading('Agent management', "Review agent activity and set optional profile focus across the Super Agent and Master Agent network. Profile focus does not limit an agent's services."));
  for (const tenant of state.agentBusinessTenants ?? []) {
    wrap.append(card(`${tenant.display_name} · ${tenant.tenant_key}`, `${tenant.tenant_type.replaceAll('_', ' ')} · ${tenant.member_role.replaceAll('_', ' ')} · ${tenant.member_status} · ${tenant.status} · configuration v${tenant.config_version}`, tenant.status));
  }
  const list = node('div', undefined, 'list');
  const services = {
    financial_service: 'Financial services focus',
    growth_partnership: 'Growth & partnerships focus',
    workforce_property: 'Workforce & property focus',
  };
  if (!state.team.length) list.append(empty('No agents are available in this management scope.'));
  for (const agent of state.team) {
    const item = card(agent.legal_name, `${roleLabel(agent.role)} · ${agent.active ? 'active' : 'inactive'} · Leads ${agent.lead_count} · Contracts ${agent.contract_count} · Listings ${agent.property_count} · Profile focus: ${services[agent.service_specialization] ?? 'General agent'}`);
    if (agent.id !== state.user.id && (isPlatformAdmin() || agent.parent_id === state.user.id)) {
      const select = document.createElement('select');
      select.dataset.agentSpecialization = agent.id;
      for (const [value, label] of [['', 'General agent'], ...Object.entries(services)]) {
        const option = node('option', label); option.value = value;
        option.selected = (agent.service_specialization ?? '') === value;
        select.append(option);
      }
      item.append(select, button('Save profile focus', 'agent-specialization', 'button button-outline', { id: agent.id }));
    }
    list.append(item);
  }
  wrap.append(list);
  return wrap;
}

function renderRent() {
  const wrap = node('div');
  wrap.append(sectionHeading('Rent & deposits', 'Record payments first. A different finance officer reconciles them into the ledger.'));
  const maintenanceFinanceQueue = renderMaintenanceFinanceQueue();
  if (maintenanceFinanceQueue) wrap.append(maintenanceFinanceQueue);
  if (['global_admin','super_admin','finance','finance_manager'].includes(state.user.role)) {
    const close = node('section', undefined, 'panel form-card');
    close.append(node('h3', 'Property period-close checks'));
    close.append(node('p', 'Read-only exception checks for outstanding rent, receipts awaiting reconciliation and unbalanced rent journals. This is evidence for Finance review, not a period lock or accounting approval.'));
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'property-period-close';
    const month = new Date().toISOString().slice(0, 7);
    form.append(field('Accounting period', 'period', 'month', true, { value: month }).label);
    form.append(button('Run checks', 'submit', 'button button-primary'));
    close.append(form);
    if (state.propertyAccountingTemplate) {
      const link = button('Download chart-of-accounts draft JSON', 'coa-template-download', 'button button-outline');
      close.append(link);
      close.append(node('p', `Chart status: ${state.propertyAccountingTemplate.status}. Codes and recognition policy require Finance approval.`));
    }
    if (state.propertyPeriodClose) {
      close.append(node('p', `Period ${state.propertyPeriodClose.period}: ${state.propertyPeriodClose.ready_for_finance_review ? 'ready for Finance review' : 'exceptions found'} · pending receipts ${state.propertyPeriodClose.pending_receipts} · unpaid charges ${state.propertyPeriodClose.unpaid_rent_charges} · unbalanced journals ${state.propertyPeriodClose.unbalanced_ledger_transactions}`));
    }
    wrap.append(close);
  }
  const columns = node('div', undefined, 'columns');
  if (['global_admin', 'super_admin', 'master_agent', 'field_agent'].includes(state.user.role)) {
    const tenantForm = node('form', undefined, 'panel form-card inline-form');
    tenantForm.dataset.form = 'tenant';
    tenantForm.append(node('h3', 'Register a tenant'), field('Full name', 'name').label, field('Phone', 'phone', 'tel').label, field('National ID (optional)', 'national_id', 'text', false).label, button('Save tenant', 'submit', 'button button-primary'));
    columns.append(tenantForm);
    const leaseForm = node('form', undefined, 'panel form-card inline-form');
    leaseForm.dataset.form = 'lease';
    leaseForm.append(node('h3', 'Create a lease draft'));
    leaseForm.append(node('p', 'A lease stays inactive until independent approval, signature evidence, handover, and move-in inspection are recorded.'));
    const unit = field('Vacant unit', 'unit_id', 'select');
    const unitEmpty = node('option', 'Choose a unit'); unitEmpty.value = ''; unitEmpty.disabled = true; unitEmpty.selected = true; unit.input.append(unitEmpty);
    for (const property of state.properties) for (const entry of property.units ?? []) if (entry.occupancy === 'vacant') {
      const option = node('option', `${property.address} · ${entry.unit_no}`); option.value = entry.id; unit.input.append(option);
    }
    const tenant = field('Tenant', 'tenant_id', 'select');
    const tenantEmpty = node('option', 'Choose a tenant'); tenantEmpty.value = ''; tenantEmpty.disabled = true; tenantEmpty.selected = true; tenant.input.append(tenantEmpty);
    for (const entry of state.tenants) { const option = node('option', `${entry.name} · ${entry.phone}`); option.value = entry.id; tenant.input.append(option); }
    const commencement = field('Lease commencement date', 'start_date', 'date');
    const rentStart = field('Rent commencement date', 'rent_start_on', 'date', true);
    let rentStartWasEdited = false;
    commencement.input.addEventListener('change', () => {
      if (!rentStartWasEdited) rentStart.input.value = commencement.input.value;
    });
    rentStart.input.addEventListener('input', () => { rentStartWasEdited = true; });
    leaseForm.append(unit.label, tenant.label,
      field('Monthly rent (ETB)', 'rent', 'number', true, { min: '0.01', step: '0.01' }).label,
      field('Deposit (ETB)', 'deposit', 'number', false, { min: '0', step: '0.01', value: '0' }).label,
      commencement.label, rentStart.label,
      field('Term (months)', 'months', 'number', true, { min: '1', max: '120', value: '12' }).label,
      node('p', 'Lease commencement, rent commencement, signature, and possession handover are recorded separately.', 'muted span-2'),
      button('Create lease draft', 'submit', 'button button-primary'));
    columns.append(leaseForm);
  }
  if (['global_admin', 'super_admin', 'finance_manager'].includes(state.user.role)) {
    const pending = node('section', undefined, 'panel form-card');
    pending.append(node('h3', 'Payments awaiting reconciliation'));
    if (!state.pendingRent.length) pending.append(empty('No rent or deposit payments are awaiting reconciliation.'));
    for (const payment of state.pendingRent) {
      const item = card(t(payment.kind), `${payment.reference} · ETB ${Number(payment.amount).toLocaleString(document.documentElement.lang)}`, payment.status);
      item.append(button('Reconcile payment', 'rent-reconcile', 'button button-primary', { id: payment.id })); pending.append(item);
      item.append(button('Void receipt', 'rent-void', 'button button-outline', { id: payment.id }));
    }
    columns.append(pending);
  }
  const leases = node('div', undefined, 'list');
  if (!state.leases.length) leases.append(empty('No leases are available for your account.'));
  for (const lease of state.leases) {
    const item = card(`${lease.address} · ${lease.unit_no}`, t('{{tenant}} · ETB {{rent}} monthly · {{status}}', { tenant: lease.tenant_name, rent: Number(lease.rent).toLocaleString(document.documentElement.lang), status: t(lease.status) }), lease.status);
    item.dataset.lease = lease.id;
    item.append(node('p', t(
      'Lease commencement: {{commencement}} · Rent commencement: {{rentStart}} · Possession handover: {{handover}}.',
      {
        commencement: lease.start_date, rentStart: lease.rent_start_on,
        handover: lease.possession_handover_on ?? t('not recorded'),
      },
    ), 'muted'));
    if (lease.notice_type) {
      item.append(node('p', `Latest operational notice: ${lease.notice_type}, received ${lease.notice_received_on}, proposed effective ${lease.proposed_effective_on}. This is not legal validation or lease termination.`));
    }
    item.append(node('p', t(
      'Lease commencement: {{commencement}} · Rent commencement: {{rentStart}} · Possession handover: {{handover}}.',
      {
        commencement: lease.start_date, rentStart: lease.rent_start_on,
        handover: lease.possession_handover_on ?? t('not recorded'),
      },
    ), 'muted'));
    if (lease.status !== 'active' && lease.status !== 'ended') {
      item.append(node('p', 'Signature uploads are evidence only and do not verify signer identity or legal validity.'));
    }
    if (hasActivity('property.tenancy.manage')) {
      for (const account of lease.tenant_access_accounts ?? []) {
        item.append(node('p', `Resident portal linked: ${account.legal_name}.`, 'muted'),
          button('Revoke resident portal access', 'tenant-access-revoke', 'button button-outline', {
            id: lease.id, linkId: account.id,
          }));
      }
      if (lease.status === 'active') {
        item.append(button('Issue one-time resident access code', 'tenant-access-invite', 'button button-outline', { id: lease.id }));
        item.append(node('p', 'The code is displayed once. Deliver it to the tenant through a separately verified contact channel; there is no automatic SMS delivery.', 'muted'));
      }
    }
    if (lease.status === 'active' && hasActivity('property.tenancy.manage')) {
      const noticeForm = node('form', undefined, 'inline-form');
      noticeForm.dataset.form = 'lease-notice';
      noticeForm.dataset.lease = lease.id;
      const noticeType = field('Notice direction', 'notice_type', 'select');
      for (const [value, label] of [
        ['tenant_to_owner', 'Tenant to owner'],
        ['owner_to_tenant', 'Owner to tenant'],
        ['mutual_agreement', 'Mutual agreement'],
        ['other', 'Other'],
      ]) {
        const option = node('option', label);
        option.value = value;
        noticeType.input.append(option);
      }
      noticeForm.append(
        node('h4', 'Record a notice (operational record only)'),
        noticeType.label,
        field('Received date', 'received_on', 'date', true, { value: new Date().toISOString().slice(0, 10) }).label,
        field('Proposed effective date', 'proposed_effective_on', 'date', true).label,
        field('Summary (do not include sensitive personal details)', 'summary', 'textarea', true, { minlength: '10', maxlength: '1000' }).label,
        button('Record notice', 'submit', 'button button-outline'),
        node('p', 'Recording does not verify legal service, create a legally valid notice, change lease status, or end the lease.'),
      );
      item.append(noticeForm);
    }
    const openRenewalOffer = (lease.renewal_offers ?? []).some((offer) =>
      ['pending_approval', 'offered', 'accepted'].includes(offer.status));
    if (lease.status === 'active' && hasActivity('property.tenancy.manage') && !openRenewalOffer) {
      const renewalForm = node('form', undefined, 'inline-form');
      renewalForm.dataset.form = 'lease-renewal-offer';
      renewalForm.dataset.lease = lease.id;
      const nextDay = new Date(`${lease.end_date}T00:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const renewalStart = nextDay.toISOString().slice(0, 10);
      const expires = new Date(`${renewalStart}T00:00:00Z`);
      expires.setUTCDate(expires.getUTCDate() - 1);
      renewalForm.append(
        node('h4', 'Prepare renewal terms for independent approval'),
        field('Proposed monthly rent (ETB)', 'proposed_rent', 'number', true, { min: '0.01', step: '0.01', value: String(lease.rent) }).label,
        field('Proposed deposit (ETB)', 'proposed_deposit', 'number', true, { min: '0', step: '0.01', value: String(lease.deposit) }).label,
        field('Renewal start date', 'proposed_start_date', 'date', true, { min: renewalStart, value: renewalStart }).label,
        field('Renewal term (months)', 'term_months', 'number', true, { min: '1', max: '120', value: String(lease.term_months ?? 24) }).label,
        field('Rent due day', 'due_day', 'number', false, { min: '1', max: '28', value: String(lease.due_day ?? 5) }).label,
        field('Offer expires on', 'expires_on', 'date', true, { min: new Date().toISOString().slice(0, 10), value: expires.toISOString().slice(0, 10) }).label,
        field('Approval reason', 'reason', 'textarea', true, { minlength: '10', maxlength: '1000' }).label,
        button('Submit renewal offer for approval', 'submit', 'button button-outline'),
        node('p', 'An approved offer is sent to linked resident accounts. Acceptance creates only a new lease draft; it does not extend this lease or post rent.', 'muted'),
      );
      renewalForm.elements.proposed_start_date.addEventListener('change', () => {
        const start = new Date(`${renewalForm.elements.proposed_start_date.value}T00:00:00Z`);
        start.setUTCDate(start.getUTCDate() - 1);
        renewalForm.elements.expires_on.max = start.toISOString().slice(0, 10);
        if (renewalForm.elements.expires_on.value >= renewalForm.elements.proposed_start_date.value) {
          renewalForm.elements.expires_on.value = start.toISOString().slice(0, 10);
        }
      });
      renewalForm.elements.expires_on.max = expires.toISOString().slice(0, 10);
      item.append(renewalForm);
    }
    for (const offer of lease.renewal_offers ?? []) {
      if (offer.status === 'pending_approval'
        && hasActivity('property.tenancy.approve') && hasActivity('property.tenancy.manage')) {
        item.append(
          button('Approve and send renewal offer', 'lease-renewal-offer', 'button button-primary', { id: offer.id, leaseId: lease.id }),
          button('Reject renewal offer', 'lease-renewal-reject', 'button button-outline', { id: offer.id, leaseId: lease.id }),
        );
      }
      if (offer.status === 'accepted' && !offer.converted_lease_id && hasActivity('property.tenancy.manage')) {
        item.append(button('Create renewal lease draft', 'lease-renewal-convert', 'button button-primary', { id: offer.id }));
      }
      if (offer.converted_lease_id) {
        item.append(node('p', `Renewal lease draft ${offer.converted_lease_id} was created and must complete normal approval, signature, and handover steps.`, 'muted'));
      }
    }
    const moveOutInspections = lease.move_out_inspections ?? [];
    for (const inspection of moveOutInspections) {
      item.append(node('p',
        `Move-out inspection revision ${inspection.revision}: ${inspection.status} · vacated ${inspection.actual_vacated_on} · inspected ${inspection.inspected_on} · keys returned ${inspection.keys_returned ? 'yes' : 'no'} · proposed deposit deduction ETB ${inspection.deposit_deduction}${inspection.deduction_reason ? ` (${inspection.deduction_reason})` : ''}${inspection.review_note ? ` · review: ${inspection.review_note}` : ''}`,
        'muted'));
      for (const evidence of inspection.evidence ?? []) {
        item.append(
          button(`Download move-out evidence · ${evidence.mime}`, 'resident-move-out-evidence', 'button button-outline', { id: evidence.id }),
        );
      }
      if (inspection.status === 'pending_review' && hasActivity('property.tenancy.manage')) {
        item.append(button('Upload move-out evidence', 'move-out-evidence-upload', 'button button-outline', {
          id: inspection.id, leaseId: lease.id,
        }));
      }
      if (inspection.status === 'pending_review' && hasActivity('property.tenancy.approve')
        && inspection.submitted_by !== state.user.id) {
        item.append(
          button('Approve move-out inspection', 'move-out-approve', 'button button-primary', {
            id: inspection.id, leaseId: lease.id,
          }),
          button('Reject move-out inspection', 'move-out-reject', 'button button-outline', {
            id: inspection.id, leaseId: lease.id,
          }),
        );
      }
    }
    const approvedMoveOut = moveOutInspections.some((inspection) => inspection.status === 'approved');
    const pendingMoveOut = moveOutInspections.some((inspection) => inspection.status === 'pending_review');
    if (lease.status === 'active' && hasActivity('property.tenancy.manage')
      && !approvedMoveOut && !pendingMoveOut) {
      item.append(button('Submit move-out inspection', 'move-out-submit', 'button button-outline', { id: lease.id }));
    }
    if (lease.status === 'draft' && hasActivity('property.tenancy.manage')
      && (lease.created_by === state.user.id || isPlatformAdmin())) {
      item.append(button('Submit for approval', 'lease-submit-approval', 'button button-primary', { id: lease.id }));
    }
    if (lease.status === 'pending_approval' && hasActivity('property.tenancy.approve')) {
      item.append(button('Approve lease', 'lease-approve', 'button button-primary', { id: lease.id }));
    }
    if (lease.status === 'pending_signature' && hasActivity('property.tenancy.manage')) {
      for (const party of ['tenant', 'owner']) {
        const evidenceExists = party === 'tenant' ? lease.tenant_signature_evidence : lease.owner_signature_evidence;
        if (evidenceExists) {
          item.append(node('p', `${party === 'tenant' ? 'Tenant' : 'Owner'} signature evidence uploaded.`));
          continue;
        }
        const evidenceForm = node('form', undefined, 'inline-form');
        evidenceForm.dataset.form = 'lease-signature';
        evidenceForm.dataset.lease = lease.id;
        evidenceForm.dataset.party = party;
        evidenceForm.append(
          field(`${party === 'tenant' ? 'Tenant' : 'Owner'} signer name`, 'signer_name', 'text', true, { minlength: '2', maxlength: '200' }).label,
          field(`${party === 'tenant' ? 'Tenant' : 'Owner'} signature evidence (PDF, JPEG, PNG)`, 'signature_document', 'file', true, { accept: 'application/pdf,image/jpeg,image/png' }).label,
          button(`Upload ${party} evidence`, 'submit', 'button button-outline'),
        );
        item.append(evidenceForm);
      }
      if (hasActivity('property.tenancy.execute')
        && lease.tenant_signature_evidence && lease.owner_signature_evidence) {
        item.append(button('Record handover & activate', 'lease-execute', 'button button-primary', { id: lease.id }));
      }
    }
    item.append(button('View charges & payments', 'lease-payments', 'button button-outline', { id: lease.id }));
    if (hasActivity('property.tenancy.manage') && lease.status === 'active' && approvedMoveOut) {
      item.append(button('End lease after move-out review', 'lease-end', 'button button-outline', { id: lease.id }));
    }
    if (['master_agent', 'field_agent', 'finance', 'finance_manager', 'global_admin', 'super_admin'].includes(state.user.role) && lease.status === 'active' && Number(lease.deposit) > 0) item.append(button('Record deposit', 'deposit-pay', 'button button-outline', { id: lease.id }));
    if (hasActivity('rent.deposit.refund_request') && lease.status === 'ended' && Number(lease.deposit) > 0 && approvedMoveOut) item.append(button('Return deposit', 'deposit-refund', 'button button-outline', { id: lease.id }));
    leases.append(item);
  }
  columns.append(leases); wrap.append(columns); return wrap;
}

function renderBusinessRules() {
  const panel = node('section', undefined, 'panel form-card');
  panel.append(
    node('h3', 'Business rules'),
    node('p', 'Changes apply to new calculations immediately. Unsigned contracts are repriced; signed contracts, recorded payments, and ledger entries are not rewritten.'),
    node('p', 'Required identity and police-clearance checks, role permissions, and separate payment approvals cannot be disabled here.'),
  );
  const form = node('form', undefined, 'inline-form business-rules-form');
  form.dataset.form = 'business-rules';
  let group = '';
  for (const rule of state.businessRules) {
    if (rule.group !== group) {
      group = rule.group;
      const heading = node('h4', group);
      heading.className = 'span-2';
      form.append(heading);
    }
    const input = document.createElement('input');
    input.name = rule.key;
    input.type = rule.step === 1 && rule.max === 1 ? 'checkbox' : 'number';
    if (input.type === 'checkbox') {
      input.checked = Number(rule.value) === 1;
    } else {
      input.min = String(rule.min);
      input.max = String(rule.max);
      input.step = String(rule.step);
      input.value = String(rule.value);
      input.required = true;
    }
    const label = node('label', rule.label);
    if (input.type === 'checkbox') label.className = 'business-rule-toggle';
    label.append(input);
    form.append(label);
  }
  form.append(button('Save business rules', 'submit', 'button button-primary span-2'));
  panel.append(form);
  return panel;
}

function renderGlobalAdminPromotions() {
  const section = node('section', undefined, 'panel form-card');
  section.style.marginTop = '20px';
  section.append(node('h3', 'Global Admin role promotion'));
  section.append(node('p', 'Promotion requires two different active, MFA-enabled Super Admins. Global Admin access does not bypass financial maker-checker approvals.'));
  if (state.user.role === 'super_admin') {
    const candidates = state.users.filter((user) =>
      user.id !== state.user.id && user.active && user.mfa_enabled && user.role === 'super_admin');
    if (candidates.length) {
      const form = node('form', undefined, 'inline-form');
      form.dataset.form = 'global-admin-promotion';
      const target = field('Nominate an eligible Super Admin', 'target_user_id', 'select');
      const placeholder = node('option', 'Choose a Super Admin'); placeholder.value = ''; placeholder.disabled = true; placeholder.selected = true;
      target.input.append(placeholder);
      for (const candidate of candidates) {
        const option = node('option', `${candidate.legal_name} · ${candidate.phone}`);
        option.value = candidate.id;
        target.input.append(option);
      }
      form.append(target.label, button('Request Global Admin promotion', 'submit', 'button button-primary'));
      section.append(form);
    } else {
      section.append(node('p', 'No other active, MFA-enabled Super Admin is currently eligible for nomination.'));
    }
  }

  const history = node('div', undefined, 'list');
  history.append(node('h4', 'Promotion requests'));
  if (!state.globalAdminPromotions.length) {
    history.append(empty('No Global Admin promotion requests have been submitted.'));
  } else {
    for (const request of state.globalAdminPromotions) {
      const item = card(request.target_name, `${request.status} · Requested by ${request.requester_name} · ${request.created_at}`, request.status);
      if (request.approver_name) item.append(node('p', `Decision by ${request.approver_name}: ${request.decision_reason}`));
      const canDecide = state.user.role === 'super_admin'
        && request.status === 'pending'
        && request.requested_by !== state.user.id
        && request.target_user_id !== state.user.id;
      if (canDecide) {
        item.append(button('Approve promotion', 'global-promotion-approve', 'button button-primary', { id: request.id }));
        item.append(button('Reject promotion', 'global-promotion-reject', 'button button-outline', { id: request.id }));
      }
      history.append(item);
    }
  }
  section.append(history);
  return section;
}

function renderRoleAccess() {
  if (state.user.role !== 'global_admin' || !state.roleAccess) return document.createDocumentFragment();
  const section = node('section', undefined, 'panel form-card role-access');
  section.append(
    node('h3', 'Role and activity access'),
    node('p', 'Select the activities each role may perform. Sensitive financial actions remain subject to transaction controls and independent-actor checks. Tenant Super Admin scope is managed through tenant assignments.'),
  );
  const form = node('form', undefined, 'role-access-form');
  form.dataset.form = 'role-access';
  for (const role of state.roleAccess.roles.filter((entry) => entry.editable)) {
    const group = node('fieldset', undefined, 'role-access-group');
    group.append(node('legend', roleLabel(role.key)));
    const overrides = state.roleAccess.overrides[role.key] ?? {};
    for (const activity of state.roleAccess.activities) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.role = role.key;
      input.dataset.activity = activity.key;
      const defaults = activity.defaultRoles.includes(role.key)
        || (role.key === 'global_admin' && activity.defaultRoles.includes('super_admin'));
      input.checked = overrides[activity.key] ?? defaults;
      const label = node('label', `${activity.group} · ${activity.label}${activity.sensitive ? ' · Sensitive' : ''}`, 'role-access-option');
      label.prepend(input);
      group.append(label);
    }
    form.append(group);
  }
  form.append(button('Save role access', 'submit', 'button button-primary'));
  section.append(form);
  return section;
}

function renderReadinessEvidence() {
  const section = node('section', undefined, 'panel form-card');
  section.style.marginTop = '20px';
  section.append(node('h3', 'Production readiness evidence'));
  section.append(node('p', 'Append operational evidence for each service. Records are stored in the shared database and attributed to the signed-in administrator. An evidence record does not itself grant legal, provider, finance, or production authorization.'));
  const insuranceGates = [
    ['insurance_license', 'Broker licence and permitted class', 'Verified NBE licence, class scope, effective dates, source, and independent verification evidence.'],
    ['insurance_professional_indemnity', 'Professional indemnity', 'Valid PI policy, insurer, coverage, dates, filing evidence, and the compliance owner’s documented minimum-coverage calculation.'],
    ['insurance_ceo_oversight', 'CEO and management oversight', 'Qualified CEO evidence, appointment history, day-to-day oversight, and management-change notification procedure.'],
    ['insurance_branch_oversight', 'Branch governance', 'Branch manager, address, opening/closure notice evidence, and pending-business disposition plan.'],
    ['insurance_market_comparison', 'Three-insurer comparison', 'Versioned workflow and evidence that each risk is offered to at least three insurers with analysis of price, cover, and insurer reputation.'],
    ['insurance_customer_choice_exception', 'Customer-selected insurer exception', 'Written customer statement, linked risk and insurer, authenticity checks, and independent review; no unrestricted bypass.'],
    ['insurance_disclosure_consent', 'Disclosure, advice, and consent', 'Needs assessment, material-fact notice, advice rationale, final terms shown, and consent tied to the selected proposal.'],
    ['insurance_policy_issuance', 'Policy issuance evidence', 'Insurer-authoritative issue/cover confirmation and immutable policy snapshot; submission alone is not issuance.'],
    ['insurance_premium_custody', 'Premium and funds custody boundary', 'Approved authority and insurer agreement before collection; otherwise clear evidence-only accounting and reconciliation boundary.'],
    ['insurance_claims_records', 'Client and claims records', 'Required policy/client/claim register fields, access scope, correction history, and retention owner.'],
    ['insurance_data_rights', 'Privacy and data rights', 'Data inventory, purpose/lawful-basis review, rights-request workflow, retention schedule, legal holds, and processor/transfer review.'],
    ['insurance_tenant_isolation', 'Tenant isolation', 'Negative access evidence for APIs, database, files, exports, background jobs, notifications, and analytics.'],
    ['insurance_integration_reconciliation', 'Insurer integration and reconciliation', 'Versioned schemas, idempotency, bounded retries, exception queue, manual fallback, and settlement reconciliation evidence.'],
    ['insurance_business_continuity', 'Continuity and recovery', 'Approved RTO/RPO, encrypted backups, restore evidence for databases/files/configuration, and incident-response exercise.'],
    ['insurance_global_financial_reporting', 'Global Insurance financial reporting', 'A separate Insurance database and ledger with tenant-scoped books, audited global aggregation, reconciled insurer settlements, and exportable period reports.'],
    ['insurance_commission_distribution', 'Agent commission distribution', 'Versioned, approved insurer/broker agreements; explainable agent and Master/Super Agent splits; eligibility, caps, clawbacks, maker-checker approval, and payout reconciliation.'],
    ['insurance_legal_signoff', 'Legal and release sign-off', 'Local legal/compliance applicability review, assigned owners, witnessed UAT, security review, and separate production release approval.'],
  ];
  const gateList = node('div', undefined, 'list');
  gateList.append(node('h4', 'Insurance brokerage regulatory release gates'));
  gateList.append(node('p', 'Evidence is a readiness record, not a regulatory approval or certification. Live brokerage activity remains disabled until all applicable gates are independently reviewed and separately approved.'));
  const latestByCategory = new Map();
  for (const evidence of state.readinessEvidence) {
    if (evidence.module === 'insurance' && !latestByCategory.has(evidence.category)) latestByCategory.set(evidence.category, evidence);
  }
  for (const [categoryKey, title, requirement] of insuranceGates) {
    const evidence = latestByCategory.get(categoryKey);
    const gate = card(title, requirement, evidence?.status ?? 'open');
    if (evidence) {
      gate.append(node('p', `Latest evidence: ${evidence.evidence_reference} · ${evidence.owner_name} · ${new Date(evidence.created_at).toLocaleDateString(document.documentElement.lang)}`));
      gate.append(node('p', evidence.notes || 'No review notes recorded.'));
    } else {
      gate.append(node('p', 'No evidence recorded.'));
    }
    gateList.append(gate);
  }
  section.append(gateList);
  const form = node('form', undefined, 'inline-form');
  form.dataset.form = 'readiness-evidence';
  form.append(
    field('Service / module', 'module', 'select', true).label,
    field('Evidence category', 'category', 'select', true).label,
    field('Owner / domain', 'owner', 'text', true, { placeholder: 'Legal, Finance, Provider, Ops, Security' }).label,
    field('Approver / reviewer', 'approver', 'text', true, { placeholder: 'Named approver' }).label,
    field('Status', 'status', 'select', true).label,
    field('Evidence reference', 'evidence_ref', 'text', true, { placeholder: 'contract, ticket, control ID, provider record' }).label,
    field('Environment', 'environment', 'select', true).label,
    field('Approval notes', 'notes', 'textarea', false, { rows: '3', placeholder: 'Required conditions, review outcome, or unresolved risk.' }).label,
  );
  const moduleSelect = form.elements.module;
  for (const value of ['platform', 'workforce', 'insurance', 'mfi', 'edir', 'property', 'marketplace', 'agency']) {
    const option = node('option', value.toUpperCase()); option.value = value; moduleSelect.append(option);
  }
  const category = form.elements.category;
  const evidenceCategories = [
    'legal', 'provider', 'finance', 'security', 'operations', 'accessibility', 'capacity', 'dr', 'incident', 'service_account', 'release_owner', 'privacy',
    'insurance_license','insurance_professional_indemnity','insurance_ceo_oversight','insurance_branch_oversight',
    'insurance_market_comparison','insurance_customer_choice_exception','insurance_disclosure_consent',
    'insurance_policy_issuance','insurance_premium_custody','insurance_claims_records','insurance_data_rights',
    'insurance_tenant_isolation','insurance_integration_reconciliation','insurance_business_continuity',
    'insurance_global_financial_reporting','insurance_commission_distribution','insurance_legal_signoff',
  ];
  for (const value of evidenceCategories) {
    const option = node('option', value.replaceAll('_', ' ')); option.value = value; category.append(option);
  }
  const statusSelect = form.elements.status;
  for (const value of ['open', 'evidence_recorded', 'blocked', 'not_applicable']) {
    const option = node('option', value.replaceAll('_', ' ')); option.value = value; statusSelect.append(option);
  }
  const environmentSelect = form.elements.environment;
  for (const value of ['production', 'staging', 'sandbox', 'development']) {
    const option = node('option', value); option.value = value; environmentSelect.append(option);
  }
  form.append(button('Record evidence', 'submit', 'button button-primary span-2'));
  section.append(form);
  const list = node('div', undefined, 'list');
  if (!state.readinessEvidence.length) list.append(empty('No operational-readiness evidence has been recorded yet.'));
  for (const entry of state.readinessEvidence) {
    const item = card(`${entry.module.toUpperCase()} · ${entry.category.replaceAll('_', ' ')} · ${entry.owner_name}`, `${entry.environment} · approver/reviewer ${entry.approver_name} · ${entry.status.replaceAll('_', ' ')}`, entry.status);
    item.append(node('p', `Recorded by ${entry.recorded_by_name} (${entry.recorded_by_role}) · ${new Date(entry.created_at).toLocaleString(document.documentElement.lang)}`));
    if (entry.evidence_reference) item.append(node('p', `Reference: ${entry.evidence_reference}`));
    if (entry.notes) item.append(node('p', entry.notes));
    list.append(item);
  }
  section.append(list);
  return section;
}

function renderPlatformControlPlane() {
  const section = node('section', undefined, 'panel form-card');
  section.style.marginTop = '20px';
  section.append(node('h3', 'Tenant and service control plane'));
  section.append(node('p', 'Manage platform services, packages, tenant deployments, assignments, and non-financial catalog products. Tenant database credentials and infrastructure secrets are never stored here. Package availability affects workspace modules only when an authorized platform-tenant context is selected; it does not replace user role, activity, or service checks.'));
  const contextTenants = (state.user.role === 'super_admin' ? state.tenantAdminTenants : state.platformTenants)
    .filter((tenant) => tenant.status === 'active');
  const tenantContext = field('Active platform tenant context', 'platform_tenant_context', 'select');
  tenantContext.input.dataset.platformTenantContext = 'true';
  const noContext = node('option', 'No tenant package context'); noContext.value = ''; tenantContext.input.append(noContext);
  for (const tenant of contextTenants) {
    const option = node('option', `${tenant.display_name} · ${tenant.tenant_key}`); option.value = tenant.id;
    tenantContext.input.append(option);
  }
  tenantContext.input.value = state.platformTenantContextId ?? '';
  section.append(tenantContext.label);

  const packageForm = node('form', undefined, 'inline-form');
  packageForm.dataset.form = 'platform-service-package';
  packageForm.append(
    field('Package key', 'package_key', 'text', true, { pattern: '[a-z][a-z0-9_-]{1,79}', placeholder: 'full-platform' }).label,
    field('Package name', 'display_name').label,
    field('Description', 'description', 'text', true, { maxlength: '1000' }).label,
  );
  const services = node('fieldset', undefined, 'span-2');
  services.append(node('legend', 'Services included'));
  for (const service of state.platformServices.filter((item) => item.available)) {
    const label = node('label', service.display_name);
    const check = node('input');
    check.type = 'checkbox';
    check.name = 'services';
    check.value = service.service_key;
    label.prepend(check);
    services.append(label);
  }
  packageForm.append(services, button('Create service package', 'submit', 'button button-primary span-2'));
  section.append(packageForm);

  const packageList = node('div', undefined, 'list');
  for (const item of state.platformServicePackages) {
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'platform-service-package-update';
    form.dataset.packageId = item.id;
    const active = field('Package active', 'active', 'select');
    for (const [value, labelText] of [['true', 'Yes'], ['false', 'No']]) {
      const option = node('option', labelText); option.value = value; active.input.append(option);
    }
    active.input.value = String(item.active);
    form.append(
      field('Package', 'display_name', 'text', true, { value: item.display_name }).label,
      field('Description', 'description', 'text', true, { value: item.description, maxlength: '1000' }).label,
      active.label,
    );
    const servicesField = node('fieldset', undefined, 'span-2');
    servicesField.append(node('legend', 'Included services'));
    for (const service of state.platformServices) {
      const label = node('label', service.display_name);
      const check = node('input');
      check.type = 'checkbox';
      check.name = 'services';
      check.value = service.service_key;
      check.checked = item.services.includes(service.service_key);
      check.disabled = !service.available && !check.checked;
      label.prepend(check);
      servicesField.append(label);
    }
    form.append(servicesField, button('Save package', 'submit', 'button button-outline span-2'));
    packageList.append(form);
  }
  if (!state.platformServicePackages.length) packageList.append(empty('No service packages are configured yet.'));
  section.append(packageList);

  const tenantForm = node('form', undefined, 'inline-form');
  tenantForm.dataset.form = 'platform-tenant';
  tenantForm.append(
    field('Tenant key', 'tenant_key', 'text', true, { pattern: '[a-z][a-z0-9-]{1,79}', placeholder: 'afrolife-legacy' }).label,
    field('Tenant name', 'display_name').label,
    field('Hosting mode', 'hosting_mode', 'select').label,
    field('Region (optional)', 'region', 'text', false, { maxlength: '120' }).label,
    field('Deployment reference (no URL or secret)', 'deployment_reference', 'text', false, { maxlength: '200', placeholder: 'deployment inventory reference' }).label,
    field('Service package', 'package_id', 'select').label,
  );
  for (const [value, labelText] of [['cloud', 'Cloud'], ['on_premises', 'On premises']]) {
    const option = node('option', labelText); option.value = value; tenantForm.elements.hosting_mode.append(option);
  }
  const packageSelect = tenantForm.elements.package_id;
  const packagePlaceholder = node('option', 'Choose service package'); packagePlaceholder.value = ''; packageSelect.append(packagePlaceholder);
  for (const item of state.platformServicePackages.filter((entry) => entry.active)) {
    const option = node('option', `${item.display_name} · ${item.services.length} services`); option.value = item.id; packageSelect.append(option);
  }
  tenantForm.append(button('Register tenant', 'submit', 'button button-primary span-2'));
  section.append(tenantForm);

  const serviceList = node('div', undefined, 'list');
  for (const service of state.platformServices) {
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'platform-service';
    form.dataset.serviceKey = service.service_key;
    const available = field('Available', 'available', 'select');
    for (const [value, labelText] of [['true', 'Yes'], ['false', 'No']]) {
      const option = node('option', labelText); option.value = value; available.input.append(option);
    }
    available.input.value = String(service.available);
    form.append(
      field('Service', 'display_name', 'text', true, { value: service.display_name }).label,
      field('Description', 'description', 'text', true, { value: service.description, maxlength: '1000' }).label,
      available.label,
      button('Save service', 'submit', 'button button-outline'),
    );
    serviceList.append(form);
  }
  section.append(serviceList);

  if (state.user.role === 'global_admin') {
    const businessTenants = node('div', undefined, 'list');
    businessTenants.append(node('h3', 'Agent and Super Admin business tenants'));
    businessTenants.append(node('p', 'These are business workspaces in the Global Platform. They are separate from deployment tenants, which track hosting and infrastructure. Master Agents own agent-network tenants; their Field Agents join through the registered parent relationship. Tenant Super Admins have their own tenant boundary.'));
    if (!state.businessTenants.length) businessTenants.append(empty('No Agent Network or Super Admin business tenants are registered.'));
    for (const tenant of state.businessTenants) {
      const item = card(`${tenant.display_name} · ${tenant.tenant_key}`, `${tenant.tenant_type.replaceAll('_', ' ')} · ${tenant.owner_role} · ${tenant.status} · owner ${tenant.owner_active ? 'active' : 'inactive'} · KYC ${tenant.owner_kyc_status}`, tenant.status);
      item.append(node('p', `Owner: ${tenant.owner_name} · ${tenant.owner_phone} · configuration v${tenant.config_version}`));
      for (const member of tenant.members ?? []) {
        item.append(node('p', `${member.legal_name} · ${member.role.replaceAll('_', ' ')} · ${member.status} · ${member.phone}`));
      }
      businessTenants.append(item);
    }
    section.append(businessTenants);
  }

  const tenants = node('div', undefined, 'list');
  if (!state.platformTenants.length) tenants.append(empty('No tenant deployments are registered yet.'));
  for (const tenant of state.platformTenants) {
    const item = card(
      `${tenant.display_name} · ${tenant.tenant_key}`,
      `${tenant.hosting_mode.replaceAll('_', ' ')} · ${tenant.region ?? 'region not set'} · deployment ${tenant.deployment_status} · configuration v${tenant.config_version}`,
      tenant.status,
    );
    item.append(node('p', `Packages: ${tenant.packages.map((entry) => entry.display_name).join(', ') || 'none'}`));
    if (tenant.deployment_reference) item.append(node('p', `Deployment reference: ${tenant.deployment_reference}`));
    if (tenant.deployment_verification_reference) item.append(node('p', `Verification evidence reference: ${tenant.deployment_verification_reference}`));
    const assignedAdmins = node('div', undefined, 'list');
    for (const administrator of tenant.admins ?? []) {
      const assignment = card(administrator.legal_name, administrator.phone, 'assigned Super Admin');
      assignment.append(button('Remove tenant assignment', 'tenant-admin-remove', 'button button-outline', {
        tenantId: tenant.id, userId: administrator.id,
      }));
      assignedAdmins.append(assignment);
    }
    const assignmentForm = node('form', undefined, 'inline-form');
    assignmentForm.dataset.form = 'platform-tenant-admin';
    assignmentForm.dataset.tenantId = tenant.id;
    const adminField = field('Assign Super Admin', 'user_id', 'select');
    const adminPlaceholder = node('option', 'Choose an active Super Admin'); adminPlaceholder.value = ''; adminField.input.append(adminPlaceholder);
    for (const user of state.platformSuperAdmins.filter((candidate) =>
      !(tenant.admins ?? []).some((assigned) => assigned.id === candidate.id))) {
      const option = node('option', `${user.legal_name} · ${user.phone}`); option.value = user.id; adminField.input.append(option);
    }
    assignmentForm.append(adminField.label, button('Grant this tenant scope', 'submit', 'button button-outline'));
    item.append(assignedAdmins, assignmentForm);
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'platform-tenant-update';
    form.dataset.tenantId = tenant.id;
    const status = field('Tenant status', 'status', 'select');
    for (const value of ['provisioning', 'active', 'suspended', 'retired']) {
      const option = node('option', value.replaceAll('_', ' ')); option.value = value; status.input.append(option);
    }
    status.input.value = tenant.status;
    const deployment = field('Deployment verification', 'deployment_status', 'select');
    for (const value of ['not_registered', 'registered', 'verified']) {
      const option = node('option', value.replaceAll('_', ' ')); option.value = value; deployment.input.append(option);
    }
    deployment.input.value = tenant.deployment_status;
    const verification = field(
      'Verification evidence reference (non-secret)',
      'deployment_verification_reference',
      'text',
      false,
      { maxlength: '200', value: tenant.deployment_verification_reference ?? '', placeholder: 'release or attestation record ID' },
    );
    verification.input.required = deployment.input.value === 'verified' && !tenant.deployment_verification_reference;
    deployment.input.addEventListener('change', () => {
      verification.input.required = deployment.input.value === 'verified' && !tenant.deployment_verification_reference;
    });
    const packageField = field('Service package', 'package_id', 'select', false);
    const none = node('option', 'Keep current packages'); none.value = ''; packageField.input.append(none);
    for (const entry of state.platformServicePackages.filter((candidate) => candidate.active)) {
      const option = node('option', entry.display_name); option.value = entry.id; packageField.input.append(option);
    }
    form.append(status.label, deployment.label, verification.label, packageField.label, button('Update tenant', 'submit', 'button button-outline'));
    item.append(form);
    tenants.append(item);
  }
  section.append(tenants);

  const productForm = node('form', undefined, 'inline-form');
  productForm.dataset.form = 'platform-catalog-product';
  productForm.append(
    field('Product key', 'product_key', 'text', true, { pattern: '[a-z][a-z0-9_-]{1,79}', placeholder: 'household-support-plan' }).label,
    field('Product name', 'display_name').label,
    field('Description', 'description', 'text', true, { maxlength: '2000' }).label,
    field('Catalog category', 'category', 'select').label,
  );
  for (const value of ['catalog', 'marketplace', 'service_addon']) {
    const option = node('option', value.replaceAll('_', ' ')); option.value = value; productForm.elements.category.append(option);
  }
  productForm.append(button('Create catalog product', 'submit', 'button button-primary span-2'));
  section.append(productForm);
  const products = node('div', undefined, 'list');
  if (!state.platformCatalogProducts.length) products.append(empty('No non-financial catalog products are configured.'));
  for (const product of state.platformCatalogProducts) {
    const item = card(`${product.display_name} · ${product.product_key}`, `${product.category} · ${product.description}`, product.status);
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'platform-catalog-product-update';
    form.dataset.productId = product.id;
    const status = field('Product status', 'status', 'select');
    for (const value of ['draft', 'active', 'retired']) {
      const option = node('option', value); option.value = value; status.input.append(option);
    }
    status.input.value = product.status;
    form.append(
      field('Name', 'display_name', 'text', true, { value: product.display_name }).label,
      field('Description', 'description', 'text', true, { value: product.description, maxlength: '2000' }).label,
      status.label,
      button('Save product', 'submit', 'button button-outline'),
    );
    item.append(form);
    products.append(item);
  }
  section.append(products);
  return section;
}

function renderTenantAdminWorkspace() {
  const section = node('section', undefined, 'panel form-card');
  section.style.marginTop = '20px';
  section.append(node('h3', 'Assigned business entities'));
  section.append(node('p', 'Configure business modules only within entities assigned by the Global System Admin. Global System Admin controls tenant onboarding, service packages, platform-wide module availability, and Super Admin assignments.'));
  if (!state.tenantAdminTenants.length) {
    section.append(empty('No tenant entity has been assigned to this Super Admin. Ask the Global System Admin to assign an entity.'));
    return section;
  }
  const activeTenants = state.tenantAdminTenants.filter((tenant) => tenant.status === 'active');
  if (activeTenants.length > 0) {
    const context = field('Active business entity', 'platform_tenant_context', 'select');
    context.input.dataset.platformTenantContext = 'true';
    const placeholder = node('option', 'Select an assigned entity'); placeholder.value = ''; context.input.append(placeholder);
    for (const tenant of activeTenants) {
      const option = node('option', `${tenant.display_name} · ${tenant.tenant_key}`);
      option.value = tenant.id;
      context.input.append(option);
    }
    context.input.value = state.platformTenantContextId ?? '';
    section.append(context.label);
    if (!state.platformTenantContextId) {
      section.append(node('p', 'Choose an assigned active entity to open its approved business modules.'));
    }
  }
  for (const tenant of state.tenantAdminTenants) {
    const item = card(`${tenant.display_name} · ${tenant.tenant_key}`,
      `${tenant.hosting_mode.replaceAll('_', ' ')} · ${tenant.region ?? 'region not set'} · ${tenant.status}`,
      `deployment ${tenant.deployment_status}`);
    for (const configured of tenant.configured_packages ?? []) {
      item.append(node('p', `Global System Admin package: ${configured.display_name} · ${(configured.services ?? []).join(', ') || 'No services'}`));
    }
    if (tenant.status === 'active') {
      const form = node('form', undefined, 'inline-form');
      form.dataset.form = 'tenant-module-config';
      form.dataset.tenantId = tenant.id;
      const services = node('fieldset', undefined, 'span-2');
      services.append(node('legend', 'Enabled business modules'));
      const selected = new Set(tenant.enabled_services ?? []);
      for (const service of tenant.available_services ?? []) {
        const label = node('label', service.replaceAll('_', ' '));
        const check = node('input');
        check.type = 'checkbox';
        check.name = 'services';
        check.value = service;
        check.checked = selected.has(service);
        label.prepend(check);
        services.append(label);
      }
      form.append(services, button('Save entity modules', 'submit', 'button button-primary span-2'));
      item.append(form);
    }
    if (tenant.status !== 'active') {
      item.append(node('p', 'Global System Admin must activate this entity before its business modules can be used.'));
      const form = node('form', undefined, 'inline-form');
      form.dataset.form = 'tenant-deployment-registration';
      form.dataset.tenantId = tenant.id;
      form.append(field('Deployment reference (no URL, key, or secret)', 'deployment_reference', 'text', false, {
        maxlength: '200', value: tenant.deployment_reference ?? '', placeholder: 'deployment inventory reference',
      }).label);
      const status = field('Registration state', 'deployment_status', 'select');
      for (const [value, labelText] of [['not_registered', 'Not registered'], ['registered', 'Registered']]) {
        const option = node('option', labelText); option.value = value; status.input.append(option);
      }
      status.input.value = tenant.deployment_status === 'registered' ? 'registered' : 'not_registered';
      form.append(status.label, button('Submit registration', 'submit', 'button button-primary'));
      item.append(form);
    }
    section.append(item);
  }
  return section;
}

function renderTenantDataGovernance() {
  const section = node('section', undefined, 'panel form-card tenant-data-governance');
  section.append(
    node('p', 'GLOBAL CONTROL PLANE', 'eyebrow'),
    node('h3', 'Tenant data administration'),
    node('p', 'Global Admin assigns tenant-scoped Database Admin and Analytics Admin capability records to active eligible accounts. These assignments grant no platform database connection, SQL console, tenant database access, credential access, or change execution. Tenant operators remain responsible for their own data plane.'),
  );
  const snapshot = state.platformDataAdmin;
  if (!snapshot) {
    section.append(node('p', 'Tenant control-plane metadata is unavailable. Retry the workspace connection; no status is inferred.', 'admin-data-empty'));
    return section;
  }
  const tenantSelect = field('Tenant scope', 'tenant_id', 'select');
  tenantSelect.input.dataset.capabilityTenant = 'true';
  const selectTenant = node('option', 'Select an active tenant'); selectTenant.value = '';
  tenantSelect.input.append(selectTenant);
  const activeTenants = (snapshot.tenants ?? []).filter((tenant) => tenant.status === 'active');
  for (const tenant of activeTenants) {
    const option = node('option', `${tenant.display_name} · ${tenant.tenant_key}`);
    option.value = tenant.id;
    tenantSelect.input.append(option);
  }
  const assignment = node('form', undefined, 'inline-form admin-data-assignment');
  assignment.dataset.form = 'platform-tenant-capabilities';
  assignment.append(tenantSelect.label);
  const account = field('Eligible active account', 'user_id', 'select');
  account.input.dataset.capabilityUser = 'true';
  const accountPrompt = node('option', 'Select an active tenant first'); accountPrompt.value = '';
  account.input.append(accountPrompt);
  assignment.append(account.label);
  const capabilities = node('fieldset', undefined, 'admin-capability-options');
  capabilities.append(node('legend', 'Tenant-scoped capability'));
  const capabilityInputs = [];
  for (const [value, label, detail] of [
    ['database_admin', 'Database Admin', 'Metadata, readiness evidence, and operator-request tracking only'],
    ['analytics_admin', 'Analytics Admin', 'No Global BI access is included; this service currently has no tenant-filtered query endpoint'],
  ]) {
    const labelNode = node('label');
    const input = node('input');
    input.type = 'checkbox';
    input.name = 'capabilities';
    input.value = value;
    labelNode.append(input, node('strong', label), node('small', detail));
    capabilities.append(labelNode);
    capabilityInputs.push(input);
  }
  assignment.append(capabilities, button('Save tenant capabilities', 'submit', 'button button-primary span-2'));
  section.append(assignment);
  tenantSelect.input.addEventListener('change', async () => {
    account.input.replaceChildren();
    const placeholder = node('option', 'Loading eligible accounts…'); placeholder.value = '';
    account.input.append(placeholder);
    account.input.disabled = true;
    if (!tenantSelect.input.value) {
      placeholder.textContent = 'Select an active tenant first';
      return;
    }
    try {
      const users = await api(`/platform/tenant-capabilities/${encodeURIComponent(tenantSelect.input.value)}/eligible-users`);
      account.input.replaceChildren();
      const first = node('option', 'Choose an active eligible account'); first.value = '';
      account.input.append(first);
      for (const user of users) {
        const option = node('option', `${user.legal_name} · ${roleLabel(user.role)}`);
        option.value = user.id;
        account.input.append(option);
      }
      if (!users.length) {
        first.textContent = 'No eligible active accounts are available';
      }
      account.input.disabled = false;
      capabilityInputs.forEach((input) => { input.checked = false; });
    } catch (error) {
      account.input.replaceChildren();
      const failed = node('option', 'Could not load eligible accounts'); failed.value = '';
      account.input.append(failed);
      showAlert(error.message, true);
    }
  });
  account.input.addEventListener('change', () => {
    const assigned = new Set((snapshot.grants ?? [])
      .filter((grant) => grant.tenant_id === tenantSelect.input.value && grant.user_id === account.input.value)
      .map((grant) => grant.capability));
    capabilityInputs.forEach((input) => { input.checked = assigned.has(input.value); });
  });
  const grantsByTenant = new Map();
  for (const grant of snapshot.grants ?? []) {
    if (!grantsByTenant.has(grant.tenant_id)) grantsByTenant.set(grant.tenant_id, new Map());
    const users = grantsByTenant.get(grant.tenant_id);
    if (!users.has(grant.user_id)) users.set(grant.user_id, { name: grant.legal_name, role: grant.role, capabilities: [] });
    users.get(grant.user_id).capabilities.push(grant.capability);
  }
  const assignments = node('section', undefined, 'admin-data-assignments');
  assignments.append(node('h4', 'Current assignments'));
  if (!activeTenants.length) assignments.append(empty('No active registered tenants are available for tenant-scoped capability assignment.'));
  for (const tenant of activeTenants) {
    const tenantSection = node('section', undefined, 'admin-data-tenant');
    tenantSection.append(node('h5', `${tenant.display_name} · ${tenant.tenant_key}`));
    const users = grantsByTenant.get(tenant.id);
    if (!users?.size) tenantSection.append(node('p', 'No Database Admin or Analytics Admin capability is assigned.'));
    for (const [userId, grant] of users ?? []) {
      tenantSection.append(node('p', `${grant.name} · ${roleLabel(grant.role)} · ${[...new Set(grant.capabilities)].map((capability) => capability === 'database_admin' ? 'Database Admin' : 'Analytics Admin').join(' + ')} · ${userId}`));
    }
    assignments.append(tenantSection);
  }
  section.append(assignments);

  const checklist = node('details', undefined, 'admin-data-checklist');
  checklist.append(node('summary', 'Operator readiness checklists (manual evidence only)'));
  const migrationChecklist = node('section');
  migrationChecklist.append(node('h4', 'Migration review'));
  migrationChecklist.append(node('p', 'Confirm tenant-local maintenance window and approved release; compare migration manifest and checksums; verify a tenant-local backup and restore-tested recovery point; run migrations only with that tenant’s approved operator process; capture before/after schema and readiness evidence; record rollback outcome. This panel does not run or validate those steps.'));
  const backupChecklist = node('section');
  backupChecklist.append(node('h4', 'Backup / restore review'));
  backupChecklist.append(node('p', 'Confirm tenant-local backup policy, encryption and retention; record last successful backup timestamp and immutable evidence reference; verify restore into an isolated tenant-controlled environment; perform integrity and application checks; document recovery objectives and operator sign-off. No backup, restore, or database change is triggered here.'));
  checklist.append(migrationChecklist, backupChecklist);
  section.append(checklist);

  const requestForm = node('form', undefined, 'inline-form admin-data-request');
  requestForm.dataset.form = 'platform-operator-request';
  requestForm.append(node('h4', 'Create an audited operator request (no execution)'));
  const requestTenant = field('Active tenant', 'tenant_id', 'select');
  const requestTenantPrompt = node('option', 'Select an active tenant'); requestTenantPrompt.value = '';
  requestTenant.input.append(requestTenantPrompt);
  for (const tenant of activeTenants) {
    const option = node('option', `${tenant.display_name} · ${tenant.tenant_key}`); option.value = tenant.id;
    requestTenant.input.append(option);
  }
  requestForm.append(requestTenant.label);
  const requestType = field('Review type', 'request_type', 'select');
  for (const [value, label] of [
    ['migration_review', 'Migration review'],
    ['backup_restore_review', 'Backup / restore review'],
    ['database_change_review', 'Database change review'],
  ]) { const option = node('option', label); option.value = value; requestType.input.append(option); }
  requestForm.append(requestType.label);
  requestForm.append(field('Request summary (no SQL, credentials, or connection details)', 'summary', 'textarea', true, { minlength: '10', maxlength: '1000' }).label);
  requestForm.append(field('Non-secret evidence reference (optional; not a URL)', 'evidence_reference', 'text', false, { maxlength: '200' }).label);
  requestForm.append(button('Record request only', 'submit', 'button button-outline span-2'));
  section.append(requestForm);
  const requests = node('section', undefined, 'admin-data-requests');
  requests.append(node('h4', 'Recent operator requests'));
  if (!(snapshot.operatorRequests ?? []).length) requests.append(node('p', 'No operational requests are recorded. Creating a request never executes a database change.', 'admin-data-empty'));
  for (const request of (snapshot.operatorRequests ?? []).slice(0, 12)) {
    requests.append(node('p', `${request.tenant_name} · ${request.request_type.replaceAll('_', ' ')} · requested ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.created_at))} · ${request.summary} · execution not performed`));
  }
  section.append(requests);
  return section;
}

function renderAdmin() {
  const wrap = node('div');
  const isAdmin = isPlatformAdmin();
  const isGlobalAdmin = state.user.role === 'global_admin';
  const isBusinessManager=state.user.role==='corporate_business_manager';
  const canProvisionAgents = isGlobalAdmin || state.user.role === 'super_admin' || state.user.role === 'master_agent' || isBusinessManager;
  wrap.append(sectionHeading(isAdmin ? isGlobalAdmin ? 'Global System Administration' : 'Super Admin · Assigned entity management' : isBusinessManager ? 'Business manager workspace' : 'Compliance review', isAdmin ? isGlobalAdmin ? 'Configure platform services, packages, tenant boundaries, global identity, access, and operations.' : 'Manage only assigned business entities and the modules approved for them by the Global System Admin.' : isBusinessManager ? 'Manage business operations and review marketplace submissions.' : 'Review account verification before activation.'));
  if (isGlobalAdmin) {
    const supportAccess = node('section', undefined, 'panel form-card');
    supportAccess.style.marginTop = '20px';
    supportAccess.append(
      node('h3', t('Purpose-bound property support access')),
      node('p', t('Tenant data access requires an independently approved grant and expires within eight hours. Approved grants appear in the property-tenant selector.')),
    );
    const requestForm = node('form', undefined, 'inline-form');
    requestForm.dataset.form = 'property-tenant-support-request';
    const tenantField = field('Tenant', 'tenant_system_id', 'select', true);
    for (const tenant of state.propertyOperatingTenants.filter((item) => item.status === 'active')) {
      tenantField.input.append(new Option(tenant.legal_name, tenant.id));
    }
    const durationField = field(t('Access duration'), 'duration_hours', 'select', true);
    for (const hours of [1, 2, 4, 8]) {
      durationField.input.append(new Option(`${hours} hour${hours === 1 ? '' : 's'}`, String(hours)));
    }
    requestForm.append(
      tenantField.label,
      durationField.label,
      field('Purpose (minimum 10 characters)', 'purpose', 'textarea', true, { minlength: 10, maxlength: 1000, rows: 3 }).label,
      button(t('Request support access'), 'submit', 'button button-primary'),
    );
    if (tenantField.input.options.length === 0) {
      requestForm.querySelector('button[type="submit"]').disabled = true;
      supportAccess.append(empty(t('There are no active property tenants to request.')));
    }
    supportAccess.append(requestForm);
    supportAccess.append(button(t('Refresh my approved grants'), 'property-tenant-support-refresh', 'button button-outline'));
    supportAccess.append(node('h4', t('My active support grants')));
    if (!state.propertyTenantSupportGrants.length) supportAccess.append(empty(t('No approved, unexpired support grants are available.')));
    for (const grant of state.propertyTenantSupportGrants) {
      const item = card(grant.tenant_name, `${grant.purpose} · ${t('expires')} ${new Date(grant.expires_at).toLocaleString(document.documentElement.lang)}`, t('active support'));
      item.append(button(t('Revoke my access'), 'property-tenant-support-revoke', 'button button-outline', { id: grant.id }));
      supportAccess.append(item);
    }
    supportAccess.append(node('h4', t('Pending requests for independent approval')));
    if (!state.propertyTenantPendingGrants.length) supportAccess.append(empty(t('No support requests are awaiting approval.')));
    for (const grant of state.propertyTenantPendingGrants) {
      const item = card(grant.tenant_system_id, `${grant.purpose} · ${t('requested by')} ${grant.requested_by} · ${t('expires')} ${new Date(grant.expires_at).toLocaleString(document.documentElement.lang)}`, t('pending'));
      item.append(
        button(t('Approve'), 'property-tenant-support-decision', 'button button-outline', { id: grant.id, decision: 'approve' }),
        button(t('Reject'), 'property-tenant-support-decision', 'button button-quiet', { id: grant.id, decision: 'reject' }),
      );
      supportAccess.append(item);
    }
    wrap.append(supportAccess);

    const delivery = node('section', undefined, 'panel form-card');
    delivery.append(node('h3', 'Webhook notification delivery'));
    delivery.append(node('p', 'Delivery retries use bounded backoff. Manual retries are audited and keep the original notification ID as the downstream idempotency key.'));
    if (!state.notificationDeliveryStatus.length) delivery.append(empty('No webhook notifications are in the delivery history.'));
    for (const notification of state.notificationDeliveryStatus) {
      const item = card(notification.template,
        `Attempts ${notification.total_attempt_count} · retry generation ${notification.retry_generation} · ${new Date(notification.created_at).toLocaleString(document.documentElement.lang)}`,
        notification.status);
      if (notification.last_error) item.append(node('p', `Last delivery error: ${notification.last_error}`));
      if (notification.status === 'dead') {
        const form = node('form', undefined, 'inline-form');
        form.dataset.form = 'notification-retry';
        form.dataset.id = notification.id;
        form.append(field('Manual retry reason (minimum 10 characters)', 'reason', 'textarea', true, { minlength: 10, maxlength: 1000, rows: 2 }).label,
          button('Requeue notification', 'submit', 'button button-outline'));
        item.append(form);
      }
      delivery.append(item);
    }
    wrap.append(delivery);
  }
  if (isNativeApp && canChangeServer(state.user.role)) {
    const serverTools = node('section', undefined, 'panel form-card admin-server-tools');
    serverTools.append(node('h3', 'Connection settings'));
    serverTools.append(node('p', 'Change the configured AfroLife server for this device. This affects only this app installation.'));
    const changeButton = button('Change server', 'change-server', 'button button-outline');
    changeButton.id = 'change-server';
    changeButton.addEventListener('click', () => {
      if (!canChangeServer(state.user?.role)) return;
      const setup = $('#server-setup');
      setup.hidden = !setup.hidden;
      $('#api-server-url').value = localStorage.getItem(API_URL_KEY) ?? '';
      changeButton.textContent = t(setup.hidden ? 'Change server' : 'Cancel server change');
      if (!setup.hidden) $('#api-server-url').focus();
    });
    serverTools.append(changeButton, $('#server-setup'));
    wrap.append(serverTools);
  }
  if (isGlobalAdmin) {
    wrap.append(createAdminRoleAccessEditor(api, state.user, state.users));
    wrap.append(createMiniAppAccessEditor(api, state.user, state.users));
  }
  if (isGlobalAdmin) wrap.append(renderRoleAccess());
  const columns = node('div', undefined, 'columns');
  if (isGlobalAdmin) wrap.append(renderBusinessRules());
  if (isGlobalAdmin) wrap.append(renderPlatformControlPlane());
  if (isGlobalAdmin) wrap.append(renderTenantDataGovernance());
  if (state.user.role === 'super_admin') wrap.append(renderGlobalAdminPromotions());
  if (isGlobalAdmin) wrap.append(renderReadinessEvidence());
  if (isGlobalAdmin) {
    const identities = node('section', undefined, 'panel form-card');
    identities.style.marginTop = '20px';
    identities.append(node('h3', 'Service identity inventory'));
    identities.append(node('p', 'Record vault references and rotation evidence only. Never enter credential values or tokens. Rotation and retirement require a different platform administrator from the identity creator.'));
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'service-identity';
    form.append(
      field('Identity name', 'name', 'text', true, { minlength: '3', maxlength: '200' }).label,
      field('Purpose', 'purpose', 'text', true, { minlength: '3', maxlength: '1000' }).label,
      field('Environment', 'environment', 'select').label,
      field('Owner', 'owner_user_id', 'select', false).label,
      field('Vault reference (not a secret)', 'secret_manager_reference', 'text', true, { placeholder: 'vault://team/service-account' }).label,
      field('Expiry date', 'expiry_date', 'date').label,
      field('Evidence', 'evidence', 'text', true, { minlength: '10', maxlength: '2000' }).label,
    );
    const env = form.elements.environment;
    for (const value of ['staging','production','development','sandbox']) {
      const option = node('option', value); option.value = value; env.append(option);
    }
    const owner = form.elements.owner_user_id;
    const noOwner = node('option', 'No named owner'); noOwner.value = ''; owner.append(noOwner);
    for (const user of state.users.filter((item) => item.active)) {
      const option = node('option', `${user.legal_name} · ${roleLabel(user.role)}`); option.value = user.id; owner.append(option);
    }
    form.append(button('Add service identity', 'submit', 'button button-primary span-2'));
    identities.append(form);
    if (!state.serviceIdentities.length) identities.append(empty('No service identities are registered.'));
    for (const identity of state.serviceIdentities) {
      const item = card(identity.name, `${identity.environment} · owner ${identity.owner_user_id ?? 'unassigned'} · expires ${identity.expiry_date ?? 'not set'} · rotated ${identity.rotated_at ?? 'never'}`, identity.status);
      item.append(node('p', `${identity.purpose} · ${identity.secret_manager_reference ?? 'Vault reference missing'}`));
      if (identity.status === 'active' && identity.created_by !== state.user.id) {
        const rotation = node('form', undefined, 'inline-form');
        rotation.dataset.form = 'service-identity-rotate';
        rotation.dataset.identity = identity.id;
        rotation.append(
          field('New vault reference', 'secret_manager_reference', 'text', true, { placeholder: 'vault://team/service-account' }).label,
          field('New expiry', 'expiry_date', 'date', true).label,
          field('Rotation evidence', 'evidence', 'text', true, { minlength: '10', maxlength: '2000' }).label,
          button('Record verified rotation', 'submit', 'button button-outline'),
        );
        item.append(rotation, button('Retire identity', 'service-identity-retire', 'button button-outline', { id: identity.id }));
      }
      const events = button('View lifecycle evidence', 'service-identity-events', 'button button-quiet', { id: identity.id });
      item.append(events);
      identities.append(item);
    }
    wrap.append(identities);
  }
  if (canProvisionAgents) {
    const form = node('form', undefined, 'panel form-card inline-form');
    form.dataset.form = 'user';
    const title = node('h3', isGlobalAdmin ? 'Create a platform account' : state.user.role === 'master_agent' ? 'Onboard a sub-agent' : 'Onboard an agent'); title.className = 'span-2'; form.append(title);
    form.append(field('Legal name', 'legal_name').label, field('Phone', 'phone', 'tel', true, { placeholder: '0911 234 567' }).label);
    const role = field('Role', 'role', 'select');
    const accountRoles = isGlobalAdmin
      ? [['super_admin','Super Admin'],['corporate_business_manager','Business Admin'],['master_agent','Master agent'],['field_agent','Field agent'],['compliance','Compliance'],['finance','Finance'],['finance_manager','Finance manager'],['customer','Customer'],['worker','Worker'],['property_owner','Property owner'],['property_vendor','Property vendor']]
      : state.user.role === 'master_agent'
        ? [['field_agent','Sub-agent (Field agent)']]
        : [['master_agent','Master agent'],['field_agent','Field agent']];
    for (const [value, label] of accountRoles) {
      const option = node('option', label); option.value = value; role.input.append(option);
    }
    form.append(role.label);
    if (isGlobalAdmin) {
      const vendor = field('Property-vendor business (required for vendor portal accounts)', 'vendor_id', 'select', false);
      const vendorEmpty = node('option', 'Choose property-vendor business'); vendorEmpty.value = ''; vendor.input.append(vendorEmpty);
      for (const item of state.maintenanceVendors ?? []) { const option = node('option', item.name); option.value = item.id; vendor.input.append(option); }
      form.append(vendor.label);
    }
    const specialization = field('Profile focus (optional; does not limit agent services)', 'service_specialization', 'select', false);
    for (const [value, label] of [['', 'General agent'], ['financial_service', 'Financial services focus'], ['growth_partnership', 'Growth & partnerships focus'], ['workforce_property', 'Workforce & property focus']]) {
      const option = node('option', label); option.value = value; specialization.input.append(option);
    }
    form.append(specialization.label);
    const area = field('Territory', 'territory_id', 'select', false);
    const none = node('option', 'No territory'); none.value = ''; area.input.append(none);
    for (const territory of state.territories) { const option = node('option', territory.name); option.value = territory.id; area.input.append(option); }
    form.append(area.label);
    const agentPlan = field('Agent service plan', 'requested_plan', 'select', false);
    for (const [value,label] of [['free','Free'],['pro','Pro'],['enterprise','Enterprise']]) { const option=node('option',label); option.value=value; agentPlan.input.append(option); }
    form.append(agentPlan.label);
    const parent = field('Master agent (required for field agents)', 'parent_agent_id', 'select', false);
    const parentEmpty = node('option', 'Choose master agent'); parentEmpty.value = ''; parent.input.append(parentEmpty);
    if (state.user.role === 'master_agent') {
      const option = node('option', state.user.legal_name); option.value = state.user.id; parent.input.append(option);
      parent.input.value = state.user.id;
    } else {
      for (const user of state.users.filter((item) => item.role === 'master_agent' && item.active && (isGlobalAdmin || item.created_by === state.user.id))) { const option = node('option', user.legal_name); option.value = user.id; parent.input.append(option); }
    }
    form.append(parent.label);
    form.append(field('Email', 'email', 'email', false).label);
    form.append(button('Create account', 'submit', 'button button-primary span-2'));
    columns.append(form);
  }
  if (state.user.role === 'super_admin') wrap.append(renderTenantAdminWorkspace());
  const users = node('div', undefined, 'list');
  const visibleUsers = state.user.role === 'super_admin'
    ? state.users.filter((user) => user.role === 'super_admin' && !user.active)
    : state.users;
  if (!visibleUsers.length) {
    users.append(empty(state.user.role === 'super_admin'
      ? 'No pending Super Admin accounts are awaiting activation.'
      : 'No accounts to display.'));
  }
  for (const user of visibleUsers.slice(0, 25)) {
    const signupDetails = user.signup_account_type
      ? t('{{phone}} · {{role}} · {{plan}}', {
        phone: user.phone,
        role: roleLabel(user.role),
        plan: user.requested_plan
          ? `${t('Plan requested')}: ${t(user.requested_plan)} · ${user.signup_payment_status === 'not_configured' ? t('Payment not configured') : ''}`
          : roleLabel(user.role),
      })
      : `${user.phone} · ${roleLabel(user.role)}`;
    const requestedBenefits = [
      user.pension_match_interest && 'Pension match requested',
      user.edir_member_interest && 'AfroLife Edir requested',
      user.edir_life_interest && 'Life cover requested',
      user.household_cover_interest && 'Household cover requested',
    ].filter(Boolean).join(' · ');
    const item = card(user.legal_name, [signupDetails, requestedBenefits].filter(Boolean).join(' · '), user.active ? 'active' : user.kyc_status);
    const editableRoles = editableAccountRoles(user, state.user);
    if (editableRoles.length && isAdmin) {
      const roleForm = node('form', undefined, 'inline-form user-role-edit');
      roleForm.dataset.form = 'user-role';
      roleForm.dataset.id = user.id;
      const role = field('Account role', 'role', 'select');
      for (const value of editableRoles) {
        const option = node('option', roleLabel(value));
        option.value = value;
        role.input.append(option);
      }
      role.input.value = user.role;
      roleForm.append(role.label);
      if (editableRoles.includes('field_agent')) {
        const parent = field('Active Master Agent in the same territory', 'parent_agent_id', 'select', false);
        const emptyParent = node('option', 'Select Master Agent');
        emptyParent.value = '';
        parent.input.append(emptyParent);
        for (const candidate of state.users.filter((candidate) =>
          candidate.id !== user.id
          && candidate.role === 'master_agent'
          && candidate.active
          && String(candidate.territory_id) === String(user.territory_id)
          && (state.user.role !== 'super_admin' || candidate.created_by === state.user.id))) {
          const option = node('option', candidate.legal_name);
          option.value = candidate.id;
          parent.input.append(option);
        }
        parent.input.value = user.parent_agent_id ?? '';
        const updateParentVisibility = () => {
          const needsParent = role.input.value === 'field_agent' && role.input.value !== user.role;
          parent.label.hidden = !needsParent;
          parent.input.required = needsParent;
          parent.input.disabled = !needsParent;
        };
        role.input.addEventListener('change', updateParentVisibility);
        updateParentVisibility();
        roleForm.append(parent.label);
      }
      roleForm.append(button('Save role', 'submit', 'button button-primary span-2'));
      item.append(roleForm);
    }
    if (user.signup_account_type && ['global_admin', 'compliance'].includes(state.user.role)) {
      item.append(button(`KYC documents (${user.kyc_document_count ?? 0})`, 'user-documents', 'button button-outline', { id: user.id }));
    }
    if (state.user.role === 'compliance' && ['uploaded','under_review'].includes(user.kyc_status) && user.id !== state.user.id) {
      item.append(button('Verify KYC', 'user-kyc', 'button button-primary', { id: user.id, decision: 'verified' }));
      item.append(button('Reject', 'user-kyc', 'button button-outline', { id: user.id, decision: 'rejected' }));
    }
    if (isAdmin && !user.active && user.created_by !== state.user.id) item.append(button('Activate', 'user-activate', 'button button-primary', { id: user.id }));
    if (isGlobalAdmin && user.active && user.id !== state.user.id) item.append(button('Deactivate', 'user-deactivate', 'button button-outline', { id: user.id }));
    users.append(item);
  }
  if (isAdmin || isBusinessManager || state.user.role === 'compliance') columns.append(users);
  wrap.append(columns);
  if (isAdmin && state.summary) {
    const summary = node('section', undefined, 'panel form-card');
    summary.style.marginTop = '20px';
    summary.append(node('h3', 'Platform snapshot'));
    const count = (key) => Array.isArray(state.summary[key]) ? state.summary[key].reduce((total, row) => total + Number(row.n ?? 0), 0) : '—';
    summary.append(node('p', t('Leads {{leads}} · Workers {{workers}} · Open disputes {{disputes}}', {
      leads: count('leads'), workers: count('workers'), disputes: state.summary.open_disputes?.n ?? 0,
    })));
    wrap.append(summary);
  }
  return wrap;
}

function renderPasswordChange() {
  const form = node('form', undefined, 'panel form-card');
  form.style.maxWidth = '480px';
  form.dataset.form = 'password';
  form.append(node('h3', 'Set a new password'), node('p', 'Your account requires a password change before continuing.'));
  form.append(field('Temporary password', 'current', 'password').label, field('New password (12+ characters)', 'next', 'password', true, { minlength: '12', maxlength: '72' }).label);
  form.append(button('Update password', 'submit', 'button button-primary'));
  return form;
}

function renderSecurity() {
  const wrap = node('div');
  wrap.append(sectionHeading('Account security', 'Manage two-step verification and signed-in devices.'));
  const panel = node('section', undefined, 'panel form-card');
  panel.style.maxWidth = '620px';
  const mfaRequired = REQUIRED_MFA_ROLES.has(state.user.role);
  panel.append(node('h3', state.user.mfa_enabled ? 'Two-step verification is enabled' : 'Two-step verification'));
  panel.append(node('p', mfaRequired
    ? 'Authenticator sign-in is required for administrative roles and cannot be disabled.'
    : state.user.mfa_enabled
      ? 'Your sign-in uses a password and authenticator code.'
      : 'Optional: add an authenticator app for an extra sign-in step. You can turn it off later after verifying your password and code.'));
  if (!state.user.mfa_enabled && !state.mfaSetup) {
    panel.append(button('Set up authenticator', 'mfa-setup', 'button button-primary'));
  } else if (state.mfaSetup && !state.user.mfa_enabled) {
    panel.append(node('p', 'Add this account in your authenticator app using the setup key below.'));
    const secret = node('code', state.mfaSetup.secret);
    secret.style.display = 'block';
    secret.style.padding = '14px';
    secret.style.margin = '10px 0 18px';
    secret.style.background = '#f3f5f1';
    secret.style.overflowWrap = 'anywhere';
    panel.append(secret);
    const uri = node('p', state.mfaSetup.uri, 'muted');
    uri.style.overflowWrap = 'anywhere';
    panel.append(uri);
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'mfa-enable';
    const code = field('Six-digit authenticator code', 'code', 'text', true, { inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6 });
    form.append(code.label, button('Verify and enable', 'submit', 'button button-primary'));
    panel.append(form);
  } else if (state.user.mfa_enabled && !mfaRequired) {
    const form = node('form', undefined, 'inline-form');
    form.dataset.form = 'mfa-disable';
    form.append(node('p', 'To turn off the optional authenticator step, confirm your current password and a valid one-time code.', 'muted'));
    form.append(field('Current password', 'password', 'password').label);
    form.append(field('Six-digit authenticator code', 'code', 'text', true, { inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6 }).label);
    form.append(button('Turn off two-step verification', 'submit', 'button button-outline'));
    panel.append(form);
  }
  panel.append(node('h3', 'Passkeys and device sign-in'));
  panel.append(node('p', 'Unavailable until secure WebAuthn support is configured. If enabled later, your device may use biometrics or a PIN; AfroLife will not collect biometric data.'));
  const passkey = node('button', 'Device sign-in unavailable', 'button button-outline passkey-unavailable');
  passkey.type = 'button';
  passkey.disabled = true;
  passkey.setAttribute('aria-describedby', 'passkey-unavailable-note');
  panel.append(passkey);
  const passkeyNote = node('span', 'Secure device credential registration is not available yet.');
  passkeyNote.id = 'passkey-unavailable-note';
  passkeyNote.className = 'sr-only';
  panel.append(passkeyNote);
  wrap.append(panel);
  const sessions = node('section', undefined, 'panel');
  sessions.append(node('h3', 'Signed-in sessions'));
  sessions.append(node('p', 'Review recent sessions for your account and end any session you do not recognize.', 'muted'));
  if (!state.authSessions.length) {
    sessions.append(empty('No recent sessions were found.'));
  } else {
    const list = node('div', undefined, 'record-list');
    for (const session of state.authSessions) {
      const item = node('article', undefined, 'record-card');
      const heading = session.current ? 'This session' : session.user_agent || 'Browser details unavailable';
      item.append(node('h4', heading));
      item.append(node('p', `Started ${new Date(session.created_at).toLocaleString()} · Last active ${new Date(session.last_activity_at).toLocaleString()}`, 'muted'));
      item.append(node('p', session.active ? 'Active' : 'Ended', 'muted'));
      if (session.active) {
        item.append(button(session.current ? 'Sign out this session' : 'End session', 'revoke-session', 'button button-outline', { id: session.id }));
      }
      list.append(item);
    }
    sessions.append(list);
  }
  wrap.append(sessions);
  return wrap;
}

function renderSupport() {
  const wrap = node('div');
  wrap.append(sectionHeading('Support & complaints', 'Raise and track a case. Sensitive case details are shown to support staff only after independent, time-limited approval.'));
  const intake = node('form', undefined, 'panel form-card');
  intake.dataset.form = 'support-case-create';
  intake.append(node('h3','Open a support case'));
  const category = field('Topic','category','select');
  for (const [value,label] of [
    ['general','General support'],['service','Service issue'],['agent_complaint','Complaint about an Agent'],
    ['financial','Financial issue'],['legal','Legal issue'],['privacy','Privacy concern'],
    ['safety','Safety concern'],['fraud','Suspected fraud'],
  ]) category.input.append(new Option(label,value));
  const agent = field('Agent concerned','subject_user_id','select',false);
  agent.input.append(new Option('Select an Agent',''));
  for (const record of state.supportAgents) agent.input.append(new Option(`${record.legal_name} (${record.id})`,record.id));
  agent.label.hidden = category.input.value !== 'agent_complaint';
  category.input.addEventListener('change',()=>{ agent.label.hidden=category.input.value!=='agent_complaint'; });
  const subject = field('Subject','subject','text',true,{maxLength:160});
  const description = field('Describe what happened','description','textarea',true,{maxLength:4000,rows:5});
  intake.append(category.label,agent.label,subject.label,description.label,
    node('p','Safety, fraud, privacy and legal cases are treated as urgent. Agent complaints are not assigned to the Agent named.', 'muted'),
    button('Submit case','submit','button button-primary'));
  wrap.append(intake);

  const mine = node('section',undefined,'panel');
  mine.append(node('h3','My cases'));
  if (!state.supportCases.length) mine.append(empty('You have no support cases yet.'));
  for (const item of state.supportCases) {
    const card = node('article',undefined,'record-card');
    card.append(node('h4',item.subject),node('p',`${item.category.replaceAll('_',' ')} · ${item.status} · ${item.priority}`, 'muted'));
    card.append(node('p',item.description));
    if (item.outcome) card.append(node('p',`Outcome: ${item.outcome}`),node('p',`Appeal route: ${item.appeal_route}`,'muted'));
    if (item.appeal_decision) {
      card.append(node('p',`Appeal decision: ${item.appeal_decision}`),
        node('p',`Appeal review: ${item.appeal_rationale}`,'muted'));
      if (item.appeal_corrective_action) card.append(node('p',`Appeal corrective action: ${item.appeal_corrective_action}`));
    }
    if (item.status==='resolved') card.append(button('Appeal resolution','support-appeal','button button-outline',{id:item.id}));
    card.append(button('View case timeline','support-open-case','button button-outline',{id:item.id}));
    mine.append(card);
  }
  wrap.append(mine);

  if (state.supportQueue.length) {
    const queue = node('section',undefined,'panel');
    queue.append(node('h3','Support queue'));
    queue.append(node('p','Case descriptions and sensitive details remain hidden until a different authorized reviewer approves a 15-minute access window.','muted'));
    for (const item of state.supportQueue) {
      const card = node('article',undefined,'record-card');
      card.append(node('h4',`Case ${item.id.slice(0,8)}`),node('p',`${item.category.replaceAll('_',' ')} · ${item.status} · ${item.priority}`,'muted'));
      card.append(
        button('Request sensitive access','support-access-request','button button-outline',{id:item.id}),
        button('Open approved case','support-open-case','button button-primary',{id:item.id}),
      );
      queue.append(card);
    }
    wrap.append(queue);
  }

  if (state.supportAppealQueue.length) {
    const appeals=node('section',undefined,'panel');
    appeals.append(node('h3','Appeal review queue'));
    appeals.append(node('p','Appeals are reviewed by an authorized person other than the original resolution author. Case details require independent temporary approval.','muted'));
    for (const item of state.supportAppealQueue) {
      const card=node('article',undefined,'record-card');
      card.append(node('h4',`Appealed case ${item.id.slice(0,8)}`),
        node('p',`${item.category.replaceAll('_',' ')} · ${item.priority} · appealed ${new Date(item.appealed_at).toLocaleString()}`,'muted'));
      card.append(
        button('Request sensitive access','support-access-request','button button-outline',{id:item.id}),
        button('Open appeal','support-open-case','button button-primary',{id:item.id}),
      );
      appeals.append(card);
    }
    wrap.append(appeals);
  }

  if (state.supportAccessRequests.length) {
    const approvals = node('section',undefined,'panel');
    approvals.append(node('h3','Sensitive-access approvals'));
    for (const request of state.supportAccessRequests) {
      const card=node('article',undefined,'record-card');
      card.append(node('h4',`Case ${request.case_id}`),node('p',`${request.requester_name}: ${request.request_reason}`));
      card.append(button('Approve for 15 minutes','support-access-decision','button button-primary',{
        id:request.id,decision:'approve',
      }),button('Deny','support-access-decision','button button-outline',{id:request.id,decision:'deny'}));
      approvals.append(card);
    }
    wrap.append(approvals);
  }

  if (state.supportCaseDetail) {
    const detail=node('section',undefined,'panel');
    const supportStaff=['global_admin','super_admin','compliance','corporate_business_manager'].includes(state.user.role);
    const isCaseOwner=state.supportCaseDetail.user_id===state.user.id;
    const accessExpires=Date.parse(state.supportCaseDetail.sensitive_access_expires_at??'');
    const sensitiveAccessActive=!supportStaff||isCaseOwner||(Number.isFinite(accessExpires)&&accessExpires>Date.now());
    detail.append(node('h3',state.supportCaseDetail.subject));
    if (sensitiveAccessActive) detail.append(node('p',state.supportCaseDetail.description));
    else {
      detail.append(node('p','Sensitive access has expired. Request a new independent approval to view case details.','muted'));
      detail.append(button('Request sensitive access','support-access-request','button button-outline',{id:state.supportCaseDetail.id}));
    }
    if (supportStaff&&sensitiveAccessActive) {
      if (!isCaseOwner) detail.append(node('p',`Approved access expires ${new Date(accessExpires).toLocaleTimeString()}.`,'muted'));
      if (state.supportCaseDetail.appeal_decision) {
        detail.append(node('h4',`Independent appeal decision: ${state.supportCaseDetail.appeal_decision}`));
        detail.append(node('p',state.supportCaseDetail.appeal_rationale));
        if (state.supportCaseDetail.appeal_corrective_action) {
          detail.append(node('p',`Corrective action: ${state.supportCaseDetail.appeal_corrective_action}`));
        }
      }
      if (!['resolved','appealed'].includes(state.supportCaseDetail.status)) {
        const advance=node('div',undefined,'inline-form');
        advance.append(button('Mark in progress','support-case-status','button button-outline',{
          id:state.supportCaseDetail.id,status:'in_progress',
        }),button('Request customer information','support-case-status','button button-outline',{
          id:state.supportCaseDetail.id,status:'pending_customer',
        }),button('Escalate case','support-case-status','button button-outline',{
          id:state.supportCaseDetail.id,status:'escalated',
        }));
        detail.append(advance);
      }
      if (!['resolved','appealed'].includes(state.supportCaseDetail.status)) {
        const resolution=node('form',undefined,'form-grid');
        resolution.dataset.form='support-case-resolve';
        resolution.dataset.id=state.supportCaseDetail.id;
        resolution.append(node('h4','Resolution record'));
        resolution.append(field('Outcome','outcome','textarea',true,{maxLength:2000,rows:3}).label);
        resolution.append(field('Rationale','rationale','textarea',true,{maxLength:2000,rows:3}).label);
        resolution.append(field('Corrective action','corrective_action','textarea',true,{maxLength:2000,rows:3}).label);
        resolution.append(field('Refund reference (or N/A)','refund_reference','text',true,{maxLength:200}).label);
        resolution.append(field('Formal financial/legal workflow reference (if applicable)','formal_workflow_reference','text',false,{maxLength:200}).label);
        resolution.append(field('Appeal route','appeal_route','textarea',true,{maxLength:1000,rows:2}).label);
        resolution.append(button('Resolve case','submit','button button-primary'));
        detail.append(resolution);
      }
      if (['global_admin','super_admin','compliance'].includes(state.user.role)
        && state.supportCaseDetail.status==='appealed'
        && !state.supportCaseDetail.appeal_decision
        && state.supportCaseDetail.resolved_by!==state.user.id) {
        const review=node('form',undefined,'form-grid');
        review.dataset.form='support-case-appeal-review';
        review.dataset.id=state.supportCaseDetail.id;
        review.append(node('h4','Independent appeal review'));
        const decision=field('Appeal decision','decision','select');
        for (const [value,label] of [['upheld','Uphold original resolution'],['overturned','Overturn and require corrective action']]) {
          const option=node('option',label); option.value=value; decision.input.append(option);
        }
        review.append(decision.label);
        review.append(field('Review rationale','rationale','textarea',true,{maxLength:2000,rows:3}).label);
        review.append(field('Corrective action (required if overturned)','corrective_action','textarea',false,{maxLength:2000,rows:3}).label);
        review.append(field('Formal financial/legal workflow reference (required if overturned, when applicable)','formal_workflow_reference','text',false,{maxLength:200}).label);
        review.append(button('Record appeal decision','submit','button button-primary'));
        detail.append(review);
      }
    }
    if (sensitiveAccessActive) {
      const timeline=node('ol',undefined,'record-list');
      timeline.setAttribute('aria-label','Support case activity timeline');
      for (const item of state.supportCaseEvents) {
        timeline.append(node('li',`${new Date(item.created_at).toLocaleString()} · ${item.actor_name} · ${item.event_type.replaceAll('_',' ')}${item.new_status?` · ${item.new_status}`:''}${item.reason?` · ${item.reason}`:''}`));
      }
      detail.append(node('h4','Case timeline'),timeline);
    }
    wrap.append(detail);
  }
  return wrap;
}

function addRowPagination(container, getRowElements) {
  const pager = node('div', undefined, 'row-pagination');
  pager.setAttribute('role', 'group');
  pager.setAttribute('aria-label', t('Rows per page'));
  const label = node('label', t('Rows per page'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', t('Rows per page'));
  for (const size of [10, 25, 50, 100]) {
    const option = document.createElement('option');
    option.value = String(size);
    option.textContent = String(size);
    select.append(option);
  }
  select.value = '10';
  label.append(select);
  const summary = node('span', '', 'row-pagination-summary');
  summary.setAttribute('aria-live', 'polite');
  const previous = button('Previous', 'pagination-previous', 'button button-outline');
  const next = button('Next', 'pagination-next', 'button button-outline');
  pager.append(label, summary, previous, next);
  container.parentNode.insertBefore(pager, container);
  let page = 1;
  const update = () => {
    const elements = getRowElements();
    const result = paginateRows(elements, Number(select.value), page);
    page = result.page;
    elements.forEach((row, index) => { row.hidden = index < result.start || index >= result.end; });
    const first = elements.length ? result.start + 1 : 0;
    const last = Math.min(result.end, elements.length);
    summary.textContent = elements.length ? t('Showing {{from}} - {{to}} of {{total}}', { from: first, to: last, total: elements.length }) : t('No rows');
    previous.disabled = page <= 1;
    next.disabled = page >= result.pageCount;
  };
  select.addEventListener('change', () => { page = 1; update(); });
  previous.addEventListener('click', () => { page -= 1; update(); });
  next.addEventListener('click', () => { page += 1; update(); });
  update();
}

function applyWorkspacePagination() {
  const root = $('#workspace');
  root.querySelectorAll('.list').forEach((list) => {
    const rows = [...list.children].filter((row) => !row.hidden && !row.classList.contains('empty-state') && !row.matches('.row-pagination'));
    if (rows.length) addRowPagination(list, () => rows);
  });
  root.querySelectorAll('table').forEach((table) => {
    const rows = [...table.tBodies].flatMap((body) => [...body.rows]).filter((row) => !row.hidden);
    if (rows.length) addRowPagination(table, () => rows);
  });
}

function finishWorkspaceRender() {
  translateContent($('#workspace'));
  applyWorkspacePagination();
}

function renderPanel() {
  $('#workspace').dataset.panel = state.panel;
  $('.page-heading').dataset.panel = state.panel;
  document.querySelectorAll('.tab').forEach((tab) => {
    const isCurrent = tab.dataset.panel === state.panel;
    tab.classList.toggle('active', isCurrent);
    if (isCurrent) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  document.querySelectorAll('.workspace-nav-link[data-panel]').forEach((link) => {
    const isCurrent = link.dataset.panel === state.panel;
    link.classList.toggle('active', isCurrent);
    if (isCurrent) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const additionalPanels = new Set([...document.querySelectorAll('#workspace-more-nav [data-panel]')].map((link) => link.dataset.panel));
  const moreButton = $('#mobile-workspace-more');
  const moreIsCurrent = additionalPanels.has(state.panel);
  moreButton?.classList.toggle('active', moreIsCurrent);
  if (moreIsCurrent) moreButton?.setAttribute('aria-current', 'page');
  else moreButton?.removeAttribute('aria-current');
  const launcherButton = $('#return-super-app');
  launcherButton?.classList.toggle('active', state.panel === 'launcher');
  if (state.panel === 'launcher') launcherButton?.setAttribute('aria-current', 'page');
  else launcherButton?.removeAttribute('aria-current');
  const panelTitles = {
    launcher: 'Super App',
    subscriptions: 'Service subscriptions',
    password: 'Account security',
    security: 'Account security',
    admin: 'Admin workspace',
    learning: 'Training & support',
    mfi: 'SACCO / MFI workspace',
    accounting: 'Accounting & Finance',
    'global-bi': 'Global BI',
    'tenant-data-admin': 'Tenant data administration',
    edir: 'AfroLife Edir workspace',
    insurance: 'Insurance information',
    marketplace: 'Marketplace',
    leads: 'Leads',
    workers: state.user.role === 'worker' ? 'Worker portal' : 'Workers',
    requests: 'Requests & matching',
    support: 'Support & complaints',
    properties: 'Properties',
    contracts: 'Contracts',
    commissions: 'Commissions',
    agents: 'Agent management',
    rent: 'Rent & deposits',
  };
  const pageTitle = $('#page-title');
  const logoSource = miniAppLogo(state.panel);
  pageTitle.replaceChildren();
  if (logoSource) {
    const logo = node('img', undefined, 'page-mini-app-logo');
    logo.src = logoSource;
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
    pageTitle.append(logo);
  }
  pageTitle.append(document.createTextNode(t(panelTitles[state.panel] ?? 'Your workspace')));
  // Shared shell statistics describe agency activity, so keep them on the overview only.
  $('#stat-grid').hidden = state.panel !== 'overview';
  if (state.panel === 'mfi') {
    $('#workspace').replaceChildren(createMfiWorkspace(api, state.user));
    finishWorkspaceRender();
    return;
  }
  if (state.panel === 'accounting') {
    $('#workspace').replaceChildren(createAccountingWorkspace(api,state.user));
    finishWorkspaceRender();
    return;
  }
  if (state.panel === 'global-bi') {
    $('#workspace').replaceChildren(createGlobalBiWorkspace(api));
    finishWorkspaceRender();
    return;
  }
  if (state.panel === 'tenant-data-admin') {
    $('#workspace').replaceChildren(createTenantDataAdminWorkspace(
      api,
      state.myDataCapabilities,
      state.dataAdminTenantId,
      state.tenantDataWorkspace,
      state.tenantAnalyticsStatus,
      async (tenantId) => {
        state.dataAdminTenantId = tenantId;
        state.tenantDataWorkspace = null;
        state.tenantAnalyticsStatus = null;
        loadedPanels.delete('tenant-data-admin');
        await refresh();
      },
    ));
    finishWorkspaceRender();
    return;
  }
  if (state.panel === 'edir') {
    $('#workspace').replaceChildren(createEdirWorkspace(api, state.user, (organizationId) => {
      state.edirOrganizationId = organizationId;
      state.user.edir_id = organizationId;
      localStorage.setItem(EDIR_ORGANIZATION_KEY, organizationId);
      renderPanel();
    }, downloadAuthenticatedFile));
    finishWorkspaceRender();
    return;
  }
  if (state.panel === 'privacy') {
    $('#workspace').replaceChildren(createPrivacyWorkspace(api, state.user));
    finishWorkspaceRender();
    return;
  }
  const renderer = {
    launcher: renderSuperAppLauncher,
    overview: renderOverview,
    subscriptions: renderSubscriptions,
    insurance: renderInsurance,
    status: renderServiceStatus,
    leads: renderLeads,
    workers: renderWorkers,
    requests: renderRequests,
    support: renderSupport,
    learning: renderLearning,
    properties: renderProperties,
    marketplace: renderMarketplace,
    admin: renderAdmin,
    contracts: renderContracts,
    commissions: renderCommissions,
    agents: renderAgents,
    rent: renderRent,
    password: renderPasswordChange,
    security: renderSecurity,
  }[state.panel] ?? renderOverview;
  $('#workspace').replaceChildren(renderer());
  finishWorkspaceRender();
}

function navigateToPanel(panel, { replace = false } = {}) {
  if (isCrossMiniAppPanel(panel)) {
    navigateToPanel('launcher', { replace });
    return;
  }
  const tab = panel === 'launcher' ? null : document.querySelector(`.tab[data-panel="${CSS.escape(panel)}"]`);
  if (!KNOWN_PANELS.has(panel) || (panel === 'launcher' ? !state.user : !tab || tab.hidden)) {
    showAlert('This workspace is unavailable for your account or deployment.', true);
    return;
  }
  if (panel === 'status' || panel === 'security' || panel === 'support') loadedPanels.delete(panel);
  state.panel = panel;
  const url = panelUrl(window.location.href, panel);
  if (replace) history.replaceState(null, '', url);
  else if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) history.pushState(null, '', url);
  configureWorkspaceNavigation();
  updateWorkspaceNavigationGroups();
  renderMobileWorkspaceNav();
  renderPanel();
  void refresh(false);
}

async function submitForm(form) {
  const values = formData(form);
  if (form.dataset.form === 'property-tenant-support-request') {
    const durationHours = Number(values.duration_hours);
    if (![1, 2, 4, 8].includes(durationHours)) throw new Error(t('Choose a support duration of up to eight hours.'));
    await api('/property/tenant-support-grants', {
      method: 'POST',
      body: JSON.stringify({
        tenant_system_id: values.tenant_system_id,
        purpose: values.purpose.trim(),
        expires_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
      }),
    });
    form.reset();
    await refresh();
    showAlert(t('Purpose-bound support access requested for independent approval.'));
    return;
  }
  if (form.dataset.form === 'property-agent-scope') {
    const candidate = state.propertyTenantAgentCandidates.find((agent) =>
      agent.user_id === values.user_id
      && (!agent.property_id || agent.property_id === values.property_id));
    if (!candidate || !state.propertyTenantContextId) {
      throw new Error(t('Choose an active agent in the selected property tenant.'));
    }
    await api(`/property/tenant-systems/${encodeURIComponent(state.propertyTenantContextId)}/agent-scopes`, {
      method: 'POST',
      body: JSON.stringify({
        property_id: values.property_id,
        user_id: candidate.user_id,
        tenant_role: candidate.tenant_role,
        reason: values.reason.trim(),
      }),
    });
    form.reset();
    await refresh();
    showAlert(t('Property agent assignment saved.'));
    return;
  }
  if (form.dataset.form === 'assistant-start') {
    const conversation = await api('/assistant/conversations', {
      method: 'POST',
      body: JSON.stringify({ message: values.message.trim() }),
    });
    form.reset();
    state.assistant.selectedId = conversation.id;
    await refreshAssistant();
    showAlert('');
    return;
  }
  if (form.dataset.form === 'assistant-reply') {
    await api(`/assistant/conversations/${encodeURIComponent(form.dataset.id)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: values.message.trim() }),
    });
    form.reset();
    await refreshAssistant();
    showAlert('');
    return;
  }
  if (form.dataset.form === 'worker-report-filters') {
    if (values.start_date && values.end_date && values.start_date > values.end_date) {
      throw new Error('The report start date must be on or before its end date.');
    }
    state.workerReportFilters = {
      startDate: values.start_date,
      endDate: values.end_date,
      status: values.status || 'all',
    };
    renderPanel();
    return;
  }
  if (form.dataset.form === 'rental-application') {
    const consent = form.elements.namedItem('contact_consent');
    if (!consent?.checked) throw new Error('Confirm how your application details will be shared before submitting.');
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await api('/marketplace/rental-applications', {
      method: 'POST',
      headers: { 'Idempotency-Key': form.dataset.idempotencyKey },
      body: JSON.stringify({
        property_id: form.dataset.property,
        ...(values.unit_id ? { unit_id: values.unit_id } : {}),
        applicant_message: values.applicant_message.trim(),
        contact_consent: true,
      }),
    });
    await refresh();
    showAlert('Rental application submitted to the property listing manager for human review.');
    return;
  }
  if (form.dataset.form === 'rental-application-response') {
    await api(`/marketplace/rental-applications/${encodeURIComponent(form.dataset.application)}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response: values.response.trim() }),
    });
    await refresh();
    showAlert('Your additional information was sent to the listing manager.');
    return;
  }
  if (form.dataset.form === 'resident-access-claim') {
    await api('/resident/access/claim', {
      method: 'POST',
      body: JSON.stringify({ claim_code: values.claim_code.trim().toLowerCase() }),
    });
    form.reset();
    await refresh();
    showAlert('Resident access linked to this customer account.');
    return;
  }
  if (form.dataset.form === 'resident-lease-notice') {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await api(`/resident/leases/${encodeURIComponent(form.dataset.lease)}/notices`, {
      method: 'POST',
      body: JSON.stringify({
        idempotency_key: form.dataset.idempotencyKey,
        proposed_effective_on: values.proposed_effective_on,
        summary: values.summary.trim(),
      }),
    });
    form.dataset.idempotencyKey = crypto.randomUUID();
    await refresh();
    showAlert('Tenant notice recorded for operational follow-up only; no legal status was changed.');
    return;
  }
  if (form.dataset.form === 'resident-maintenance') {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    const file = form.querySelector('input[name="evidence"]')?.files?.[0];
    const request = await api('/resident/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        lease_id: form.dataset.lease,
        category: values.category,
        priority: values.priority,
        description: values.description.trim(),
        idempotency_key: form.dataset.idempotencyKey,
      }),
    });
    if (file) {
      try {
        await api(`/maintenance/${encodeURIComponent(request.id)}/evidence`, {
          method: 'POST',
          body: file,
        });
      } catch (error) {
        await refresh();
        throw new Error(`Maintenance request ${request.id} was recorded, but the photo was not uploaded: ${error.message}`);
      }
    }
    form.dataset.idempotencyKey = crypto.randomUUID();
    form.reset();
    await refresh();
    showAlert('Maintenance request submitted. Safety issues are marked urgent.');
    return;
  }
  if (form.dataset.form === 'resident-maintenance-evidence') {
    const file = form.querySelector('input[name="evidence"]')?.files?.[0];
    if (!file) throw new Error('Choose a JPEG or PNG image.');
    await api(`/maintenance/${encodeURIComponent(form.dataset.maintenance)}/evidence`, {
      method: 'POST',
      body: file,
    });
    form.reset();
    await refresh();
    showAlert('Photo passed malware scanning and was added to your maintenance request.');
    return;
  }
  if (form.dataset.form === 'staffing-engagement') {
    await api('/staffing-engagements', { method: 'POST', body: JSON.stringify({
      match_id: form.dataset.match, worker_type: values.worker_type, billing_unit: values.billing_unit,
      client_rate: number(values.client_rate), worker_rate: number(values.worker_rate),
      starts_on: values.starts_on, ends_on: values.ends_on || undefined,
    }) });
    await refresh(); showAlert('Engagement terms submitted for independent Finance review.'); return;
  }
  if (form.dataset.form === 'property-unit') {
    const payload = {
      unit_no: values.unit_no.trim(),
      ptype: values.ptype.trim(),
      ...(values.floor ? { floor: number(values.floor) } : {}),
      ...(values.rent !== '' ? { rent: number(values.rent) } : {}),
    };
    await api(`/properties/${encodeURIComponent(form.dataset.property)}/units`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await refresh();
    showAlert('Unit added to the property.');
    return;
  }
  if (form.dataset.form === 'staffing-work-period') {
    await api(`/staffing-engagements/${encodeURIComponent(form.dataset.engagement)}/work-periods`, { method: 'POST', body: JSON.stringify({
      period_start: values.period_start, period_end: values.period_end,
      quantity: number(values.quantity), description: values.description.trim(),
    }) });
    form.reset(); await refresh();
    showAlert(state.user.role === 'worker' ? 'Your work report was submitted for independent review.' : 'Work evidence submitted for independent review.');
    return;
  }
  if (form.dataset.form === 'worker-support') {
    await api('/worker-support', { method: 'POST', body: JSON.stringify({
      category: values.category, subject: values.subject.trim(), description: values.description.trim(),
    }) });
    form.reset();
    await refresh();
    showAlert('Your support request was sent to AfroLife.');
    return;
  }
  if (form.dataset.form === 'support-case-create') {
    const payload = {
      category: values.category,
      subject: values.subject.trim(),
      description: values.description.trim(),
      ...(values.subject_user_id ? { subject_user_id: values.subject_user_id } : {}),
    };
    await api('/support/cases',{method:'POST',body:JSON.stringify(payload)});
    form.reset();
    await refresh();
    showAlert('Your support case was submitted. Safety, fraud, privacy and legal cases are escalated as urgent.');
    return;
  }
  if (form.dataset.form === 'support-case-resolve') {
    const payload = {
      outcome:values.outcome.trim(),
      rationale:values.rationale.trim(),
      corrective_action:values.corrective_action.trim(),
      refund_reference:values.refund_reference.trim(),
      appeal_route:values.appeal_route.trim(),
      ...(values.formal_workflow_reference.trim()
        ? { formal_workflow_reference:values.formal_workflow_reference.trim() } : {}),
    };
    await api(`/support/cases/${encodeURIComponent(form.dataset.id)}/resolve`,{
      method:'POST',body:JSON.stringify(payload),
    });
    state.supportCaseDetail=null;
    await refresh();
    showAlert('Resolution recorded and the user was notified.');
    return;
  }
  if (form.dataset.form === 'support-case-appeal-review') {
    const payload={
      decision:values.decision,
      rationale:values.rationale.trim(),
      ...(values.corrective_action.trim()?{corrective_action:values.corrective_action.trim()}:{}),
      ...(values.formal_workflow_reference.trim()
        ?{formal_workflow_reference:values.formal_workflow_reference.trim()}:{}),
    };
    await api(`/support/cases/${encodeURIComponent(form.dataset.id)}/appeal-review`,{
      method:'POST',body:JSON.stringify(payload),
    });
    state.supportCaseDetail=null;
    await refresh();
    showAlert('Independent appeal review recorded and the user was notified.');
    return;
  }
  if (form.dataset.form === 'workforce-correction') {
    const payload = {
      reason: values.reason.trim(),
      ...(values.proposed_clock_in_at ? { proposed_clock_in_at: new Date(values.proposed_clock_in_at).toISOString() } : {}),
      ...(values.proposed_clock_out_at ? { proposed_clock_out_at: new Date(values.proposed_clock_out_at).toISOString() } : {}),
    };
    if (!payload.proposed_clock_in_at && !payload.proposed_clock_out_at) {
      throw new Error('Enter at least one corrected clock time.');
    }
    await api(`/workforce/shifts/${encodeURIComponent(form.dataset.shift)}/corrections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    await refresh();
    showAlert('Your time correction was submitted for independent review.');
    return;
  }
  if (form.dataset.form === 'workforce-leave') {
    await api('/workforce/leave', {
      method: 'POST',
      body: JSON.stringify({
        engagement_id: values.engagement_id,
        starts_on: values.starts_on,
        ends_on: values.ends_on,
        reason: values.reason.trim(),
      }),
    });
    form.reset();
    await refresh();
    showAlert('Your leave or availability request was submitted for review.');
    return;
  }
  if (form.dataset.form === 'workforce-shift') {
    await api('/workforce/shifts', {
      method: 'POST',
      body: JSON.stringify({
        engagement_id: values.engagement_id,
        starts_at: addisAbabaDateTimeToIso(values.starts_at),
        ends_at: addisAbabaDateTimeToIso(values.ends_at),
      }),
    });
    form.reset();
    await refresh();
    showAlert('Worker shift scheduled.');
    return;
  }
  if (form.dataset.form === 'workforce-policy') {
    await api('/workforce/policies', {
      method: 'POST',
      body: JSON.stringify({
        policy_version: values.policy_version.trim(),
        jurisdiction: values.jurisdiction.trim(),
        citation: values.citation.trim(),
        effective_from: values.effective_from,
        ...(values.effective_to ? { effective_to: values.effective_to } : {}),
        warning_daily_minutes: number(values.warning_daily_minutes),
        warning_weekly_minutes: number(values.warning_weekly_minutes),
        test_evidence: values.test_evidence.trim(),
      }),
    });
    form.reset();
    await refresh();
    showAlert('Workforce policy draft saved for independent approval.');
    return;
  }
  if (form.dataset.form === 'workforce-payable-calc') {
    const result = await api('/workforce/payable-time/calculate', {
      method: 'POST',
      body: JSON.stringify({ period_start: values.period_start, period_end: values.period_end }),
    });
    state.workforcePayableCalculation = { ...result, requestedBy: state.user.id };
    form.reset();
    await refresh();
    const warningCount = result.calculated.filter((entry) => entry.policy_warnings.length).length;
    showAlert(result.has_more
      ? t('More attendance rows remain in this period. Continue with the next batch.')
      : t('Calculated payable time for {{count}} attendance records. {{warnings}} have warning thresholds to review.', {
        count: result.calculated.length, warnings: warningCount,
      }));
    return;
  }
  if (form.dataset.form === 'workforce-payroll-export') {
    const result = await api('/workforce/payroll-exports', {
      method: 'POST',
      body: JSON.stringify({
        period_start: values.period_start,
        period_end: values.period_end,
        mapping_version: values.mapping_version.trim(),
      }),
    });
    state.workforcePayrollExportBatch = { ...result, requestedBy: state.user.id };
    form.reset();
    await refresh();
    showAlert(result.has_more
      ? t('More payable rows remain in this period. Continue with the next encrypted export.')
      : t('Encrypted payroll export generated. It has not been filed or paid.'));
    return;
  }
  if (form.dataset.form === 'maintenance') {
    const payload = {
      property_id: values.property_id, unit_id: values.unit_id || undefined,
      category: values.category, priority: values.priority, description: values.description.trim(),
    };
    const storageKey = `maintenance-retry:${state.user.id}`;
    let retryState;
    try { retryState = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { retryState = null; }
    const serializedPayload = JSON.stringify(payload);
    let payloadFingerprint;
    if (crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serializedPayload));
      payloadFingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    } else {
      let hash = 2166136261;
      for (let index = 0; index < serializedPayload.length; index += 1) hash = Math.imul(hash ^ serializedPayload.charCodeAt(index), 16777619);
      payloadFingerprint = `${serializedPayload.length}:${(hash >>> 0).toString(16)}`;
    }
    if (!retryState || retryState.payload !== payloadFingerprint) {
      const sameFormRetry = form.dataset.maintenanceRetryPayload === payloadFingerprint;
      retryState = { payload: payloadFingerprint, key: sameFormRetry ? form.dataset.maintenanceIdempotencyKey : crypto.randomUUID() };
    }
    form.dataset.maintenanceRetryPayload = payloadFingerprint;
    form.dataset.maintenanceIdempotencyKey = retryState.key;
    try { sessionStorage.setItem(storageKey, JSON.stringify(retryState)); } catch { /* the server remains idempotent for retries within this form session */ }
    await api('/maintenance', { method: 'POST', body: JSON.stringify({ ...payload, idempotency_key: retryState.key }) });
    try { sessionStorage.removeItem(storageKey); } catch { /* session storage is optional */ }
    form.reset();
    await refresh();
    showAlert('Maintenance request recorded.');
    return;
  }
  if (form.dataset.form === 'subscription-payment-reference') {
    const subscriptionId = form.dataset.subscriptionId;
    if (!subscriptionId) throw new Error(t('The subscription request is missing its identifier.'));
    await api(`/subscriptions/${encodeURIComponent(subscriptionId)}/payment-reference`, {
      method: 'POST',
      body: JSON.stringify({ payment_reference: String(values.payment_reference ?? '').trim() }),
    });
    await loadMySubscriptions();
    renderSubscriptionCatalog();
    showAlert('Payment reference submitted for independent Finance review.');
    return;
  }
  if (form.dataset.form === 'user-role') {
    const body = { role: values.role };
    if (values.parent_agent_id) body.parent_agent_id = values.parent_agent_id;
    const result = await api(`/users/${encodeURIComponent(form.dataset.id)}/role`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!result.changed) {
      showAlert('The account already has this role.');
      return;
    }
    await refresh();
    showAlert('Account role saved.');
    return;
  }
  if (form.dataset.form === 'role-access') {
    const changes = [...form.querySelectorAll('input[data-role][data-activity]')]
      .filter((input) => {
        const role = input.dataset.role;
        const activity = state.roleAccess.activities.find((entry) => entry.key === input.dataset.activity);
        const configured = state.roleAccess.overrides[role]?.[activity.key];
        const defaults = activity.defaultRoles.includes(role)
          || (role === 'global_admin' && activity.defaultRoles.includes('super_admin'));
        return input.checked !== (configured ?? defaults);
      })
      .map((input) => ({ role: input.dataset.role, activity: input.dataset.activity, enabled: input.checked }));
    if (!changes.length) {
      showAlert('Role access is already up to date.');
      return;
    }
    await api('/role-access', { method: 'PATCH', body: JSON.stringify({ changes }) });
    state.roleAccess = await api('/role-access');
    await refresh();
    showAlert('Role access saved.');
    return;
  }
  if (form.dataset.form === 'platform-service-package') {
    const selected = [...form.querySelectorAll('input[name="services"]:checked')].map((input) => input.value);
    await api('/platform/service-packages', {
      method: 'POST',
      body: JSON.stringify({
        package_key: values.package_key,
        display_name: values.display_name,
        description: values.description,
        services: selected,
      }),
    });
    form.reset();
    await refresh();
    showAlert('Service package created.');
    return;
  }
  if (form.dataset.form === 'platform-service-package-update') {
    const selected = [...form.querySelectorAll('input[name="services"]:checked')].map((input) => input.value);
    await api(`/platform/service-packages/${encodeURIComponent(form.dataset.packageId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        display_name: values.display_name,
        description: values.description,
        active: values.active === 'true',
        services: selected,
      }),
    });
    await refresh();
    showAlert('Service package configuration saved.');
    return;
  }
  if (form.dataset.form === 'platform-tenant') {
    if (!values.package_id) throw new Error('Choose a service package before registering a tenant.');
    const payload = { ...values };
    if (!payload.region) delete payload.region;
    if (!payload.deployment_reference) delete payload.deployment_reference;
    await api('/platform/tenants', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    await refresh();
    showAlert('Tenant registered in provisioning state. Verify its deployment before activation.');
    return;
  }
  if (form.dataset.form === 'platform-tenant-admin') {
    if (!values.user_id) throw new Error('Choose an active Super Admin.');
    await api(`/platform/tenants/${encodeURIComponent(form.dataset.tenantId)}/admins`, {
      method: 'POST', body: JSON.stringify({ user_id: values.user_id }),
    });
    await refresh();
    showAlert('Super Admin assigned to this tenant.');
    return;
  }
  if (form.dataset.form === 'platform-tenant-capabilities') {
    const tenantId = values.tenant_id;
    const userId = values.user_id;
    if (!tenantId || !userId) throw new Error('Choose an active tenant and eligible account.');
    const capabilities = [...form.querySelectorAll('input[name="capabilities"]:checked')]
      .map((input) => input.value);
    await api(`/platform/tenant-capabilities/${encodeURIComponent(tenantId)}/${encodeURIComponent(userId)}`, {
      method: 'PUT', body: JSON.stringify({ capabilities }),
    });
    await refresh();
    showAlert('Tenant capability assignment recorded. No database connection or data-plane action was performed.');
    return;
  }
  if (form.dataset.form === 'platform-operator-request') {
    if (!values.tenant_id) throw new Error('Choose an active tenant.');
    const body = {
      tenant_id: values.tenant_id,
      request_type: values.request_type,
      summary: values.summary,
      ...(values.evidence_reference ? { evidence_reference: values.evidence_reference } : {}),
    };
    const result = await api('/platform/operator-requests', { method: 'POST', body: JSON.stringify(body) });
    await refresh();
    showAlert(`Operator request ${result.id} recorded. Execution was not performed.`);
    return;
  }
  if (form.dataset.form === 'tenant-deployment-registration') {
    const reference = String(values.deployment_reference ?? '').trim();
    const payload = { deployment_status: values.deployment_status };
    if (reference) payload.deployment_reference = reference;
    await api(`/platform/my-tenants/${encodeURIComponent(form.dataset.tenantId)}/registration`, {
      method: 'PATCH', body: JSON.stringify(payload),
    });
    await refresh();
    showAlert('Deployment registration submitted to the Global System Admin.');
    return;
  }
  if (form.dataset.form === 'tenant-module-config') {
    const services = [...form.querySelectorAll('input[name="services"]:checked')]
      .map((input) => input.value);
    await api(`/platform/my-tenants/${encodeURIComponent(form.dataset.tenantId)}/modules`, {
      method: 'PATCH',
      body: JSON.stringify({ services }),
    });
    await refresh();
    showAlert('Assigned entity modules saved.');
    return;
  }
  if (form.dataset.form === 'platform-service') {
    await api(`/platform/services/${encodeURIComponent(form.dataset.serviceKey)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        display_name: values.display_name,
        description: values.description,
        available: values.available === 'true',
      }),
    });
    await refresh();
    showAlert('Platform service configuration saved.');
    return;
  }
  if (form.dataset.form === 'platform-tenant-update') {
    const payload = {
      status: values.status,
      deployment_status: values.deployment_status,
      ...(values.package_id ? { package_id: values.package_id } : {}),
      ...(values.deployment_verification_reference ? { deployment_verification_reference: values.deployment_verification_reference } : {}),
    };
    await api(`/platform/tenants/${encodeURIComponent(form.dataset.tenantId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await refresh();
    showAlert('Tenant configuration saved.');
    return;
  }
  if (form.dataset.form === 'platform-catalog-product') {
    await api('/platform/catalog-products', {
      method: 'POST',
      body: JSON.stringify({
        product_key: values.product_key,
        display_name: values.display_name,
        description: values.description,
        category: values.category,
      }),
    });
    form.reset();
    await refresh();
    showAlert('Catalog product created in draft state. Activate it after review.');
    return;
  }
  if (form.dataset.form === 'platform-catalog-product-update') {
    const prior = state.platformCatalogProducts.find((item) => item.id === form.dataset.productId);
    if (!prior) throw new Error('Catalog product is no longer available; refresh and retry.');
    await api(`/platform/catalog-products/${encodeURIComponent(form.dataset.productId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        display_name: values.display_name,
        description: values.description,
        status: values.status,
        attributes: prior.attributes ?? {},
      }),
    });
    await refresh();
    showAlert('Catalog product updated.');
    return;
  }
  if (form.dataset.form === 'property-period-close') {
    const result = await api(`/finance/property-period-close?period=${encodeURIComponent(values.period)}`);
    state.propertyPeriodClose = result;
    renderPanel();
    showAlert('Period checks complete. Confirm all findings with Finance before close.');
    return;
  }
  if (form.dataset.form === 'service-identity') {
    const payload = { ...values };
    if (!payload.owner_user_id) delete payload.owner_user_id;
    if (!payload.expiry_date) delete payload.expiry_date;
    await api('/service-identities', { method: 'POST', body: JSON.stringify(payload) });
    await refresh();
    showAlert('Service identity recorded. No secret value was stored.');
    return;
  }
  if (form.dataset.form === 'service-identity-rotate') {
    await api(`/service-identities/${form.dataset.identity}/rotate`, { method: 'POST', body: JSON.stringify(values) });
    await refresh();
    showAlert('Rotation evidence recorded. The external secret manager remains authoritative for the credential.');
    return;
  }
  if (form.dataset.form === 'readiness-evidence') {
    const payload = {
      module: values.module,
      category: values.category,
      owner_name: values.owner.trim(),
      approver_name: values.approver.trim(),
      status: values.status,
      evidence_reference: values.evidence_ref.trim(),
      environment: values.environment,
      notes: values.notes?.trim() ?? '',
    };
    if (!payload.owner_name || !payload.approver_name || !payload.evidence_reference) {
      throw new Error('Owner, approver, and evidence reference are required.');
    }
    await api('/readiness-evidence', { method: 'POST', body: JSON.stringify(payload) });
    state.readinessEvidence = await api('/readiness-evidence');
    renderPanel();
    showAlert('Operational readiness evidence recorded in the shared database. This is evidence only and does not grant approval.');
    return;
  }
  if (form.dataset.form === 'learning-content') {
    const payload = { ...values };
    payload.audience_roles = [...form.querySelectorAll('input[name="audience_roles"]:checked')].map((input) => input.value);
    if (!payload.video_url) delete payload.video_url;
    const contentId = form.dataset.content;
    await api(contentId ? `/learning/content/${contentId}` : '/learning/content', {
      method: contentId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    await refresh();
    showAlert(contentId ? 'Training content updated.' : 'Training content saved.');
    return;
  }
  if (form.dataset.form === 'password') {
    const wasRequired = state.user.must_change_password;
    const result = await api('/auth/change-password', { method: 'POST', body: JSON.stringify(values) });
    sessionStorage.setItem(TOKEN_KEY, result.token);
    state.user.must_change_password = false;
    state.mfaRequired = result.restrict === 'mfa';
    if (state.mfaRequired) {
      state.panel = 'security';
      await loadWorkspace();
    } else if (wasRequired) {
      state.panel = 'overview';
      await loadWorkspace();
    } else {
      state.panel = 'overview';
      history.replaceState(null, '', panelUrl(window.location.href, state.panel));
      await refresh();
    }
    showAlert('Password updated successfully.');
    return;
  }
  if (form.dataset.form === 'insurance-request') {
    await api('/insurance/requests', {
      method: 'POST',
      body: JSON.stringify({
        product_interest: values.product_interest,
        message: values.message,
        consent: values.consent === 'on',
        agent_referral_consent: values.agent_referral_consent === 'on',
      }),
    });
    await refresh();
    showAlert('Your Insurance information request was submitted. It is not an application or policy.');
    return;
  }
  if (form.dataset.form === 'insurance-sandbox-create') {
    await api('/insurance/brokerage-sandbox/cases', {
      method: 'POST',
      body: JSON.stringify({ acknowledge_synthetic_only: values.acknowledge_synthetic_only === 'on' }),
    });
    state.insuranceSandboxCases = await api('/insurance/brokerage-sandbox/cases/mine');
    renderPanel();
    showAlert('Synthetic Insurance brokerage training case created; no live business activity occurred.');
    return;
  }
  if (form.dataset.form === 'mfa-enable') {
    const result = await api('/auth/mfa/enable', { method: 'POST', body: JSON.stringify(values) });
    sessionStorage.setItem(TOKEN_KEY, result.token);
    state.mfaRequired = false;
    state.mfaSetup = null;
    await loadWorkspace();
    showAlert('Two-step verification enabled.');
    return;
  }
  if (form.dataset.form === 'mfa-disable') {
    await api('/auth/mfa/disable', { method: 'POST', body: JSON.stringify(values) });
    await loadWorkspace();
    showAlert('Two-step verification disabled.');
    return;
  }
  if (form.dataset.form === 'tenant') {
    const payload = { ...values };
    if (!payload.national_id) delete payload.national_id;
    await api('/tenants', { method: 'POST', body: JSON.stringify(payload) });
    await refresh(); showAlert('Tenant registered.'); return;
  }
  if (form.dataset.form === 'lease') {
    const payload = { ...values, rent: number(values.rent), deposit: number(values.deposit || '0'), months: number(values.months) };
    await api('/leases/workflow', { method: 'POST', body: JSON.stringify(payload) });
    await refresh(); showAlert('Lease draft created. Submit it for independent approval before collecting signatures or activating the unit.'); return;
  }
  if (form.dataset.form === 'lease-renewal-offer') {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    const payload = {
      proposed_rent: values.proposed_rent,
      proposed_deposit: values.proposed_deposit,
      proposed_start_date: values.proposed_start_date,
      term_months: number(values.term_months),
      due_day: number(values.due_day || '5'),
      expires_on: values.expires_on,
      request_reason: values.reason.trim(),
      idempotency_key: form.dataset.idempotencyKey,
    };
    await api(`/leases/${encodeURIComponent(form.dataset.lease)}/renewal-offers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.dataset.idempotencyKey = crypto.randomUUID();
    await refresh();
    showAlert('Renewal terms submitted for independent approval. The existing lease remains unchanged.');
    return;
  }
  if (form.dataset.form === 'lease-signature') {
    const file = form.querySelector('input[name="signature_document"]')?.files?.[0];
    if (!file) throw new Error('Choose a signature evidence file.');
    if (file.size > 10 * 1024 * 1024) throw new Error('The signature evidence file must be 10 MB or smaller.');
    const query = new URLSearchParams({ party: form.dataset.party, signer_name: values.signer_name.trim() });
    await api(`/leases/${form.dataset.lease}/signature-documents?${query}`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
    await refresh();
    showAlert('Signature evidence uploaded. The file does not verify signer identity or legal validity.');
    return;
  }
  if (form.dataset.form === 'lease-notice') {
    const payload = {
      ...values,
      idempotency_key: form.dataset.idempotencyKey ??= crypto.randomUUID(),
    };
    await api(`/leases/${form.dataset.lease}/notices`, { method: 'POST', body: JSON.stringify(payload) });
    await refresh();
    showAlert('Operational notice record saved. This does not terminate the lease or establish legal validity.');
    return;
  }
  if (form.dataset.form === 'contract') {
    await api(`/leads/${values.lead_id}/contracts`, { method: 'POST', body: JSON.stringify({ track: values.track, base_value: number(values.base_value) }) });
    await refresh(); showAlert('Contract created.'); return;
  }
  if (form.dataset.form === 'business-rules') {
    const changed = {};
    for (const rule of state.businessRules) {
      const input = form.elements.namedItem(rule.key);
      const value = input.type === 'checkbox' ? Number(input.checked) : number(input.value);
      if (value !== Number(rule.value)) changed[rule.key] = value;
    }
    if (!Object.keys(changed).length) {
      showAlert('No business rule changes to save.');
      return;
    }
    const result = await api('/business-rules', { method: 'PATCH', body: JSON.stringify({ values: changed }) });
    state.businessRules = result.rules;
    await refresh();
    showAlert('Business rules saved. {{count}} unsigned contracts were repriced.', false, { count: result.repriced_contracts });
    return;
  }
  if (form.dataset.form === 'property-resubmit') {
    const payload = {
      address: values.address.trim(),
      description: values.description.trim(),
      listing_mode: values.listing_mode,
      sale_price: values.sale_price ? number(values.sale_price) : undefined,
      rent_period: values.rent_period,
    };
    await api(`/properties/${form.dataset.property}/resubmit`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await refresh();
    showAlert('Updated property listing submitted for independent review.');
    return;
  }
  if (form.dataset.form === 'property') {
    const unit = {};
    if (values.unit_no.trim()) unit.unit_no = values.unit_no.trim();
    if (values.floor) unit.floor = number(values.floor);
    if (values.rent) unit.rent = number(values.rent);
    const payload = {
      address: values.address.trim(),
      ptype: values.ptype,
      description: values.description?.trim()||undefined,
      listing_mode: values.listing_mode,
      sale_price: values.sale_price?number(values.sale_price):undefined,
      rent_period: values.rent_period||undefined,
      owner_user_id: values.owner_user_id||undefined,
      territory_id: number(values.territory_id),
      ...(Object.keys(unit).length ? { units: [unit] } : {}),
    };
    const property = await api('/properties', { method: 'POST', body: JSON.stringify(payload) });
    const photos = form.querySelector('input[name="photos"]').files;
    try {
      await uploadPropertyPhotos(property.id, photos);
    } catch (error) {
      await refresh();
      showAlert(t('Property listing was saved, but picture upload failed: {{error}} Use Add pictures to retry.', { error: error.message }), true);
      return;
    }
    form.reset();
    await refresh();
    showAlert('Property listing saved. Upload ownership or delegated-authority evidence; it remains unavailable to customers until authority and listing reviews are approved.');
    return;
  }
  if (form.dataset.form === 'property-authority-evidence') {
    const file = form.querySelector('input[name="evidence_file"]').files[0];
    if (!file) throw new Error(t('Choose an ownership or delegated-authority document.'));
    const evidenceType = form.querySelector('select[name="evidence_type"]').value;
    await api(`/properties/${form.dataset.property}/authority-evidence?evidence_type=${encodeURIComponent(evidenceType)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: file,
    });
    await refresh();
    showAlert('Malware-scanned property authority evidence uploaded.');
    return;
  }
  if (form.dataset.form === 'property-photos') {
    const files = form.querySelector('input[name="photos"]').files;
    if (!files.length) throw new Error(t('Choose at least one picture to upload.'));
    await uploadPropertyPhotos(form.dataset.property, files, values.caption);
    await refresh();
    showAlert('Property pictures uploaded successfully.');
    return;
  }
  if (form.dataset.form === 'upload-document') {
    const file = form.querySelector('input[type="file"]').files[0];
    if (!file) throw new Error('Choose a document to upload.');
    const params = new URLSearchParams({ doc_type: values.doc_type });
    if (values.expires_on) params.set('expires_on', values.expires_on);
    await api(`/workers/${form.dataset.worker}/documents/upload?${params}`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: file,
    });
    await refresh();
    showAlert('Document uploaded for compliance review.');
    return;
  }
  if (form.dataset.form === 'lead') {
    await api('/leads', { method: 'POST', body: JSON.stringify(values) });
  } else if (form.dataset.form === 'lead-reassign') {
    await api(`/admin/leads/${form.dataset.lead}/reassign`, { method: 'POST', body: JSON.stringify(values) });
    await refresh(); showAlert('Lead reassigned and new ownership protection started.'); return;
  } else if (form.dataset.form === 'worker') {
    await api('/workers', { method: 'POST', body: JSON.stringify({
      ...values,
      rate_expected: number(values.rate_expected),
      experience_years: Number(values.experience_years || 0),
      territory_id: number(values.territory_id),
      skills: values.skills.split(',').map((value) => value.trim()).filter(Boolean),
      languages: values.languages.split(',').map((value) => value.trim()).filter(Boolean),
    }) });
  } else if (form.dataset.form === 'request') {
    form.dataset.idempotencyKey ||= crypto.randomUUID();
    await api('/requests', { method: 'POST', headers: { 'Idempotency-Key': form.dataset.idempotencyKey }, body: JSON.stringify({
      ...values,
      rate_offered: number(values.rate_offered),
      min_experience: Number(values.min_experience || 0),
      territory_id: number(values.territory_id),
      skills_required: values.skills_required.split(',').map((value) => value.trim()).filter(Boolean),
      languages_required: values.languages_required.split(',').map((value) => value.trim()).filter(Boolean),
    }) });
    delete form.dataset.idempotencyKey;
  } else if (form.dataset.form === 'user') {
    const payload = { ...values };
    if (!payload.territory_id) delete payload.territory_id;
    else payload.territory_id = number(payload.territory_id);
    if (!payload.parent_agent_id) delete payload.parent_agent_id;
    if (!payload.vendor_id) delete payload.vendor_id;
    if (!payload.email) delete payload.email;
    if (!payload.service_specialization) delete payload.service_specialization;
    if (!['master_agent','field_agent'].includes(payload.role)) delete payload.requested_plan;
    const result = await api('/users', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    await refresh();
    showAlert('Account created for {{name}}. Temporary password (shown once): {{password}}. KYC upload token (valid 24 hours): {{upload_token}}. Vendor portal access is assigned after KYC review and independent activation.', false, {
      name: result.user.legal_name,
      password: result.temp_password,
      upload_token: result.signup_upload_token ?? 'not required for this account',
    });
    return;
  } else if (form.dataset.form === 'notification-retry') {
    await api(`/notifications/${encodeURIComponent(form.dataset.id)}/retry`, {
      method: 'POST',
      body: JSON.stringify({ reason: values.reason }),
    });
  } else if (form.dataset.form === 'maintenance-cost-decision') {
    await api(`/maintenance/vendor/additional-cost/${encodeURIComponent(form.dataset.id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: values.decision, reason: values.reason }),
    });
  } else if (form.dataset.form === 'maintenance-invoice-mismatch') {
    await api(`/maintenance/vendor/invoices/${encodeURIComponent(form.dataset.id)}/resolve-mismatch`, {
      method: 'POST',
      body: JSON.stringify({ reason: values.reason }),
    });
  } else if (form.dataset.form === 'maintenance-invoice-decision') {
    await api(`/property-vendor-bills/${encodeURIComponent(form.dataset.id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: values.decision, reason: values.reason }),
    });
  } else if (form.dataset.form === 'global-admin-promotion') {
    await api('/global-admin-promotions', {
      method: 'POST',
      body: JSON.stringify({ target_user_id: values.target_user_id }),
    });
    await refresh();
    showAlert('Global Admin promotion request submitted for independent review.');
    return;
  }
  if (form.dataset.form === 'marketplace') {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('Your session expired. Sign in again before uploading listing media.');
    const files = [...form.querySelector('input[name="media"]').files];
    if (!files.length) throw new Error('Add at least one photo before posting this listing.');
    const payload = marketplaceListingPayload(values);
    const listing = await api('/marketplace/listings', { method: 'POST', body: JSON.stringify(payload) });
    for (const file of files) {
      const qs = new URLSearchParams();
      const response = await fetch(`${apiRoot()}/marketplace/listings/${listing.id}/media/upload?${qs}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': file.type },
        body: file,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? `Media upload failed (${response.status})`);
    }
    await api(`/marketplace/listings/${listing.id}/submit`, { method: 'POST', body: '{}' });
    await refresh();
    showAlert('Listing submitted. It will appear to buyers after any required review.');
    return;
  }
  if (form.dataset.form === 'marketplace-existing-media') {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('Your session expired. Sign in again before uploading listing media.');
    const files = [...form.querySelector('input[name="media"]').files];
    if (!files.length) throw new Error('Choose at least one file.');
    for (const file of files) {
      const response = await fetch(`${apiRoot()}/marketplace/listings/${form.dataset.listing}/media/upload`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': file.type },
        body: file,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? `Upload failed (${response.status})`);
    }
    await api(`/marketplace/listings/${form.dataset.listing}/submit`, { method: 'POST', body: '{}' });
    await refresh();
    showAlert('Listing submitted for publication review.');
    return;
  }
  if (form.dataset.form === 'marketplace-config') {
    const valuesToSave = [];
    const enabled = ['products', 'services', 'equipment', 'properties']
      .filter((key) => form.elements.namedItem(`domain:${key}`)?.checked);
    if (enabled.length) valuesToSave.push({ scope: 'system', key: 'enabled_domains', value: enabled });
    const categories = (scope) => form.elements.namedItem(`${scope}_categories`).value
      .split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [key, ...rest] = line.split('|');
        return { key: key.trim().toLowerCase().replaceAll(' ', '_'), label: rest.join('|').trim(), enabled: true };
      });
    for (const scope of ['products', 'services']) valuesToSave.push({ scope, key: 'categories', value: categories(scope) });
    const property_types = form.elements.namedItem('property_types').value
      .split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [key, ...rest] = line.split('|');
        return { key: key.trim(), label: rest.join('|').trim(), enabled: true };
      });
    const periods = form.elements.namedItem('rental_periods').value
      .split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [key, ...rest] = line.split('|');
        return { key: key.trim(), label: rest.join('|').trim(), enabled: true };
      });
    valuesToSave.push(
      { scope: 'properties', key: 'property_types', value: property_types },
      { scope: 'rentals', key: 'periods', value: periods },
    );
    if (state.user.role === 'global_admin') {
      valuesToSave.push({ scope: 'system', key: 'moderation_required', value: form.elements.namedItem('moderation_required').checked });
      valuesToSave.push({ scope: 'system', key: 'image_max_bytes', value: Math.round(number(form.elements.namedItem('image_max_mb').value) * 1048576) });
      valuesToSave.push({ scope: 'system', key: 'video_max_bytes', value: Math.round(number(form.elements.namedItem('video_max_mb').value) * 1048576) });
      valuesToSave.push({ scope: 'system', key: 'max_media_per_listing', value: number(form.elements.namedItem('max_media_per_listing').value) });
      const account_types = (state.marketplaceConfig.users?.account_types ?? [])
        .map((account) => ({ ...account, enabled: form.elements.namedItem(`account:${account.key}`).checked }));
      valuesToSave.push({ scope: 'users', key: 'account_types', value: account_types });
      const kyc_requirements = {};
      for (const role of ['worker', 'customer', 'agent', 'property_owner']) {
        kyc_requirements[role] = ['national_id', 'police_clearance']
          .filter((doc) => form.elements.namedItem(`kyc:${role}:${doc}`).checked);
      }
      kyc_requirements.property_vendor = ['national_id'];
      valuesToSave.push({ scope: 'users', key: 'kyc_requirements', value: kyc_requirements });
    }
    if (!enabled.length) throw new Error('Enable at least one marketplace domain.');
    if (valuesToSave.some((entry) => entry.scope === 'products' || entry.scope === 'services')
      && valuesToSave.filter((entry) => ['products', 'services'].includes(entry.scope)).some((entry) => !entry.value.length)) {
      throw new Error('Keep at least one category in each catalog.');
    }
    state.marketplaceConfig = await api('/marketplace/config', {
      method: 'PATCH',
      body: JSON.stringify({ values: valuesToSave }),
    });
    await refresh();
    showAlert('Marketplace configuration saved.');
    return;
  }
  form.reset();
  await refresh();
  showAlert('Saved successfully.');
}

async function showCandidates(requestId, container) {
  const existing = container.querySelector('.candidate-results');
  if (existing) { existing.remove(); return; }
  const panel = node('div', undefined, 'candidate-results list');
  panel.style.gridColumn = '1 / -1';
  panel.append(node('h3', 'Eligible candidates'));
  panel.append(node('p', 'Scores are recommendations based on the factors below. A staff member reviews each proposal. Confirm the worker’s willingness and terms directly before reserving.', 'muted'));
  try {
    const candidates = await api(`/requests/${requestId}/candidates`);
    if (!candidates.length) panel.append(empty('No verified available workers meet this request yet.'));
    for (const person of candidates) {
      const item = card(person.name, t('{{years}} years · match score {{score}}%', { years: person.experience_years, score: person.score }), 'verified');
      item.append(matchBreakdown(person.parts));
      item.append(matchEvaluation(person.evaluation));
      item.append(button('Propose match', 'propose', 'button button-primary', { id: requestId, worker: person.worker_id }));
      panel.append(item);
    }
  } catch (error) {
    panel.append(empty(error.message));
  }
  container.append(panel);
}

function matchBreakdown(parts) {
  const details = document.createElement('details');
  details.className = 'match-breakdown';
  const summary = node('summary', 'Score factors');
  details.append(summary);
  const labels = { skills: 'Skills', location: 'Location', availability: 'Availability', experience: 'Experience', rate: 'Expected rate', language: 'Languages' };
  const list = node('ul');
  for (const [key, label] of Object.entries(labels)) {
    if (typeof parts?.[key] !== 'number') continue;
    list.append(node('li', `${label}: ${Math.round(parts[key] * 100)}%`));
  }
  if (!list.children.length) list.append(node('li', 'Breakdown unavailable for this earlier match.'));
  details.append(list);
  return details;
}

function matchEvaluation(evaluation) {
  if (!evaluation || typeof evaluation !== 'object') return document.createDocumentFragment();
  const details = document.createElement('details');
  details.className = 'match-breakdown';
  details.append(node('summary', 'Eligibility and scoring policy'));
  const list = node('ul');
  const labels = {
    worker_verified: 'Worker verification',
    worker_available: 'Worker availability',
    sector_matches: 'Service sector',
    current_national_id: 'Current national ID',
    current_police_clearance: 'Current police clearance',
    current_reference: 'Current reference',
    current_certificate: 'Current certificate',
    not_previously_proposed: 'Not already proposed for this request',
  };
  for (const [key, label] of Object.entries(labels)) {
    if (typeof evaluation.eligibility?.[key] !== 'boolean') continue;
    const required = key === 'current_reference' ? evaluation.eligibility.reference_required
      : key === 'current_certificate' ? evaluation.eligibility.certificate_required : true;
    const state = evaluation.eligibility[key] ? 'passed' : 'not present';
    list.append(node('li', `${label}: ${state}${required ? ' (required)' : ' (optional)'}`));
  }
  if (evaluation.scoring?.weights) {
    list.append(node('li', `Scoring policy: ${evaluation.policy_version ?? 'legacy'}`));
    for (const [factor, weight] of Object.entries(evaluation.scoring.weights)) {
      list.append(node('li', `${factor}: weight ${weight}`));
    }
  }
  if (evaluation.evaluated_at) {
    list.append(node('li', `Evaluated: ${new Date(evaluation.evaluated_at).toLocaleString()}`));
  }
  if (!list.children.length) list.append(node('li', 'Evaluation details are unavailable for this record.'));
  details.append(list);
  return details;
}

async function showMatches(requestId, container) {
  const existing = container.querySelector('.match-results');
  if (existing) { existing.remove(); return; }
  const panel = node('div', undefined, 'match-results list');
  panel.style.gridColumn = '1 / -1';
  panel.append(node('h3', 'Proposed matches'));
  try {
    const matches = await api(`/requests/${requestId}/matches`);
    if (!matches.length) panel.append(empty('No matches have been proposed.'));
    for (const match of matches) {
      const item = card(match.worker_name, t('Match score {{score}}%', { score: match.score }), match.status);
      item.append(matchBreakdown(match.score_breakdown));
      item.append(matchEvaluation(match.score_breakdown?._evaluation));
      if (match.status === 'proposed') {
        item.append(button('Confirm match & reserve', 'respond', 'button button-primary', { id: match.id, decision: 'accepted' }));
        item.append(button('Decline', 'respond', 'button button-outline', { id: match.id, decision: 'declined' }));
      } else if (match.status === 'accepted') {
        item.append(button('Release reservation', 'release', 'button button-outline', { id: match.id }));
        if (!match.engagement_id && ['master_agent','field_agent','finance','finance_manager','super_admin','global_admin'].includes(state.user.role)) {
          const form = node('form', undefined, 'inline-form staffing-engagement-form');
          form.dataset.form = 'staffing-engagement'; form.dataset.match = match.id;
          form.append(node('h4', 'Prepare engagement terms'));
          const workerType = field('Worker arrangement', 'worker_type', 'select');
          const workerTypePrompt = node('option', 'Choose a worker arrangement');
          workerTypePrompt.value = '';
          workerTypePrompt.disabled = true;
          workerTypePrompt.selected = true;
          workerType.input.required = true;
          workerType.input.append(workerTypePrompt);
          for (const [value, label] of Object.entries(WORKER_TYPE_LABELS)) {
            const option = node('option', label);
            option.value = value;
            workerType.input.append(option);
          }
          const unit = field('Billing unit', 'billing_unit', 'select');
          for (const [value,label] of [['hour','Hour'],['day','Day'],['week','Week'],['month','Month'],['fixed','Fixed amount']]) { const option=node('option',label);option.value=value;unit.input.append(option); }
          form.append(workerType.label, unit.label, field('Client rate (ETB per unit)', 'client_rate', 'number', true, { min: '0.01', step: '0.01' }).label,
            field('Worker rate (ETB per unit)', 'worker_rate', 'number', true, { min: '0.01', step: '0.01' }).label,
            field('Start date', 'starts_on', 'date').label, field('End date (optional)', 'ends_on', 'date', false).label,
            node('p', 'Finance independently reviews these terms. They do not create payroll or ledger entries.'),
            button('Submit terms for Finance review', 'submit', 'button button-primary'));
          item.append(form);
        } else if (match.engagement_id) {
          item.append(node('p', `Engagement ${match.engagement_status} · ${match.billing_unit} · client ETB ${Number(match.client_rate).toLocaleString(document.documentElement.lang)} · worker ETB ${Number(match.worker_rate).toLocaleString(document.documentElement.lang)} · starts ${match.starts_on}`));
          if (match.engagement_status === 'active' && ['master_agent','field_agent','finance','finance_manager','super_admin','global_admin'].includes(state.user.role)) {
            const form = node('form', undefined, 'inline-form staffing-work-period-form');
            form.dataset.form = 'staffing-work-period'; form.dataset.engagement = match.engagement_id;
            form.append(node('h4', 'Submit completed work evidence'));
            form.append(field('Period start', 'period_start', 'date').label, field('Period end', 'period_end', 'date').label,
              field('Quantity', 'quantity', 'number', true, { min: '0.01', step: '0.01' }).label,
              field('Work completed', 'description', 'textarea', true, { minlength: 5, maxlength: 1000, rows: 2 }).label,
              button('Submit work evidence for review', 'submit', 'button button-outline'));
            item.append(form);
          }
        }
      }
      panel.append(item);
    }
  } catch (error) {
    panel.append(empty(error.message));
  }
  container.append(panel);
}

async function showWorkerDocuments(workerId, container) {
  const previous = container.querySelector('.document-results');
  if (previous) { previous.remove(); return; }
  const panel = node('div', undefined, 'document-results list');
  panel.style.gridColumn = '1 / -1';
  panel.append(node('h3', 'Worker documents'));
  try {
    const documents = await api(`/workers/${workerId}/documents`);
    if (!documents.length) panel.append(empty('No documents uploaded yet.'));
    for (const document of documents) {
      const item = card(t(document.doc_type.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')), [t('Expires {{date}}', { date: document.expires_on ?? t('not specified') }), document.review_note].filter(Boolean).join(' · '), document.status);
      item.append(button('Download', 'document-download', 'button button-outline', { id: document.id }));
      if (state.user.role === 'compliance' && ['uploaded','under_review'].includes(document.status)) {
        item.append(button('Verify document', 'document-review', 'button button-primary', { id: document.id, decision: 'verified' }));
        item.append(button('Reject', 'document-review', 'button button-outline', { id: document.id, decision: 'rejected' }));
      }
      panel.append(item);
    }
  } catch (error) {
    panel.append(empty(error.message));
  }
  container.append(panel);
}

function showDocumentUpload(workerId, container) {
  const previous = container.querySelector('.document-upload');
  if (previous) { previous.remove(); return; }
  const form = node('form', undefined, 'document-upload form-card inline-form');
  form.dataset.form = 'upload-document';
  form.dataset.worker = workerId;
  form.style.gridColumn = '1 / -1';
  const title = node('h3', 'Upload identity document'); title.className = 'span-2'; form.append(title);
  const kind = field('Document type', 'doc_type', 'select');
  for (const [value, label] of [['national_id','National ID'],['police_clearance','Police clearance'],['reference','Reference'],['certificate','Certificate']]) {
    const option = node('option', label); option.value = value; kind.input.append(option);
  }
  form.append(kind.label, field('Expiry date (if applicable)', 'expires_on', 'date', false).label);
  form.append(field('PDF, JPEG or PNG (up to 10 MB)', 'file', 'file', true, { accept: 'application/pdf,image/jpeg,image/png' }).label);
  form.append(button('Upload privately', 'submit', 'button button-primary span-2'));
  container.append(form);
}

async function showPropertyPhotos(propertyId, container) {
  const previous = container.querySelector('.property-gallery');
  if (previous) {
    previous.remove();
    return;
  }
  const gallery = node('div', undefined, 'property-gallery');
  gallery.append(node('h3', 'Property photos & video'));
  container.append(gallery);
  try {
    const photos = await api(`/properties/${propertyId}/photos`);
    if (!photos.length) {
      gallery.append(empty('No pictures have been added to this listing yet.'));
      return;
    }
    const grid = node('div', undefined, 'property-photo-grid');
    for (const photo of photos) {
      const propertyContextHeaders = propertyTenantRequestHeaders();
      const response = await authenticatedPropertyFetch(`/properties/${propertyId}/photos/${photo.id}/file`, {
        headers: { authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` },
      });
      if (!response.ok) throw new Error(t('Could not load a property picture ({{status}}).', { status: response.status }));
      const url = URL.createObjectURL(await response.blob());
      propertyPhotoUrls.add(url);
      const figure = node('figure', undefined, 'property-photo');
      if (photo.mime?.startsWith('video/')) {
        const video=node('video'); video.src=url; video.controls=true; video.playsInline=true; video.preload='metadata'; video.setAttribute('aria-label',photo.caption||t('Property video')); figure.append(video);
      } else {
        const image = node('img'); image.src = url; image.alt = photo.caption || t('Property picture'); image.loading = 'lazy'; figure.append(image);
      }
      if (photo.caption) figure.append(node('figcaption', photo.caption));
      grid.append(figure);
    }
    gallery.append(grid);
  } catch (error) {
    gallery.append(empty(error.message));
  }
}

function showPropertyUnitForm(propertyId, container) {
  const previous = container.querySelector('.property-unit-form');
  if (previous) {
    previous.remove();
    return;
  }
  const property = state.properties.find((entry) => entry.id === propertyId);
  if (!property) {
    showAlert('Property details are unavailable. Refresh and try again.', true);
    return;
  }
  const form = node('form', undefined, 'property-unit-form inline-form');
  form.dataset.form = 'property-unit';
  form.dataset.property = propertyId;
  form.append(node('h3', 'Add a unit'));
  form.append(field('Unit number', 'unit_no', 'text', true, { maxlength: 80 }).label);
  const unitType = field('Unit type', 'ptype', 'text', true, { maxlength: 80 });
  unitType.input.value = property.ptype || 'apartment';
  form.append(unitType.label);
  form.append(field('Floor (optional)', 'floor', 'number', false, { step: 1 }).label);
  if (property.listing_mode !== 'sale') {
    form.append(field('Rent (ETB, optional)', 'rent', 'number', false, { min: 0, step: '0.01' }).label);
  }
  form.append(button('Save unit', 'submit', 'button button-primary'));
  container.append(form);
}

function showPropertyUpload(propertyId, container) {
  const previous = container.querySelector('.property-photo-upload');
  if (previous) {
    previous.remove();
    return;
  }
  const form = node('form', undefined, 'property-photo-upload inline-form');
  form.dataset.form = 'property-photos';
  form.dataset.property = propertyId;
  const title = node('h3', 'Add listing photos or video');
  title.className = 'span-2';
  form.append(title);
  const pictures = field('Choose photos or video (JPEG, PNG, MP4 or WebM)', 'photos', 'file', true, {
    accept: 'image/jpeg,image/png,video/mp4,video/webm',
    multiple: true,
  }).label;
  pictures.className = 'span-2';
  form.append(pictures);
  form.append(field('Caption (optional)', 'caption', 'text', false, { maxlength: '300' }).label);
  form.append(button('Upload media', 'submit', 'button button-primary span-2'));
  container.append(form);
}

async function showUserDocuments(userId, container) {
  const previous = container.querySelector('.user-document-results');
  if (previous) {
    previous.remove();
    return;
  }
  const panel = node('div', undefined, 'user-document-results list');
  panel.style.gridColumn = '1 / -1';
  panel.append(node('h3', 'Applicant KYC documents'));
  container.append(panel);
  try {
    const documents = await api(`/users/${userId}/documents`);
    if (!documents.length) {
      panel.append(empty('The applicant has not uploaded any KYC documents.'));
      return;
    }
    for (const doc of documents) {
      const item = card(t(doc.doc_type.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')), t('{{size}} · uploaded {{date}}', {
        size: `${Math.ceil(doc.size_bytes / 1024)} KB`,
        date: new Date(doc.created_at).toLocaleDateString(document.documentElement.lang),
      }), doc.status);
      if (doc.review_note) item.append(node('p', doc.review_note, 'form-error'));
      item.append(button('Download', 'user-document-download', 'button button-outline', { id: doc.id, user: userId }));
      if (state.user.role === 'compliance' && doc.status === 'uploaded' && userId !== state.user.id) {
        item.append(button('Verify document', 'user-document-review', 'button button-primary', { id: doc.id, user: userId, decision: 'verified' }));
        item.append(button('Reject document', 'user-document-review', 'button button-outline', { id: doc.id, user: userId, decision: 'rejected' }));
      }
      panel.append(item);
    }
  } catch (error) {
    panel.append(empty(error.message));
  }
}

async function uploadPropertyPhotos(propertyId, files, caption = '') {
  if (!files.length) return;
  for (const file of files) {
    if (!['image/jpeg', 'image/png','video/mp4','video/webm'].includes(file.type)) {
      throw new Error(t('Choose a JPEG/PNG image or MP4/WebM video.'));
    }
    const limit=Number(file.type.startsWith('image/')?state.marketplaceConfig.system?.image_max_bytes:state.marketplaceConfig.system?.video_max_bytes)|| (file.type.startsWith('image/')?10485760:52428800);
    if (file.size > limit) {
      throw new Error(t('This file exceeds the configured upload size limit.'));
    }
    const query = new URLSearchParams({ caption });
    const response = await authenticatedPropertyFetch(`/properties/${propertyId}/photos/upload?${query}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}`,
        'content-type': file.type,
      },
      body: file,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(t(result?.error ?? 'Picture upload failed ({{status}})', { status: response.status }));
  }
}

document.addEventListener('change', (event) => {
  const propertyTenantSelect = event.target.closest('select[data-property-tenant-context]');
  if (propertyTenantSelect) {
    const [tenantSystemId, supportGrantId] = propertyTenantSelect.value.split(':');
    state.propertyTenantContextId = tenantSystemId || null;
    state.propertyTenantSupportGrantId = supportGrantId || null;
    if (state.propertyTenantContextId) localStorage.setItem(PROPERTY_TENANT_KEY, state.propertyTenantContextId);
    else localStorage.removeItem(PROPERTY_TENANT_KEY);
    if (state.propertyTenantSupportGrantId) {
      localStorage.setItem(PROPERTY_TENANT_SUPPORT_GRANT_KEY, state.propertyTenantSupportGrantId);
    } else {
      localStorage.removeItem(PROPERTY_TENANT_SUPPORT_GRANT_KEY);
    }
    loadedPanels.clear();
    if (state.panel === 'properties' || state.panel === 'rent') {
      refresh().catch((error) => showAlert(error.message, true));
    } else {
      showAlert('Property tenant context updated.');
    }
    return;
  }
  const contextSelect = event.target.closest('select[data-platform-tenant-context]');
  if (!contextSelect) return;
  state.platformTenantContextId = contextSelect.value || null;
  loadWorkspace().catch((error) => showAlert(error.message, true));
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  showAlert('');
  const submit = form.querySelector('button[type="submit"]');
  const saveFeedbackForms = new Set([
    'user-role', 'role-access', 'business-rules', 'marketplace-config',
    'platform-service-package', 'platform-service-package-update', 'platform-service',
    'platform-tenant', 'platform-tenant-admin', 'platform-tenant-update',
    'platform-catalog-product', 'platform-catalog-product-update',
    'tenant-module-config', 'tenant-deployment-registration', 'platform-tenant-capabilities',
  ]);
  if (submit) {
    submit.disabled = true;
    if (saveFeedbackForms.has(form.dataset.form)) {
      submit.dataset.idleLabel = submit.textContent;
      submit.textContent = 'Saving…';
      submit.setAttribute('aria-busy', 'true');
    }
  }
  submitForm(form)
    .catch((error) => showAlert(error.message, true))
    .finally(() => {
      if (submit?.isConnected) {
        submit.disabled = false;
        if (submit.dataset.idleLabel) {
          submit.textContent = submit.dataset.idleLabel;
          delete submit.dataset.idleLabel;
          submit.removeAttribute('aria-busy');
        }
      }
    });
});

$('#assistant-dialog').addEventListener('close', () => {
  if (assistantRefreshTimer) clearInterval(assistantRefreshTimer);
  assistantRefreshTimer = null;
});

window.addEventListener('online', () => {
  if (state.user?.role !== 'worker') return;
  void (async () => {
    await syncWorkerClockQueue();
    await refresh();
  })().catch((error) => showAlert(error.message, true));
});

document.addEventListener('click', async (event) => {
  if (event.target.closest('#assistant-presence-toggle')) {
    try {
      await api('/assistant/availability', {
        method: 'PUT',
        body: JSON.stringify({ available: !state.assistant.available }),
      });
      await refreshAssistant();
      startAssistantHeartbeat();
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  const assistantAction = event.target.closest('[data-action^="assistant-"]');
  if (assistantAction) {
    event.stopPropagation();
    const { action, id } = assistantAction.dataset;
    try {
      if (action === 'assistant-select') {
        await selectAssistantConversation(id);
      } else if (action === 'assistant-claim') {
        await api(`/assistant/conversations/${encodeURIComponent(id)}/claim`, { method: 'POST', body: '{}' });
        await refreshAssistant();
        await selectAssistantConversation(id);
      } else if (action === 'assistant-navigate') {
        $('#assistant-dialog').close();
        navigateToPanel(assistantAction.dataset.panel);
      }
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (event.target.closest('#assistant-launcher')) {
    $('#assistant-dialog').showModal();
    try {
      await refreshAssistant();
      startAssistantHeartbeat();
      if (assistantRefreshTimer) clearInterval(assistantRefreshTimer);
      assistantRefreshTimer = setInterval(() => {
        void refreshAssistant().catch((error) => showAlert(error.message, true));
      }, 15_000);
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (event.target.closest('#assistant-close')) {
    $('#assistant-dialog').close();
    return;
  }
  if (event.target === $('#workspace-more-dialog')) {
    $('#workspace-more-dialog').close();
    return;
  }
  if (event.target.closest('[data-close-workspace-more]')) {
    $('#workspace-more-dialog').close();
    return;
  }
  const workspaceLink = event.target.closest('.workspace-nav-link[data-panel]');
  if (workspaceLink) {
    if ($('#workspace-more-dialog').open) $('#workspace-more-dialog').close();
    navigateToPanel(workspaceLink.dataset.panel);
    return;
  }
  if (event.target.closest('#mobile-workspace-more')) {
    const moreButton = $('#mobile-workspace-more');
    $('#workspace-more-dialog').showModal();
    moreButton.setAttribute('aria-expanded', 'true');
    return;
  }
  const tab = event.target.closest('.tab[data-panel]');
  if (tab) { navigateToPanel(tab.dataset.panel); return; }
  const action = event.target.closest('button[data-action]');
  if (!action || action.type === 'submit') return;
  const { action: name, id } = action.dataset;
  if (name === 'property-agent-scope-status') {
    const reason = window.prompt(t(`Explain why this assignment is being ${action.dataset.status} (minimum 10 characters).`));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/property/tenant-systems/${encodeURIComponent(state.propertyTenantContextId)}/agent-scopes/${encodeURIComponent(action.dataset.propertyId)}/${encodeURIComponent(action.dataset.userId)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: action.dataset.status, reason: reason.trim() }),
      });
      await refresh();
      showAlert(t('Property agent assignment updated.'));
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'property-tenant-support-refresh') {
    try {
      state.propertyTenantSupportGrants = await api('/property/tenant-support-grants/mine');
      if (state.propertyTenantSupportGrantId
        && !state.propertyTenantSupportGrants.some((grant) => grant.id === state.propertyTenantSupportGrantId)) {
        state.propertyTenantSupportGrantId = null;
        state.propertyTenantContextId = null;
        localStorage.removeItem(PROPERTY_TENANT_SUPPORT_GRANT_KEY);
        localStorage.removeItem(PROPERTY_TENANT_KEY);
      }
      renderPropertyTenantContext();
      await refresh();
      showAlert(t('Approved property support grants refreshed.'));
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'property-tenant-support-decision') {
    const approve = action.dataset.decision === 'approve';
    const reason = window.prompt(t(approve
      ? 'Enter the independent approval reason (minimum 10 characters).'
      : 'Enter the rejection reason (minimum 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/property/tenant-support-grants/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ approve, reason: reason.trim() }),
      });
      await refresh();
      showAlert(t(approve ? 'Property support grant approved.' : 'Property support grant rejected.'));
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'property-tenant-support-revoke') {
    const reason = window.prompt(t('Explain why support access is being revoked (minimum 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/property/tenant-support-grants/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      state.propertyTenantSupportGrants = state.propertyTenantSupportGrants.filter((grant) => grant.id !== id);
      if (state.propertyTenantSupportGrantId === id) {
        state.propertyTenantSupportGrantId = null;
        localStorage.removeItem(PROPERTY_TENANT_SUPPORT_GRANT_KEY);
        state.propertyTenantContextId = null;
        localStorage.removeItem(PROPERTY_TENANT_KEY);
      }
      await refresh();
      showAlert(t('Property support access revoked.'));
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'access-mode-choice') {
    await switchAccessMode(action.dataset.role);
    return;
  }
  if (name === 'mfa-setup') {
    api('/auth/mfa/setup', { method: 'POST', body: '{}' })
      .then((result) => { state.mfaSetup = result; renderPanel(); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'workforce-payable-next-batch') {
    try {
      const result = await api('/workforce/payable-time/calculate', {
        method: 'POST',
        body: JSON.stringify({
          period_start: action.dataset.periodStart,
          period_end: action.dataset.periodEnd,
        }),
      });
      state.workforcePayableCalculation = { ...result, requestedBy: state.user.id };
      await refresh();
      const warningCount = result.calculated.filter((entry) => entry.policy_warnings.length).length;
      showAlert(result.has_more
        ? t('More attendance rows remain in this period. Continue with the next batch.')
        : t('Calculated payable time for {{count}} attendance records. {{warnings}} have warning thresholds to review.', {
          count: result.calculated.length, warnings: warningCount,
        }));
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-payroll-next-batch') {
    try {
      const result = await api('/workforce/payroll-exports', {
        method: 'POST',
        body: JSON.stringify({
          period_start: action.dataset.periodStart,
          period_end: action.dataset.periodEnd,
          mapping_version: action.dataset.mappingVersion,
        }),
      });
      state.workforcePayrollExportBatch = { ...result, requestedBy: state.user.id };
      await refresh();
      showAlert(result.has_more
        ? t('More payable rows remain in this period. Continue with the next encrypted export.')
        : t('Encrypted payroll export generated. It has not been filed or paid.'));
    } catch (error) { showAlert(error.message, true); }
  }
  if (name === 'worker-report-export') {
    const reports = filterWorkerActivityReports(state.workerPortalReports, state.workerReportFilters);
    const csv = workerActivityReportsCsv(reports, state.workerPortalEngagements);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `worker-activity-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    showAlert(reports.length ? 'Worker activity report downloaded.' : 'There are no reports matching these filters to download.');
    return;
  }
  if (name === 'tenant-access-invite') {
    try {
      const invitation = await api(`/leases/${encodeURIComponent(id)}/tenant-access-invitations`, {
        method: 'POST', body: '{}',
      });
      window.prompt(
        'Deliver this one-time resident access code only through a separately verified contact channel. AfroLife does not send the code.',
        invitation.claim_code,
      );
      await refresh();
      showAlert('One-time tenant access code issued. The code was displayed once and expires in seven days.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'tenant-access-revoke') {
    const reason = window.prompt('Explain why resident portal access is being revoked (at least 10 characters).');
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/leases/${encodeURIComponent(id)}/tenant-access-links/${encodeURIComponent(action.dataset.linkId)}/revoke`, {
        method: 'POST', body: JSON.stringify({ reason: reason.trim() }),
      });
      await refresh();
      showAlert('Resident portal access revoked.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'resident-lease-document') {
    try {
      await downloadAuthenticatedFile(`/lease-signature-documents/${encodeURIComponent(id)}/file`, `afrolife-lease-evidence-${id}`);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'resident-move-out-evidence') {
    try {
      await downloadAuthenticatedFile(`/lease-move-out-evidence/${encodeURIComponent(id)}/file`, `afrolife-move-out-evidence-${id}`);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'resident-maintenance-evidence') {
    try {
      await downloadAuthenticatedFile(`/maintenance/evidence/${encodeURIComponent(id)}/file`, `afrolife-maintenance-evidence-${id}`);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'support-open-case') {
    try {
      state.supportCaseDetail = await api(`/support/cases/${encodeURIComponent(id)}`);
      state.supportCaseEvents = await api(`/support/cases/${encodeURIComponent(id)}/events`);
      window.clearTimeout(supportAccessExpiryTimer);
      if (state.supportCaseDetail.user_id!==state.user.id
        && state.supportCaseDetail.sensitive_access_expires_at) {
        const expiresAt=Date.parse(state.supportCaseDetail.sensitive_access_expires_at);
        supportAccessExpiryTimer=window.setTimeout(()=>{
          state.supportCaseDetail=null;
          state.supportCaseEvents=[];
          if (state.panel==='support') renderPanel();
        },Math.max(0,expiresAt-Date.now()));
      }
      renderPanel();
    } catch (error) { showAlert(error.message,true); }
    return;
  }
  if (name === 'support-access-request') {
    const reason=window.prompt(t('Explain why you need temporary access to this case (at least 10 characters).'));
    if (!reason||reason.trim().length<10) return;
    try {
      await api(`/support/cases/${encodeURIComponent(id)}/access-requests`,{
        method:'POST',body:JSON.stringify({reason:reason.trim()}),
      });
      await refresh();
      showAlert('Sensitive access request submitted for independent approval.');
    } catch (error) { showAlert(error.message,true); }
    return;
  }
  if (name === 'support-access-decision') {
    const reason=window.prompt(t('Record the approval or denial reason (at least 10 characters).'));
    if (!reason||reason.trim().length<10) return;
    try {
      await api(`/support/access-requests/${encodeURIComponent(id)}/decision`,{
        method:'POST',body:JSON.stringify({decision:action.dataset.decision,reason:reason.trim()}),
      });
      await refresh();
      showAlert(action.dataset.decision==='approve'
        ? 'Sensitive access approved for 15 minutes.' : 'Sensitive access denied.');
    } catch (error) { showAlert(error.message,true); }
    return;
  }
  if (name === 'support-case-status') {
    const reason=window.prompt(t('Record why this support case status is changing (at least 10 characters).'));
    if (!reason||reason.trim().length<10) return;
    try {
      await api(`/support/cases/${encodeURIComponent(id)}/status`,{
        method:'PATCH',body:JSON.stringify({status:action.dataset.status,reason:reason.trim()}),
      });
      state.supportCaseDetail=null;
      await refresh();
      showAlert('Support case status updated and the user was notified.');
    } catch (error) { showAlert(error.message,true); }
    return;
  }
  if (name === 'support-appeal') {
    const reason=window.prompt(t('Explain why you are appealing this resolution (at least 10 characters).'));
    if (!reason||reason.trim().length<10) return;
    try {
      await api(`/support/cases/${encodeURIComponent(id)}/appeal`,{
        method:'POST',body:JSON.stringify({reason:reason.trim()}),
      });
      await refresh();
      showAlert('Your appeal has been recorded.');
    } catch (error) { showAlert(error.message,true); }
    return;
  }
  if (name === 'workforce-clock') {
    try {
      const queue = readWorkerClockQueue();
      if (state.workerClockQueueError) throw new Error(state.workerClockQueueError);
      const eventType = action.dataset.eventType;
      const priorForShift = queue.filter((entry) => entry.shift_id === id);
      if (priorForShift.some((entry) => entry.event_type === eventType)) {
        throw new Error(`A ${eventType.replace('_',' ')} event for this shift is already queued.`);
      }
      const shift = state.workerPortalShifts.find((entry) => entry.id === id);
      const hasClockIn = Boolean(shift?.clock_in_at)
        || priorForShift.some((entry) => entry.event_type === 'clock_in');
      if (eventType === 'clock_out' && !hasClockIn) throw new Error('Clock in before recording a clock-out event.');
      queue.push({
        shift_id: id,
        event_type: eventType,
        client_event_id: crypto.randomUUID(),
        occurred_at: new Date().toISOString(),
        source: navigator.onLine ? 'online' : 'offline',
      });
      localStorage.setItem(workerClockQueueKey(), JSON.stringify(queue));
      if (navigator.onLine) {
        await syncWorkerClockQueue();
        await refresh();
      } else {
        renderPanel();
      }
      const remaining = readWorkerClockQueue().length;
      showAlert(remaining
        ? `Clock event saved on this device and awaiting sync. ${remaining} event${remaining === 1 ? '' : 's'} remain in the queue.`
        : 'Clock event recorded.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'workforce-shift-response') {
    const reason = window.prompt(t('Enter a short reason for your response (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/workforce/shifts/${encodeURIComponent(id)}/response`, {
        method: 'POST',
        body: JSON.stringify({ response: action.dataset.response, reason: reason.trim() }),
      });
      await refresh();
      showAlert(action.dataset.response === 'accepted' ? 'Shift accepted.' : 'Shift declined.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-leave-withdraw') {
    try {
      await api(`/workforce/leave/${encodeURIComponent(id)}/withdraw`, { method: 'POST', body: '{}' });
      await refresh();
      showAlert('Leave or availability request withdrawn.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-shift-cancel') {
    const reason = window.prompt(t('Enter why this shift is being cancelled (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/workforce/shifts/${encodeURIComponent(id)}/cancel`, {
        method: 'POST', body: JSON.stringify({ reason: reason.trim() }),
      });
      await refresh();
      showAlert('Shift cancelled.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-correction-decision' || name === 'workforce-time-approve'
    || name === 'workforce-leave-decision' || name === 'workforce-policy-approve') {
    const approving = action.dataset.decision === 'approve' || name === 'workforce-time-approve' || name === 'workforce-policy-approve';
    const reason = window.prompt(t(approving
      ? 'Enter the approval evidence or reason (at least 10 characters).'
      : 'Explain why this request is being rejected (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    const endpoint = name === 'workforce-correction-decision'
      ? `/workforce/corrections/${encodeURIComponent(id)}/decision`
      : name === 'workforce-time-approve'
        ? `/workforce/shifts/${encodeURIComponent(id)}/approve-time`
        : name === 'workforce-leave-decision'
          ? `/workforce/leave/${encodeURIComponent(id)}/decision`
          : `/workforce/policies/${encodeURIComponent(id)}/approve`;
    const body = name === 'workforce-policy-approve'
      ? { evidence: reason.trim() }
      : name === 'workforce-correction-decision' || name === 'workforce-leave-decision'
        ? { decision: action.dataset.decision, reason: reason.trim() }
        : { reason: reason.trim() };
    try {
      await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      await refresh();
      showAlert(approving ? 'Workforce review approved.' : 'Workforce request rejected.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-payroll-download') {
    try {
      await downloadAuthenticatedFile(
        `/workforce/payroll-exports/${encodeURIComponent(id)}/file`,
        `workforce-payroll-${id}.enc.json`,
      );
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-payroll-items') {
    try {
      const result = await api(`/workforce/payroll-exports/${encodeURIComponent(id)}/items`);
      const item = document.querySelector(`[data-payroll-export="${CSS.escape(id)}"]`);
      if (!item) return;
      item.querySelector('[data-payroll-row-review]')?.remove();
      const review = node('section', undefined, 'panel');
      review.dataset.payrollRowReview = 'true';
      review.append(node('h4', 'Payroll export rows'));
      const rows = node('div', undefined, 'list');
      for (const row of result.rows) {
        const label = node('label', undefined, 'form-label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.failedPayrollRow = String(row.row_number);
        checkbox.disabled = row.already_requeued || (result.status !== 'handed_off' && result.status !== 'handoff_failed');
        label.append(checkbox, document.createTextNode(t(
          'Row {{number}} · {{worker}} · {{start}} · {{minutes}} minutes',
          {
            number: row.row_number,
            worker: row.worker_name,
            start: new Date(row.shift_start).toLocaleString(document.documentElement.lang),
            minutes: row.payable_minutes,
          },
        )));
        if (row.already_requeued) label.append(node('span', t('Already requeued'), 'muted'));
        rows.append(label);
      }
      review.append(rows);
      item.append(review);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-payroll-requeue-failed-rows') {
    const item = document.querySelector(`[data-payroll-export="${CSS.escape(id)}"]`);
    const failedRowNumbers = [...(item?.querySelectorAll('input[data-failed-payroll-row]:checked') ?? [])]
      .map((checkbox) => Number(checkbox.dataset.failedPayrollRow));
    if (!failedRowNumbers.length) {
      showAlert(t('Select at least one failed row to create a retry export.'), true);
      return;
    }
    const reason = window.prompt(t('Enter why the external payroll system rejected these rows (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    const externalReference = window.prompt(t('Enter the external rejection reference, or leave blank.'));
    if (externalReference === null) return;
    const normalizedExternalReference = externalReference.trim();
    if (normalizedExternalReference && normalizedExternalReference.length < 3) {
      showAlert(t('External rejection reference must be at least 3 characters.'), true);
      return;
    }
    const requestFingerprint = JSON.stringify({
      failedRowNumbers: [...failedRowNumbers].sort((a, b) => a - b),
      reason: reason.trim(),
      externalReference: normalizedExternalReference || null,
    });
    if (action.dataset.requestFingerprint !== requestFingerprint) {
      action.dataset.requestFingerprint = requestFingerprint;
      action.dataset.idempotencyKey = window.crypto.randomUUID();
    }
    try {
      await api(`/workforce/payroll-exports/${encodeURIComponent(id)}/requeue-failed`, {
        method: 'POST',
        body: JSON.stringify({
          failed_row_numbers: failedRowNumbers,
          idempotency_key: action.dataset.idempotencyKey,
          reason: reason.trim(),
          external_reference: normalizedExternalReference || undefined,
        }),
      });
      await refresh();
      showAlert('A retry export was created for only the selected failed rows. The export has not been filed or paid.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-payroll-events') {
    try {
      const events = await api(`/workforce/payroll-exports/${encodeURIComponent(id)}/events`);
      const item = document.querySelector(`[data-payroll-export="${CSS.escape(id)}"]`);
      if (!item) return;
      item.querySelector('[data-payroll-event-history]')?.remove();
      const history = node('div', undefined, 'list');
      history.dataset.payrollEventHistory = 'true';
      history.append(node('h4', 'Handoff history'));
      if (!events.length) history.append(empty('No handoff events are recorded for this export.'));
      for (const entry of events) {
        history.append(card(entry.event_type.replaceAll('_', ' '),
          `${new Date(entry.created_at).toLocaleString(document.documentElement.lang)} · actor ${entry.actor_id}${entry.external_reference ? ` · reference ${entry.external_reference}` : ''}`,
          entry.event_type));
        history.lastElementChild.append(node('p', entry.reason));
      }
      item.append(history);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-payroll-handoff') {
    const result = window.prompt(t('Enter handed_off or handoff_failed. This records handoff status only.'), 'handed_off');
    if (!['handed_off','handoff_failed'].includes(result)) return;
    const reason = window.prompt(t('Enter the external status or failure details (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    const reference = result === 'handed_off'
      ? window.prompt(t('Enter the external payroll provider handoff reference (at least 3 characters).'))
      : undefined;
    if (result === 'handed_off' && (!reference || reference.trim().length < 3)) return;
    try {
      await api(`/workforce/payroll-exports/${encodeURIComponent(id)}/handoff`, {
        method: 'POST',
        body: JSON.stringify({ result, reason: reason.trim(), ...(reference ? { reference: reference.trim() } : {}) }),
      });
      await refresh();
      showAlert('Payroll export handoff status recorded. This does not confirm filing or payment.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'workforce-worker-offboard') {
    if (!window.confirm(t('Offboard this worker, close active engagements, cancel eligible future shifts and revoke worker sessions?'))) return;
    const reason = window.prompt(t('Enter the offboarding reason (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/workforce/workers/${encodeURIComponent(id)}/offboard`, {
        method: 'POST', body: JSON.stringify({ reason: reason.trim() }),
      });
      await refresh();
      showAlert('Worker offboarded and active sessions revoked.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'load-more-maintenance') {
    if (state.maintenanceLoadingMore) return;
    state.maintenanceLoadingMore = true;
    action.disabled = true;
    action.textContent = 'Loading more requests…';
    try {
      const page = await api(`/maintenance?offset=${state.maintenanceRequests.length}`);
      const loaded = new Map(state.maintenanceRequests.map((request) => [request.id, request]));
      for (const request of page.slice(0, 200)) loaded.set(request.id, request);
      state.maintenanceRequests = [...loaded.values()];
      state.maintenanceHasMore = page.length > 200 && state.maintenanceRequests.length < 100000;
      state.maintenanceLoadingMore = false;
      renderPanel();
    } catch (error) {
      state.maintenanceLoadingMore = false;
      action.disabled = false;
      action.textContent = 'Load 200 older requests';
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'tenant-admin-remove') {
    if (!window.confirm(t('Remove this Super Admin from the tenant? Their deployment access will end immediately.'))) return;
    try {
      await api(`/platform/tenants/${encodeURIComponent(action.dataset.tenantId)}/admins/${encodeURIComponent(action.dataset.userId)}`, { method: 'DELETE' });
      await refresh();
      showAlert('Tenant Super Admin assignment removed.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'subscription-review-refresh') {
    await loadSubscriptionReview();
    return;
  }
  if (name === 'subscription-review') {
    const reason = window.prompt(t(action.dataset.decision === 'confirm'
      ? 'Enter the payment confirmation reason (minimum 10 characters).'
      : 'Enter the rejection reason (minimum 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    action.disabled = true;
    try {
      const result = await api(`/subscriptions/review/${encodeURIComponent(id)}`, {
        method: 'POST',
        body: JSON.stringify({ decision: action.dataset.decision, reason: reason.trim() }),
      });
      await Promise.all([loadSubscriptionReview(), loadMySubscriptions()]);
      showAlert(result?.request?.status === 'accounting_pending'
        ? 'Payment confirmed. Service activation will begin after Accounting records the transaction.'
        : 'Subscription payment decision recorded.');
    } catch (error) {
      showAlert(error.message, true);
    } finally {
      if (action.isConnected) action.disabled = false;
    }
    return;
  }
  if (name === 'owner-statement-download') {
    try {
      const response = await fetch(`${apiRoot()}/owner/statements?format=csv`, {
        headers: { authorization: ['Bearer', sessionStorage.getItem(TOKEN_KEY)].join(' ') },
      });
      if (!response.ok) throw new Error(`Owner statement download failed (${response.status}).`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'owner-rent-statement.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'coa-template-download') {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state.propertyAccountingTemplate, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'property-chart-of-accounts-draft.json';
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (name === 'service-identity-retire') {
    const evidence = window.prompt(t('Enter retirement evidence (minimum 10 characters).'));
    if (!evidence || evidence.trim().length < 10) return;
    try {
      await api(`/service-identities/${id}/retire`, { method: 'POST', body: JSON.stringify({ evidence: evidence.trim() }) });
      await refresh();
      showAlert('Inventory marked retired. Revoke the credential in the external secret manager separately.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'service-identity-events') {
    try {
      const events = await api(`/service-identities/${id}/events`);
      const container = action.closest('.list-card');
      container.querySelector('.service-identity-events')?.remove();
      const evidence = node('div', undefined, 'service-identity-events');
      evidence.append(node('h4', 'Lifecycle evidence'));
      if (!events.length) evidence.append(empty('No lifecycle evidence is recorded.'));
      for (const entry of events) evidence.append(node('p', `${entry.action} · ${entry.created_at} · ${entry.actor_id} · ${entry.evidence}`));
      container.append(evidence);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'open-panel') {
    navigateToPanel(action.dataset.panel);
    return;
  }
  const container = action.closest('.list-card');
  if (name === 'learning-edit') {
    const existing = container.querySelector('.learning-content-form');
    if (existing) { existing.remove(); return; }
    const content = state.learningContent.find((entry) => entry.id === id);
    if (content) container.append(createLearningForm(content));
    return;
  }
  if (name === 'learning-archive') {
    if (!window.confirm(t('Archive this training item? It will no longer appear to audiences.'))) return;
    try {
      await api(`/learning/content/${id}`, { method: 'DELETE' });
      await refresh();
      showAlert('Training content archived.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'commission-approve' || name === 'commission-pay' || name === 'commission-release-held') {
    const endpoint = name === 'commission-approve' ? 'approve' : name === 'commission-pay' ? 'pay' : 'release-held';
    const reference = name === 'commission-approve' ? null : window.prompt(t('Enter the payment reference.'));
    if (name !== 'commission-approve' && (!reference || reference.trim().length < 3)) return;
    try {
      await api(`/commissions/${id}/${endpoint}`, { method: 'POST', body: JSON.stringify(reference ? { reference: reference.trim() } : {}) });
      await refresh();
      showAlert(name === 'commission-approve' ? 'Commission approved.' : name === 'commission-pay' ? 'Commission installment paid.' : 'Commission holdback released.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'global-promotion-approve' || name === 'global-promotion-reject') {
    const decision = name === 'global-promotion-approve' ? 'approve' : 'reject';
    const prompt = decision === 'approve'
      ? 'Enter the approval reason (at least 10 characters).'
      : 'Enter the rejection reason (at least 10 characters).';
    const reason = window.prompt(t(prompt));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/global-admin-promotions/${id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await refresh();
      showAlert(decision === 'approve' ? 'Global Admin promotion approved.' : 'Global Admin promotion rejected.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'lead-attribution-history') {
    const existing = container.querySelector('.lead-attribution-events');
    if (existing) { existing.remove(); return; }
    const history = node('div', undefined, 'lead-attribution-events list');
    container.append(history);
    try {
      const events = await api(`/leads/${id}/attribution-history`);
      if (!events.length) history.append(empty('No attribution history is available.'));
      for (const item of events) {
        const label = item.event_type === 'created' ? 'Lead created' : 'Lead reassigned';
        history.append(card(label, `${item.prior_agent_id ? `${item.prior_agent_id} → ` : ''}${item.new_agent_id} · by ${item.actor_id} · ${new Date(item.created_at).toLocaleString(document.documentElement.lang)}${item.reason ? ` · ${item.reason}` : ''}`, item.event_type));
      }
    } catch (error) {
      history.append(empty(error.message));
    }
    return;
  }
  if (name === 'lead-status') {
    const status = action.dataset.status;
    const reason = window.prompt(t(status === 'lost'
      ? 'Explain why this lead is being marked lost (at least 10 characters).'
      : 'Record why this lead is qualified (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason: reason.trim() }),
      });
      await refresh();
      showAlert(status === 'lost' ? 'Lead marked as lost.' : 'Lead qualified.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'contract-document-upload') {
    const file = container.querySelector('input[type="file"]')?.files?.[0];
    if (!file) { showAlert('Choose a signed contract document first.', true); return; }
    if (file.size > 10 * 1024 * 1024) { showAlert('The contract document must be 10 MB or smaller.', true); return; }
    try {
      await api(`/contracts/${id}/documents?stage=${encodeURIComponent(action.dataset.stage)}`, { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
      await refresh(); showAlert(action.dataset.stage === 'party_signed' ? 'Party-signed contract uploaded for company countersignature.' : 'Company-countersigned contract uploaded. Review it, then complete the signature step.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'contract-document-download') {
    try {
      const response = await fetch(`${apiRoot()}/contract-documents/${id}/file`, { headers: { authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` } });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? 'Document download failed.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'afrolife-signed-contract'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'agent-specialization') {
    const select = container.querySelector(`[data-agent-specialization="${CSS.escape(id)}"]`);
    try {
      await api(`/agents/${id}/specialization`, { method: 'PATCH', body: JSON.stringify({ service_specialization: select.value || null }) });
      await refresh(); showAlert('Agent service assignment updated.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'contract-step') {
    const step = action.dataset.step;
    const body = { action: step };
    if (step === 'cancel' || step === 'reject') {
      const reason = window.prompt(t('Enter a reason (at least 10 characters).'));
      if (!reason || reason.trim().length < 10) return;
      body.reason = reason.trim();
    }
    if (step === 'record_payment') {
      const contract = state.contracts.find((item) => item.id === id);
      const amount = ['onboarding_amt', 'guarantee_amt', 'monthly_mgmt_amt', 'employer_fee_amt', 'other_fee_amt'].reduce((sum, key) => sum + Number(contract?.[key] ?? 0), 0);
      const reference = window.prompt(t('Enter the payment reference.'));
      if (!reference || reference.trim().length < 3) return;
      Object.assign(body, { channel: 'manual', reference: reference.trim(), amount });
    }
    api(`/contracts/${id}/transition`, { method: 'POST', body: JSON.stringify(body) })
      .then(async () => { await refresh(); showAlert('Contract workflow updated.'); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'rent-reconcile') {
    api(`/rent-transactions/${id}/reconcile`, { method: 'POST', body: '{}' })
      .then(async () => { await refresh(); showAlert('Rent transaction reconciled and posted to the ledger.'); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'rent-void') {
    const reason = window.prompt(t('Enter why this pending receipt should be voided (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    api(`/rent-transactions/${id}/void`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) })
      .then(async () => { await refresh(); showAlert('Pending rent transaction voided.'); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'lease-submit-approval' || name === 'lease-approve') {
    const reason = window.prompt(t('Enter the reason (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    const path = name === 'lease-submit-approval'
      ? `/leases/${id}/submit-for-approval`
      : `/leases/${id}/approve`;
    api(path, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) })
      .then(async () => {
        await refresh();
        showAlert(name === 'lease-submit-approval' ? 'Lease submitted for independent approval.' : 'Lease approved. Signature evidence is now required.');
      })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'lease-renewal-offer' || name === 'lease-renewal-reject') {
    const reason = window.prompt(name === 'lease-renewal-offer'
      ? t('Enter the independent approval reason (at least 10 characters).')
      : t('Enter the reason for rejecting this renewal offer (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    const decision = name === 'lease-renewal-offer' ? 'offer' : 'reject';
    api(`/leases/${encodeURIComponent(action.dataset.leaseId)}/renewal-offers/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason: reason.trim() }),
    })
      .then(async () => {
        await refresh();
        showAlert(decision === 'offer' ? 'Renewal offer sent to linked resident accounts.' : 'Renewal offer rejected.');
      })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'lease-renewal-convert') {
    const reason = window.prompt(t('Enter why the accepted offer is being converted into a new lease draft (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    api(`/leases/renewal-offers/${encodeURIComponent(id)}/convert`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() }),
    })
      .then(async () => {
        await refresh();
        showAlert('Renewal lease draft created. It must complete the normal approval, signature, and handover steps.');
      })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'renewal-response-accept' || name === 'renewal-response-decline') {
    const responseNote = name === 'renewal-response-decline'
      ? window.prompt(t('Enter a reason for declining (at least 10 characters).'))
      : window.prompt(t('Optional note for the property manager.'), '');
    if (name === 'renewal-response-decline' && (!responseNote || responseNote.trim().length < 10)) return;
    const response = { decision: name === 'renewal-response-accept' ? 'accept' : 'decline' };
    if (responseNote?.trim()) response.response_note = responseNote.trim();
    api(`/resident/leases/${encodeURIComponent(action.dataset.leaseId)}/renewal-offers/${encodeURIComponent(id)}/respond`, {
      method: 'POST',
      body: JSON.stringify(response),
    })
      .then(async (result) => {
        await refresh();
        showAlert(result.renewal_lease_draft_required
          ? 'Renewal accepted. The property manager will prepare a separate lease draft for approval and signature.'
          : 'Renewal response recorded.');
      })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'lease-execute') {
    const lease = state.leases.find((item) => item.id === id);
    if (!lease) return;
    const reason = window.prompt(t('Enter the execution reason (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    const handoverDate = window.prompt(t('Enter the possession handover date (YYYY-MM-DD).'), lease.start_date);
    if (!handoverDate || !/^\d{4}-\d{2}-\d{2}$/.test(handoverDate)) return;
    if (!window.confirm(t('Confirm that the move-in inspection is complete and the handover date is correct.'))) return;
    api(`/leases/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        reason: reason.trim(),
        handover_date: handoverDate,
        move_in_inspection_completed: true,
      }),
    })
      .then(async () => {
        await refresh();
        showAlert('Lease activated and rent schedule created. Uploaded signature files are retained as evidence only.');
      })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'lease-end') {
    if (!window.confirm(t('End this lease using its independently reviewed move-out inspection? Future rent charges will be waived.'))) return;
    const reason = window.prompt(t('Enter the lease closeout reason (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    api(`/leases/${id}/end`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) })
      .then(async () => { await refresh(); showAlert('Lease ended after reviewed move-out; future rent charges were waived.'); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'move-out-submit') {
    const actualVacatedOn = window.prompt(t('Enter the actual move-out date (YYYY-MM-DD).'), new Date().toISOString().slice(0, 10));
    if (!actualVacatedOn) return;
    const inspectedOn = window.prompt(t('Enter the inspection date (YYYY-MM-DD).'), new Date().toISOString().slice(0, 10));
    if (!inspectedOn) return;
    const conditionNotes = window.prompt(t('Describe the property condition and any observed damage (at least 10 characters).'));
    if (!conditionNotes || conditionNotes.trim().length < 10) return;
    const keysReturned = window.prompt(t('Were all keys returned? Enter yes or no.'));
    if (!keysReturned || !['yes', 'no'].includes(keysReturned.trim().toLowerCase())) return;
    const deduction = window.prompt(t('Proposed deposit deduction in ETB (use up to two decimals).'), '0');
    if (deduction === null) return;
    const deductionReason = Number(deduction) > 0
      ? window.prompt(t('Explain the proposed deposit deduction (at least 10 characters).'))
      : undefined;
    if (Number(deduction) > 0 && (!deductionReason || deductionReason.trim().length < 10)) return;
    try {
      await api(`/leases/${encodeURIComponent(id)}/move-out-inspections`, {
        method: 'POST',
        body: JSON.stringify({
          actual_vacated_on: actualVacatedOn,
          inspected_on: inspectedOn,
          condition_notes: conditionNotes.trim(),
          keys_returned: keysReturned.trim().toLowerCase() === 'yes',
          deposit_deduction: deduction.trim(),
          ...(deductionReason ? { deduction_reason: deductionReason.trim() } : {}),
        }),
      });
      await refresh();
      showAlert('Move-out inspection submitted for independent review. The lease remains active until reviewed closeout.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'move-out-approve' || name === 'move-out-reject') {
    const reason = window.prompt(t('Enter the independent inspection review reason (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/leases/${encodeURIComponent(action.dataset.leaseId)}/move-out-inspections/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: name === 'move-out-approve' ? 'approve' : 'reject', reason: reason.trim() }),
      });
      await refresh();
      showAlert(name === 'move-out-approve'
        ? 'Move-out inspection and deposit disposition approved.'
        : 'Move-out inspection rejected. The manager may submit a corrected revision.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'move-out-evidence-upload') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/jpeg,image/png';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showAlert(t('Move-out evidence must be 10 MB or smaller.'), true);
        return;
      }
      try {
        await api(`/leases/${encodeURIComponent(action.dataset.leaseId)}/move-out-inspections/${encodeURIComponent(id)}/evidence`, {
          method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file,
        });
        await refresh();
        showAlert('Move-out evidence uploaded to private storage.');
      } catch (error) { showAlert(error.message, true); }
    }, { once: true });
    input.click();
    return;
  }
  if (name === 'deposit-pay') {
    const reference = window.prompt(t('Enter the deposit payment reference.'));
    if (!reference || reference.trim().length < 3) return;
    api(`/leases/${id}/deposit/pay`, { method: 'POST', body: JSON.stringify({ reference: reference.trim(), channel: 'manual' }) })
      .then(async () => { await refresh(); showAlert('Deposit receipt recorded and awaiting independent reconciliation.'); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'deposit-refund') {
    const amount = window.prompt(t('Enter the deposit return amount in ETB.'));
    if (!amount) return;
    const reason = window.prompt(t('Enter a reason for the deposit return.'));
    if (!reason || reason.trim().length < 10) return;
    const reference = window.prompt(t('Enter the payout reference.'));
    if (!reference || reference.trim().length < 3) return;
    api(`/leases/${id}/deposit/refund`, { method: 'POST', body: JSON.stringify({ amount: amount.trim(), reason: reason.trim(), reference: reference.trim(), channel: 'manual' }) })
      .then(async () => { await refresh(); showAlert('Deposit return recorded and awaiting independent reconciliation.'); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'rent-record') {
    const reference = window.prompt(t('Enter the rent payment reference.'));
    if (!reference || reference.trim().length < 3) return;
    api(`/charges/${id}/pay`, { method: 'POST', body: JSON.stringify({ reference: reference.trim(), channel: 'manual' }) })
      .then(async () => { await refresh(); showAlert('Rent payment recorded and awaiting independent reconciliation.'); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'lease-payments') {
    const target = action.closest('.list-card');
    try {
      const [charges, payments] = await Promise.all([api(`/leases/${id}/charges`), api(`/leases/${id}/payments`)]);
      const details = node('section', undefined, 'panel form-card');
      details.append(node('h3', 'Charges and receipts'));
      for (const charge of charges) {
        const row = card(charge.period, t('Due {{due}} · ETB {{amount}}', { due: charge.due_on, amount: Number(charge.amount).toLocaleString(document.documentElement.lang) }), charge.status);
        if (['master_agent', 'field_agent', 'finance', 'finance_manager', 'global_admin', 'super_admin'].includes(state.user.role) && ['due', 'overdue'].includes(charge.status)) row.append(button('Record rent payment', 'rent-record', 'button button-outline', { id: charge.id }));
        details.append(row);
      }
      for (const payment of payments) {
        const row = card(t(payment.kind), `${payment.reference} · ETB ${Number(payment.amount).toLocaleString(document.documentElement.lang)}`, payment.status);
        if (payment.status === 'pending' && ['finance_manager', 'global_admin', 'super_admin'].includes(state.user.role)) {
          row.append(button('Reconcile', 'rent-reconcile', 'button button-outline', { id: payment.id }));
          row.append(button('Void receipt', 'rent-void', 'button button-outline', { id: payment.id }));
        }
        details.append(row);
      }
      target.append(details);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'revoke-session') {
    const session = state.authSessions.find((entry) => entry.id === id);
    if (!session) return;
    if (!window.confirm(t(session.current ? 'Sign out from this session?' : 'End this session?'))) return;
    try {
      await api(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (session.current) {
        signOut({ revoke: false, message: 'This session has been signed out.' });
        return;
      }
      state.authSessions = state.authSessions.map((entry) => entry.id === id
        ? { ...entry, active: false, revoked_at: new Date().toISOString() }
        : entry);
      renderPanel();
      showAlert('Session ended.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'worker-upload') { showDocumentUpload(id, container); return; }
  if (name === 'worker-documents') { void showWorkerDocuments(id, container); return; }
  if (name === 'property-photos') { void showPropertyPhotos(id, container); return; }
  if (name === 'property-units') { showPropertyUnitForm(id, container); return; }
  if (name === 'property-turnover-complete') {
    const completionNote = window.prompt(t('Describe the completed cleaning, repairs, and readiness checks (at least 10 characters).'));
    if (!completionNote || completionNote.trim().length < 10) return;
    try {
      await api(`/properties/${encodeURIComponent(id)}/units/${encodeURIComponent(action.dataset.unit)}/turnover-complete`, {
        method: 'POST',
        body: JSON.stringify({ completion_note: completionNote.trim() }),
      });
      await refresh();
      showAlert('Unit turnover completed. The unit is now available for rental workflows.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'property-upload') { showPropertyUpload(id, container); return; }
  if(name==='marketplace-media'){
    try{const response=await fetch(`${apiRoot()}/marketplace/media/${id}/file`,{headers:{authorization:`Bearer ${sessionStorage.getItem(TOKEN_KEY)}`}});if(!response.ok)throw new Error(`Media unavailable (${response.status})`);const blob=await response.blob();const url=URL.createObjectURL(blob);propertyPhotoUrls.add(url);const viewer=node('div',undefined,'marketplace-viewer');let media;if(action.dataset.mime?.startsWith('video/')){media=node('video');media.controls=true;media.autoplay=false;media.playsInline=true;}else{media=node('img');media.alt=t('Marketplace listing photo');}media.src=url;viewer.append(media);container.append(viewer);}catch(error){showAlert(error.message,true);}return;
  }
  if(name==='marketplace-submit'){try{await api(`/marketplace/listings/${id}/submit`,{method:'POST',body:'{}'});await refresh();showAlert('Listing submitted.');}catch(error){showAlert(error.message,true);}return;}
  if(name==='marketplace-review'){
    let note;if(action.dataset.decision==='reject'){note=window.prompt(t('Explain what the seller needs to change (at least 10 characters).'));if(!note||note.trim().length<10)return;}
    try{await api(`/marketplace/listings/${id}/review`,{method:'PATCH',body:JSON.stringify({decision:action.dataset.decision,...(note?{note:note.trim()}:{})})});await refresh();showAlert(action.dataset.decision==='publish'?'Listing published.':'Listing returned for changes.');}catch(error){showAlert(error.message,true);}return;
  }
  if (name === 'property-review') {
    let note;
    if (action.dataset.decision === 'reject') {
      note = window.prompt(t('Explain what needs to change in this property listing (at least 10 characters).'));
      if (!note || note.trim().length < 10) return;
    }
    try {
      await api(`/properties/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision: action.dataset.decision, ...(note ? { note: note.trim() } : {}) }),
      });
      await refresh();
      showAlert(action.dataset.decision === 'approve' ? 'Property listing approved.' : 'Property listing returned for changes.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'property-authority-review') {
    let note;
    if (action.dataset.decision !== 'approve') {
      const message = action.dataset.decision === 'needs_info'
        ? 'Explain what additional ownership or delegated-authority evidence is needed (at least 10 characters).'
        : 'Explain why the authority evidence is rejected (at least 10 characters).';
      note = window.prompt(t(message));
      if (!note || note.trim().length < 10) return;
    }
    try {
      await api(`/properties/${id}/authority-review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision: action.dataset.decision, ...(note ? { note: note.trim() } : {}) }),
      });
      await refresh();
      showAlert(action.dataset.decision === 'approve'
        ? 'Property owner authority approved.'
        : action.dataset.decision === 'needs_info'
          ? 'Additional authority evidence requested.'
          : 'Property authority evidence rejected.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'property-authority-resubmit') {
    const note = window.prompt(t('Describe the new authority evidence being submitted (at least 10 characters).'));
    if (!note || note.trim().length < 10) return;
    try {
      await api(`/properties/${id}/authority-resubmit`, {
        method: 'PATCH',
        body: JSON.stringify({ note: note.trim() }),
      });
      await refresh();
      showAlert('Property authority evidence submitted for independent review.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'property-authority-file') {
    try {
      await downloadAuthenticatedFile(
        `/properties/${id}/authority-evidence/${action.dataset.evidence}/file`,
        `property-authority-${action.dataset.evidence}`,
      );
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'rental-application-review') {
    const decision = action.dataset.decision;
    const minimum = decision === 'accept' ? 3 : 10;
    const reason = window.prompt(t(`Explain this decision (at least ${minimum} characters).`));
    if (!reason || reason.trim().length < minimum) return;
    try {
      await api(`/marketplace/rental-applications/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason: reason.trim() }),
      });
      await refresh();
      showAlert(decision === 'accept' ? 'Rental application accepted for follow-up.'
        : decision === 'reject' ? 'Rental application rejected with a recorded reason.'
          : 'Additional information requested from the applicant.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'maintenance-assign-vendor') {
    if (!state.maintenanceVendors.length) {
      showAlert('No active property vendors are available for assignment.', true);
      return;
    }
    const choices = state.maintenanceVendors.map((vendor, index) => `${index + 1}. ${vendor.name} (${vendor.id})`).join('\n');
    const selected = window.prompt(`Choose the vendor number:\n${choices}`);
    const index = Number(selected) - 1;
    const vendor = Number.isInteger(index) ? state.maintenanceVendors[index] : null;
    if (!vendor) return;
    try {
      await api(`/maintenance/${encodeURIComponent(id)}/update`, {
        method: 'POST',
        body: JSON.stringify({ status: 'assigned', assigned_vendor_id: vendor.id }),
      });
      await refresh();
      showAlert(`Work assigned to ${vendor.name}.`);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'maintenance-vendor-accept' || name === 'maintenance-vendor-start') {
    const note = window.prompt(name === 'maintenance-vendor-accept'
      ? t('Confirm you can take this work order and add a note.')
      : t('Add a progress note before starting the work.'));
    if (!note || note.trim().length < 5) return;
    const endpoint = name === 'maintenance-vendor-accept' ? 'accept' : 'start';
    try {
      await api(`/maintenance/vendor/${encodeURIComponent(id)}/${endpoint}`, {
        method: 'POST', body: JSON.stringify({ note: note.trim() }),
      });
      await refresh();
      showAlert(name === 'maintenance-vendor-accept' ? 'Assignment accepted.' : 'Work started.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'maintenance-vendor-evidence' || name === 'maintenance-evidence-upload') {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/jpeg,image/png';
    picker.addEventListener('change', async () => {
      const file = picker.files?.[0];
      if (!file) return;
      try {
        const evidencePath = name === 'maintenance-vendor-evidence'
          ? `/maintenance/vendor/${encodeURIComponent(id)}/evidence`
          : `/maintenance/${encodeURIComponent(id)}/evidence`;
        await api(evidencePath, { method: 'POST', body: file });
        await refresh();
        showAlert('Malware-scanned evidence uploaded.');
      } catch (error) { showAlert(error.message, true); }
    }, { once: true });
    picker.click();
    return;
  }
  if (name === 'maintenance-vendor-complete') {
    const resolution_note = window.prompt(t('Describe the completed work (at least 5 characters).'));
    if (!resolution_note || resolution_note.trim().length < 5) return;
    try {
      await api(`/maintenance/vendor/${encodeURIComponent(id)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ idempotency_key: crypto.randomUUID(), resolution_note: resolution_note.trim() }),
      });
      await refresh();
      showAlert('Work submitted for independent review.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'maintenance-vendor-cost') {
    const amount = Number(window.prompt(t('Enter the additional cost requested in ETB.')));
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rationale = window.prompt(t('Explain why the additional cost is required (at least 10 characters).'));
    if (!rationale || rationale.trim().length < 10) return;
    try {
      await api(`/maintenance/vendor/${encodeURIComponent(id)}/additional-cost`, {
        method: 'POST', body: JSON.stringify({ amount, rationale: rationale.trim() }),
      });
      showAlert('Additional-cost request sent for separate approval.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'maintenance-vendor-invoice') {
    const invoice_reference = window.prompt(t('Enter the vendor invoice reference.'));
    const amount = Number(window.prompt(t('Enter the invoice amount in ETB.')));
    const invoice_date = window.prompt(t('Enter the invoice date (YYYY-MM-DD).'));
    const due_date = window.prompt(t('Enter the due date (YYYY-MM-DD).'));
    if (!invoice_reference?.trim() || !Number.isFinite(amount) || amount <= 0 || !invoice_date || !due_date) return;
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'application/pdf,image/jpeg,image/png';
    picker.addEventListener('change', async () => {
      const file = picker.files?.[0];
      if (!file) return;
      const query = new URLSearchParams({
        invoice_reference: invoice_reference.trim(), amount: String(amount), invoice_date, due_date,
      });
      try {
        const bill = await api(`/maintenance/vendor/${encodeURIComponent(id)}/invoice?${query}`, { method: 'POST', body: file });
        await refresh();
        showAlert(bill.match_status === 'matched'
          ? 'Invoice submitted and matched to the approved work amount.'
          : 'Invoice submitted to the mismatch exception queue; it will not be auto-approved.');
      } catch (error) { showAlert(error.message, true); }
    }, { once: true });
    picker.click();
    return;
  }
  if (name === 'maintenance-evidence') {
    try {
      const evidence = await api(`/maintenance/${encodeURIComponent(id)}/evidence`);
      if (!evidence.length) { showAlert('No scanned evidence is available.'); return; }
      showAlert(`Downloading ${evidence.length} malware-scanned evidence file(s).`);
      for (const item of evidence) {
        await downloadAuthenticatedFile(`/maintenance/evidence/${encodeURIComponent(item.id)}/file`, `maintenance-evidence-${item.id}`);
      }
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'maintenance-update') {
    let assigned_to; let resolution_note; let review_note; let cost; let sla_hours;
    if (action.dataset.status === 'triaged') {
      resolution_note = window.prompt(t('Add triage notes (at least 5 characters).'));
      if (!resolution_note || resolution_note.trim().length < 5) return;
      const selectedHours = window.prompt(t('Set the SLA target in hours (1-720).'));
      if (selectedHours === null || !/^\d+$/.test(selectedHours) || Number(selectedHours) < 1 || Number(selectedHours) > 720) {
        showAlert('Enter an SLA target between 1 and 720 hours.', true);
        return;
      }
      sla_hours = Number(selectedHours);
    }
    if (action.dataset.status === 'assigned') {
      const request = state.maintenanceRequests.find((item) => item.id === id);
      const eligibleAgents = state.propertyAgentScopes.filter((scope) =>
        scope.status === 'active' && scope.property_id === request?.property_id
        && scope.effective_from <= new Date().toISOString().slice(0, 10)
        && (!scope.effective_to || scope.effective_to >= new Date().toISOString().slice(0, 10)));
      if (!eligibleAgents.length) {
        showAlert(t('Assign an active tenant agent to this property before routing maintenance work.'), true);
        return;
      }
      const options = eligibleAgents.map((agent, index) =>
        `${index + 1}. ${agent.legal_name} · ${agent.tenant_role.replaceAll('_', ' ')}`).join('\n');
      const selectedAgent = window.prompt(`${t('Enter the number of the assigned internal technician:')}\n${options}`);
      if (selectedAgent === null || !/^\d+$/.test(selectedAgent.trim())) return;
      const selectedIndex = Number(selectedAgent) - 1;
      if (selectedIndex < 0 || selectedIndex >= eligibleAgents.length) {
        showAlert(t('Choose an agent from the listed property assignments.'), true);
        return;
      }
      assigned_to = eligibleAgents[selectedIndex].user_id;
    }
    if (action.dataset.status === 'awaiting_review') {
      resolution_note = window.prompt(t('Describe the completed work (at least 5 characters).'));
      if (!resolution_note || resolution_note.trim().length < 5) return;
      const estimate = window.prompt(t('Optional cost estimate in ETB. Leave blank if unknown.'));
      if (estimate?.trim()) {
        cost = Number(estimate);
        if (!Number.isFinite(cost) || cost < 0) { showAlert('Enter a valid non-negative estimate.', true); return; }
      }
    }
    if (['completed','rework_required','cancelled'].includes(action.dataset.status)) {
      const prompt = action.dataset.status === 'completed'
        ? 'Record the independent completion decision and rationale (at least 5 characters).'
        : action.dataset.status === 'rework_required'
          ? 'Explain the work required before approval (at least 5 characters).'
          : 'Explain why this request is being cancelled (at least 5 characters).';
      review_note = window.prompt(t(prompt));
      if (!review_note || review_note.trim().length < 5) return;
    }
    try {
      await api(`/maintenance/${encodeURIComponent(id)}/update`, { method: 'POST', body: JSON.stringify({
        status: action.dataset.status, ...(assigned_to ? { assigned_to: assigned_to.trim() } : {}),
        ...(sla_hours ? { sla_hours } : {}),
        ...(resolution_note ? { resolution_note: resolution_note.trim() } : {}),
        ...(review_note ? { review_note: review_note.trim() } : {}),
        ...(cost !== undefined ? { cost } : {}),
      }) });
      await refresh(); showAlert('Maintenance request updated.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'maintenance-events') {
    const host = action.closest('[data-maintenance]');
    let timeline = host?.querySelector('.maintenance-timeline');
    if (timeline) { timeline.remove(); return; }
    timeline = node('div', undefined, 'maintenance-timeline list');
    host?.append(timeline);
    try {
      const events = await api(`/maintenance/${encodeURIComponent(id)}/events`);
      if (!events.length) timeline.append(empty('No event history is available.'));
      for (const item of events) timeline.append(node('p', `${item.event_type.replace('_',' ')} · ${item.actor_name ?? 'Team member'} · ${new Date(item.created_at).toLocaleString(document.documentElement.lang)}${item.note ? ` · ${item.note}` : ''}`));
    } catch (error) { timeline.append(empty(error.message)); }
    return;
  }
  if (name === 'staffing-engagement-accept') {
    const reason = window.prompt(t('Confirm you reviewed the engagement terms. Enter a reason (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    try {
      await api(`/staffing-engagements/${encodeURIComponent(id)}/accept`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      await refresh(); showAlert('Your acceptance was recorded. The engagement is active when both parties accept.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'worker-support-respond') {
    const response = window.prompt(t('Enter the response for the worker (at least 5 characters).'));
    if (!response || response.trim().length < 5) return;
    try {
      await api(`/worker-support/${encodeURIComponent(id)}/respond`, {
        method: 'POST',
        body: JSON.stringify({ status: action.dataset.status, response: response.trim() }),
      });
      await refresh();
      showAlert(action.dataset.status === 'resolved' ? 'Worker support request resolved.' : 'Response sent to the worker.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'staffing-terms-decision' || name === 'staffing-work-decision') {
    const decision = action.dataset.decision;
    const reason = window.prompt(t(decision === 'approve'
      ? 'Enter the review reason (at least 10 characters).'
      : 'Explain what must be corrected (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    const endpoint = name === 'staffing-terms-decision'
      ? `/staffing-engagements/${encodeURIComponent(id)}/terms-decision`
      : `/staffing-work-periods/${encodeURIComponent(id)}/decision`;
    try {
      await api(endpoint, { method: 'POST', body: JSON.stringify({ decision, reason: reason.trim() }) });
      await refresh(); showAlert(decision === 'approve' ? 'Staffing review approved.' : 'Staffing review returned.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'user-documents') { void showUserDocuments(id, container); return; }
  if (name === 'user-document-review') {
    let note;
    if (action.dataset.decision === 'rejected') {
      note = window.prompt(t('Explain what needs to be corrected in this document (at least 10 characters).'));
      if (!note || note.trim().length < 10) return;
    }
    api(`/users/${action.dataset.user}/documents/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision: action.dataset.decision, ...(note ? { note: note.trim() } : {}) }),
    })
      .then(async () => { showAlert(t('KYC document {{decision}}.', { decision: t(action.dataset.decision) })); await refresh(); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'insurance-request-decision') {
    const responseNote = window.prompt(t('Enter the information response or closure reason (at least 10 characters).'));
    if (!responseNote || responseNote.trim().length < 10) return;
    try {
      await api(`/insurance/requests/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ status: action.dataset.status, response_note: responseNote.trim() }),
      });
      await refresh();
      showAlert('Insurance information request updated.');
    } catch (error) {
      showAlert(error.message, true);
    }
    return;
  }
  if (name === 'insurance-referral-assign') {
    const item = action.closest('.list-card');
    const agentId = item?.querySelector(`[data-referral-agent="${CSS.escape(id)}"]`)?.value;
    const reason = item?.querySelector(`[data-referral-reason="${CSS.escape(id)}"]`)?.value;
    if (!agentId || !reason) { showAlert('Select an active Agent and assignment reason before assigning this referral.', true); return; }
    try {
      await api(`/insurance/requests/agent-referrals/${encodeURIComponent(id)}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agent_id: agentId, reason }),
      });
      await refresh();
      showAlert('Consent-based Insurance referral assigned.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'insurance-referral-status') {
    try {
      await api(`/insurance/requests/agent-referrals/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: action.dataset.status }),
      });
      await refresh();
      showAlert('Insurance referral activity updated.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'insurance-referral-withdraw') {
    if (!window.confirm(t('Withdraw permission for Agent follow-up? The Agent will immediately lose access to this referral.'))) return;
    try {
      await api(`/insurance/requests/agent-referrals/${encodeURIComponent(id)}/withdraw`, {
        method: 'POST',
        body: '{}',
      });
      await refresh();
      showAlert('Agent-sharing consent withdrawn.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'insurance-sandbox-run') {
    if (!window.confirm(t('Run a fully synthetic training lifecycle? No real insurer, customer, policy, claim, or payment will be contacted or created.'))) return;
    try {
      await api(`/insurance/brokerage-sandbox/cases/${encodeURIComponent(id)}/run-demo`, {
        method: 'POST',
        body: JSON.stringify({ scenario_run_id: crypto.randomUUID(), acknowledge_synthetic_only: true }),
      });
      state.insuranceSandboxCases = await api('/insurance/brokerage-sandbox/cases/mine');
      renderPanel();
      showAlert('Synthetic end-to-end brokerage lifecycle completed. No real business activity occurred.');
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'insurance-sandbox-view') {
    try {
      const events = await api(`/insurance/brokerage-sandbox/cases/${encodeURIComponent(id)}/events`);
      state.insuranceSandboxCases = state.insuranceSandboxCases.map((item) =>
        item.id === id ? { ...item, events } : item);
      renderPanel();
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'insurance-sandbox-compare') {
    const item = action.closest('.list-card');
    const category = item?.querySelector(`[data-sandbox-comparison="${CSS.escape(id)}"]`)?.value;
    try {
      const result = await api(`/insurance/brokerage-sandbox/cases/${encodeURIComponent(id)}/comparison?${new URLSearchParams({ category })}`);
      showAlert(result.notes.join(' '));
      const comparison = node('section', undefined, 'panel form-card');
      comparison.append(node('h3', 'Synthetic product comparison'));
      for (const product of result.products) {
        comparison.append(card(product.label,
          `ETB ${(product.monthlyPremiumMinor / 100).toFixed(2)} per synthetic month · ${product.features.join(', ')}`,
          'illustrative only'));
      }
      item.append(comparison);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'insurance-sandbox-quote') {
    const item = action.closest('.list-card');
    const productKey = item?.querySelector(`[data-sandbox-quote-product="${CSS.escape(id)}"]`)?.value;
    if (!productKey) { showAlert('Select a synthetic training product.', true); return; }
    try {
      let events = state.insuranceSandboxCases.find((sandboxCase) => sandboxCase.id === id)?.events;
      if (!events) {
        events = await api(`/insurance/brokerage-sandbox/cases/${encodeURIComponent(id)}/events`);
        state.insuranceSandboxCases = state.insuranceSandboxCases.map((sandboxCase) =>
          sandboxCase.id === id ? { ...sandboxCase, events } : sandboxCase);
      }
      const runId = events.find((event) => event.event_type === 'needs_assessment_simulated')?.scenario_run_id;
      if (!runId) throw new Error('Run the complete synthetic demo before simulating a quote.');
      const result = await api(`/insurance/brokerage-sandbox/cases/${encodeURIComponent(id)}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          scenario_run_id: runId,
          product_key: productKey,
          term_months: 12,
          acknowledge_synthetic_only: true,
        }),
      });
      showAlert(`Synthetic quote only, not an offer: ETB ${(result.quote.event_data.synthetic_monthly_premium_minor / 100).toFixed(2)} monthly. No cover or payment was created.`);
    } catch (error) { showAlert(error.message, true); }
    return;
  }
  if (name === 'user-document-download') {
    fetch(`${API_ROOT}/users/${action.dataset.user}/documents/${id}/file`, {
      headers: { authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(t('Download failed ({{status}})', { status: response.status }));
        const blob = await response.blob();
        const link = node('a');
        link.href = URL.createObjectURL(blob);
        link.download = `afrolife-kyc-${id}`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'document-review') {
    let note;
    if (action.dataset.decision === 'rejected') {
      note = window.prompt(t('Explain what needs to be corrected in this document (at least 10 characters).'));
      if (!note || note.trim().length < 10) return;
    }
    api(`/documents/${id}/review`, { method: 'POST', body: JSON.stringify({ decision: action.dataset.decision, ...(note ? { note: note.trim() } : {}) }) })
      .then(async () => { showAlert(`Document ${action.dataset.decision}.`); await refresh(); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'document-download') {
    fetch(`${API_ROOT}/documents/${id}/file`, { headers: { authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` } })
      .then(async (response) => {
        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? `Download failed (${response.status})`);
        }
        const blob = await response.blob();
        const link = node('a');
        link.href = URL.createObjectURL(blob);
        link.download = `afrolife-document-${id}`;
        link.click();
        URL.revokeObjectURL(link.href);
      })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'worker-verify') {
    api(`/workers/${id}/verify`, { method: 'POST', body: '{}' })
      .then(async () => { showAlert('Worker verified and ready for matching.'); await refresh(); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'user-kyc') {
    const reason = window.prompt(t(action.dataset.decision === 'verified'
      ? 'Record the verification basis (at least 10 characters).'
      : 'Explain what failed and what the applicant must correct (at least 10 characters).'));
    if (!reason || reason.trim().length < 10) return;
    api(`/users/${id}/kyc`, { method: 'POST', body: JSON.stringify({ decision: action.dataset.decision, reason: reason.trim() }) })
      .then(async () => { showAlert(`Account marked ${action.dataset.decision}.`); await refresh(); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'user-activate' || name === 'user-deactivate') {
    const endpoint = name === 'user-activate' ? 'activate' : 'deactivate';
    const reason = name === 'user-activate'
      ? window.prompt(t('Record why this account is approved for activation (at least 10 characters).'))
      : null;
    if (name === 'user-activate' && (!reason || reason.trim().length < 10)) return;
    api(`/users/${id}/${endpoint}`, { method: 'POST', body: JSON.stringify(reason ? { reason: reason.trim() } : {}) })
      .then(async () => { showAlert(`Account ${name === 'user-activate' ? 'activated' : 'deactivated'}.`); await refresh(); })
      .catch((error) => showAlert(error.message, true));
    return;
  }
  if (name === 'candidates') { void showCandidates(id, container); return; }
  if (name === 'matches') { void showMatches(id, container); return; }
  if (name === 'propose') {
    api(`/requests/${id}/matches`, { method: 'POST', body: JSON.stringify({ worker_id: action.dataset.worker }) })
      .then(async () => { showAlert('Match proposed.'); await refresh(); })
      .catch((error) => showAlert(error.message, true));
  }
  if (name === 'respond') {
    api(`/matches/${id}/respond`, { method: 'POST', body: JSON.stringify({ decision: action.dataset.decision }) })
      .then(async () => { showAlert(action.dataset.decision === 'accepted' ? 'Match accepted and worker reserved.' : 'Match declined.'); await refresh(); })
      .catch((error) => showAlert(error.message, true));
  }
  if (name === 'release') {
    const dialog = $('#availability-dialog');
    $('#availability-form').dataset.match = id;
    $('#availability-select').value = 'immediate';
    dialog.showModal();
  }
});

$('#login-form').addEventListener('submit', login);
$('#access-mode-apply').addEventListener('click', () => {
  void switchAccessMode($('#access-mode-select').value);
});
$('#recovery-form').addEventListener('submit', requestPasswordRecovery);
$('#signup-form').addEventListener('submit', submitSignup);
$('#signup-followup-upload').addEventListener('click', () => uploadSignupReplacement()
  .catch((error) => setLocalizedText($('#signup-error'), error.message)));
$('#edir-registration-form').addEventListener('submit', submitEdirRegistration);
$('#availability-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const matchId = event.currentTarget.dataset.match;
  try {
    await api(`/matches/${matchId}/release`, {
      method: 'POST',
      body: JSON.stringify({ availability: $('#availability-select').value }),
    });
    $('#availability-dialog').close();
    showAlert('Reservation released and request reopened.');
    await refresh();
  } catch (error) {
    showAlert(error.message, true);
  }
});
$('#cancel-availability').addEventListener('click', () => $('#availability-dialog').close());
$('#signup-account-type').addEventListener('change', updateSignupFields);
$('#signup-agent-type').addEventListener('change', updateSignupFields);
$('#signup-plan').addEventListener('change', updatePlanLabels);
$('#signup-territory-search').addEventListener('input', syncSignupTerritory);
$('#signup-territory-search').addEventListener('change', syncSignupTerritory);
document.querySelectorAll('a[href="#login-form"]').forEach((link) => link.addEventListener('click', (event) => {
  if (!$('#app-view').hidden || $('#login-view').hidden) return;
  event.preventDefault();
  const loginForm = $('#login-form');
  if (loginForm.hidden) {
    $('#signup-form').hidden = true;
    loginForm.hidden = false;
  }
  if (window.location.hash !== '#login-form') window.history.pushState(null, '', '#login-form');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  loginForm.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  loginForm.querySelector('input[name="phone"]').focus({ preventScroll: true });
}));
$('#create-account').addEventListener('click', () => openSignup(false));
$('#public-create-account').addEventListener('click', () => openSignup(false));
$('#join-edir').addEventListener('click', () => openSignup(false, true));
$('#show-agent-plans').addEventListener('click', () => openSignup(true));
$('#show-password-recovery').addEventListener('click', () => {
  const button = $('#show-password-recovery');
  const help = $('#password-recovery-help');
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  help.hidden = expanded;
});
$('#open-password-recovery').addEventListener('click', () => {
  $('#login-form').hidden = true;
  $('#recovery-form').hidden = false;
  setLocalizedText($('#recovery-status'), '');
  $('#recovery-form [name="phone"]').focus({ preventScroll: true });
});
$('#back-to-sign-in').addEventListener('click', () => {
  $('#recovery-form').hidden = true;
  $('#login-form').hidden = false;
  $('#login-form [name="phone"]').focus({ preventScroll: true });
});
document.querySelectorAll('[data-open-edir-registration]').forEach((button) => button.addEventListener('click', () => {
  const form = $('#edir-registration-form');
  form.hidden = false;
  syncEdirRegistrationRequirements();
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const nextField = getEdirApplicationProgress()
    ? form.querySelector('input[type="file"]:required')
    : form.querySelector('input[name="display_name"]');
  nextField?.focus({ preventScroll: true });
}));
$('#show-login').addEventListener('click', () => {
  $('#signup-form').hidden = true;
  $('#recovery-form').hidden = true;
  $('#login-form').hidden = false;
  setLocalizedText($('#login-error'), '');
});
$('#save-server').addEventListener('click', saveNativeServer);
$('#logout').addEventListener('click', () => signOut());
$('#return-super-app').addEventListener('click', () => navigateToPanel('launcher'));
$('#retry-session').addEventListener('click', async () => {
  const button = $('#retry-session');
  button.disabled = true;
  try {
    await loadWorkspace();
  } catch (error) {
    console.error('AfroLife could not restore the saved session.', error);
    if (state.user && !$('#app-view').hidden) {
      showAlert('Your session is still active, but some workspace data could not be loaded. Check the connection and reload the workspace.', true);
      return;
    }
    $('#login-error').textContent = 'Unable to reconnect to your workspace. Your saved session is retained; check the connection and retry, or sign in again.';
  } finally {
    button.disabled = false;
  }
});
$('#refresh').addEventListener('click', () => refresh().catch((error) => showAlert(error.message, true)));
$('#workspace-more-dialog').addEventListener('close', () => {
  $('#mobile-workspace-more')?.setAttribute('aria-expanded', 'false');
});
$('#install-app').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('#install-app').hidden = true;
});
document.querySelectorAll('[data-install-pwa]').forEach((button) => button.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#install-app').hidden = true;
    return;
  }
  $('#install-help').hidden = false;
}));

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('#install-app').hidden = false;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  $('#install-app').hidden = true;
});

$('#workspace-search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await searchWorkspace($('#workspace-search-input').value);
  } catch (error) {
    console.error('Workspace search failed.', error);
    $('#workspace-search-results').replaceChildren(node('p', 'Search could not be completed. Check your connection and try again.'));
    $('#workspace-search-results').hidden = false;
  } finally {
    submit.disabled = false;
  }
});

window.addEventListener('popstate', () => {
  if (!state.user) return;
  const requested = panelFromUrl(window.location.href, KNOWN_PANELS);
  const panel = visiblePanelNames().has(requested)
    ? requested
    : isCrossMiniAppPanel(requested) ? 'launcher' : 'overview';
  if (panel !== requested) history.replaceState(null, '', panelUrl(window.location.href, panel));
  if (panel !== state.panel) navigateToPanel(panel, { replace: true });
});

initializeLocale(() => {
  renderSignupTerritoryOptions();
  updatePlanLabels();
  document.querySelectorAll('[data-i18n-source]').forEach((element) => {
    element.textContent = t(element.dataset.i18nSource, JSON.parse(element.dataset.i18nValues ?? '{}'));
  });
  if ($('#signup-success').hidden === false) {
    setLocalizedText($('#signup-success'), $('#signup-success').dataset.i18nSource);
  }
  if (state.user) {
    $('#account-name').textContent = `${state.user.legal_name} · ${roleLabel(state.user.role)}`;
    $('#page-subtitle').textContent = t('Signed in as {{role}}. Your access is limited to your assigned role and territory.', { role: roleLabel(state.user.role) });
    renderStats();
    renderPanel();
    renderAssistant();
  }
});
initializeNativeServer();
syncEdirRegistrationRequirements();
updateSignupFields();
if (!isNativeApp || localStorage.getItem(API_URL_KEY)) void loadPublicSubscriptionCatalog();

if (!isNativeApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.error('AfroLife offline support could not be enabled.', error);
  }));
}
if (sessionStorage.getItem(TOKEN_KEY)) {
  loadWorkspace().catch((error) => {
    console.error('AfroLife could not restore the saved session.', error);
    if (sessionStorage.getItem(TOKEN_KEY)) {
      if (state.user && !$('#app-view').hidden) {
        showAlert('Your session is still active, but some workspace data could not be loaded. Check the connection and reload the workspace.', true);
      } else {
        $('#retry-session').hidden = false;
        $('#login-error').textContent = 'Unable to reconnect to your workspace. Your saved session is retained; check the connection and retry, or sign in again.';
      }
    }
  });
}
