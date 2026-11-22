const ENVIRONMENT_HOSTS = new Set([
  'afrolife-agency.app.aletcloud.com',
  'afrolife-development.app.aletcloud.com'
]);

export function resolveEnvironmentUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;

  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !ENVIRONMENT_HOSTS.has(url.hostname) ||
      url.port !== '' ||
      !['/', '/admin'].includes(url.pathname) ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function renderDestination(actionId, statusId, url, label, missingMessage, readinessNotice) {
  const action = document.getElementById(actionId);
  const status = document.getElementById(statusId);
  const safeUrl = resolveEnvironmentUrl(url);

  action.replaceChildren();

  if (safeUrl) {
    const link = document.createElement('a');
    link.className = 'open-link';
    link.href = safeUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `Open ${label} sign-in`;
    action.append(link);
    status.dataset.state = readinessNotice ? 'warning' : 'ready';
    status.textContent = readinessNotice || 'Opens in a new tab.';
    return;
  }

  const button = document.createElement('button');
  button.className = 'unavailable-action';
  button.type = 'button';
  button.disabled = true;
  button.textContent = 'Unavailable';
  action.append(button);
  status.dataset.state = 'error';
  status.textContent = typeof url === 'string' && url.trim()
    ? 'Unavailable · destination must use HTTPS on a configured AfroLife app host.'
    : missingMessage;
}

function renderReadinessBanner(message) {
  const banner = document.getElementById('uat-readiness');
  const detail = document.getElementById('uat-readiness-message');
  const notice = typeof message === 'string' ? message.trim() : '';

  banner.hidden = notice === '';
  detail.textContent = notice;
}

async function loadDestinations() {
  try {
    const response = await fetch(new URL('./environments.json', import.meta.url));
    if (!response.ok) throw new Error('Environment configuration could not be loaded.');
    const config = await response.json();
    renderReadinessBanner(config.uatCanaryNotice);

    renderDestination(
      'uat-action',
      'uat-status',
      config.uatCanary,
      'UAT Canary',
      typeof config.uatCanaryUnavailableReason === 'string'
        ? config.uatCanaryUnavailableReason
        : 'Unavailable · the UAT Canary URL has not been verified and configured.',
      typeof config.uatCanaryNotice === 'string' ? config.uatCanaryNotice : ''
    );
    renderDestination(
      'development-action',
      'development-status',
      config.development,
      'Development',
      'Unavailable · the Development URL is not configured.',
      typeof config.developmentNotice === 'string' ? config.developmentNotice : ''
    );
  } catch {
    renderReadinessBanner(
      'Readiness information could not be loaded. Confirm UAT is ready with a platform administrator before continuing.'
    );
    renderDestination(
      'uat-action',
      'uat-status',
      null,
      'UAT Canary',
      'Unavailable · environment configuration could not be loaded.'
    );
    renderDestination(
      'development-action',
      'development-status',
      null,
      'Development',
      'Unavailable · environment configuration could not be loaded.'
    );
  }
}

if (typeof document !== 'undefined') void loadDestinations();
