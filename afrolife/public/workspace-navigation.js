export const REQUIRED_PANELS = new Set(['overview', 'launcher', 'security', 'admin', 'status', 'tenant-data-admin']);

export function panelFromUrl(url, visiblePanels) {
  const parsed = new URL(url, 'https://workspace.invalid');
  const requested = parsed.searchParams.get('panel');
  return requested && visiblePanels.has(requested) ? requested : 'overview';
}

export function panelUrl(url, panel) {
  const parsed = new URL(url, 'https://workspace.invalid');
  if (panel === 'overview') parsed.searchParams.delete('panel');
  else parsed.searchParams.set('panel', panel);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function isPanelEnabled(panel, enabledModules) {
  return REQUIRED_PANELS.has(panel) || enabledModules.includes(panel);
}

export function isMiniAppAllowed(panel, allowedModules) {
  return Array.isArray(allowedModules) && allowedModules.includes(panel);
}
