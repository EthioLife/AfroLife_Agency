const el = (tag, text, className) => {
  const item = document.createElement(tag);
  if (text !== undefined && text !== null) item.textContent = String(text);
  if (className) item.className = className;
  return item;
};

const platformAdmins = new Set(['global_admin', 'super_admin']);

export function buildMiniAppAccessPayload(mode, modules) {
  if (mode !== 'role_default' && mode !== 'custom') {
    throw new Error('Choose a valid app access mode.');
  }
  return {
    mode,
    modules: mode === 'custom' ? [...new Set(modules)] : [],
  };
}

function roleLabel(role) {
  return String(role ?? 'unknown').replaceAll('_', ' ');
}

export function createMiniAppAccessEditor(api, currentUser, users = []) {
  const section = el('section', undefined, 'panel mini-app-access-editor');
  section.append(
    el('h2', 'Mini-app access'),
    el('p', 'Choose which approved applications are discoverable for a user. App grants cannot elevate their role or bypass entity membership, resource authorization, or service-side access checks.', 'muted'),
  );

  if (!platformAdmins.has(currentUser?.role)) {
    section.append(el('p', 'Only a Global Admin or Super Admin can manage mini-app access.', 'muted'));
    return section;
  }

  const activeUsers = users.filter((user) => user && typeof user.id === 'string');
  if (!activeUsers.length) {
    section.append(el('p', 'No user accounts are available to edit. Refresh the administration workspace and try again.', 'muted'));
    return section;
  }

  const toolbar = el('div', undefined, 'mini-app-access-toolbar');
  const searchLabel = el('label', 'Find a user');
  const search = el('input');
  search.type = 'search';
  search.autocomplete = 'off';
  search.placeholder = 'Name or phone';
  searchLabel.append(search);
  const userLabel = el('label', 'User account');
  const userPicker = el('select');
  userPicker.required = true;
  userPicker.setAttribute('aria-label', 'User account to edit');
  userLabel.append(userPicker);
  toolbar.append(searchLabel, userLabel);

  const selectedRole = el('p', 'Select a user to review their app access.', 'mini-app-access-role');
  selectedRole.setAttribute('aria-live', 'polite');
  const status = el('p', '', 'mini-app-access-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const form = el('form', undefined, 'mini-app-access-form');
  const modeField = el('fieldset', undefined, 'mini-app-access-mode');
  modeField.append(el('legend', 'Access mode'));
  const defaultLabel = el('label');
  const defaultMode = el('input');
  defaultMode.type = 'radio';
  defaultMode.name = 'mini-app-access-mode';
  defaultMode.value = 'role_default';
  defaultMode.checked = true;
  defaultLabel.append(defaultMode, el('span', 'Use role defaults'));
  const customLabel = el('label');
  const customMode = el('input');
  customMode.type = 'radio';
  customMode.name = 'mini-app-access-mode';
  customMode.value = 'custom';
  customLabel.append(customMode, el('span', 'Use a custom app allowlist'));
  modeField.append(defaultLabel, customLabel);

  const modulesField = el('fieldset', undefined, 'mini-app-access-modules');
  modulesField.append(el('legend', 'Allowed applications'));
  const actions = el('div', undefined, 'mini-app-access-actions');
  const save = el('button', 'Save app access', 'button button-primary');
  save.type = 'submit';
  const reset = el('button', 'Reset to role defaults', 'button button-outline');
  reset.type = 'button';
  actions.append(save, reset);
  form.append(modeField, modulesField, actions);
  section.append(toolbar, selectedRole, status, form);

  let response = null;
  let requestSequence = 0;

  function selectedMode() {
    return customMode.checked ? 'custom' : 'role_default';
  }

  function renderModuleChoices() {
    modulesField.replaceChildren(el('legend', 'Allowed applications'));
    if (!response?.availableModules?.length) {
      modulesField.append(el('p', 'No applications are available for this role. A custom grant cannot exceed the role ceiling.', 'muted'));
      return;
    }
    const selectedModules = new Set(response.mode === 'role_default'
      ? response.availableModules.map((module) => module.id)
      : response.modules);
    for (const module of response.availableModules) {
      const label = el('label', undefined, 'mini-app-access-choice');
      const checkbox = el('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'modules';
      checkbox.value = module.id;
      checkbox.checked = selectedModules.has(module.id);
      checkbox.disabled = selectedMode() !== 'custom';
      const text = el('span');
      text.append(el('strong', module.label), el('small', module.id));
      label.append(checkbox, text);
      modulesField.append(label);
    }
  }

  function setBusy(busy) {
    userPicker.disabled = busy;
    save.disabled = busy || !response;
    reset.disabled = busy || !response;
    defaultMode.disabled = busy || !response;
    customMode.disabled = busy || !response;
    modulesField.disabled = busy || selectedMode() !== 'custom';
  }

  function renderMode() {
    modulesField.disabled = selectedMode() !== 'custom';
    modulesField.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.disabled = selectedMode() !== 'custom';
    });
    status.textContent = selectedMode() === 'role_default'
      ? 'Checked applications show the selected user’s current role-default access.'
      : 'Only applications returned as available for the selected role can be granted.';
  }

  async function loadUser(userId) {
    const sequence = ++requestSequence;
    response = null;
    modulesField.replaceChildren(el('legend', 'Allowed applications'));
    selectedRole.textContent = '';
    status.textContent = 'Loading app access…';
    setBusy(true);
    try {
      const result = await api(`/users/${encodeURIComponent(userId)}/mini-app-access`);
      if (sequence !== requestSequence) return;
      if (!result || !['role_default', 'custom'].includes(result.mode)
          || !Array.isArray(result.modules) || !Array.isArray(result.availableModules)) {
        throw new Error('The access service returned an unexpected response.');
      }
      response = {
        mode: result.mode,
        modules: result.modules.filter((module) => typeof module === 'string'),
        availableModules: result.availableModules.filter((module) =>
          module && typeof module.id === 'string' && typeof module.label === 'string'),
      };
      const user = activeUsers.find((candidate) => candidate.id === userId);
      selectedRole.textContent = user
        ? `Current role: ${roleLabel(user.role)}. Available applications are limited by this role.`
        : 'Current role unavailable. The server-provided application list remains the grant ceiling.';
      defaultMode.checked = response.mode === 'role_default';
      customMode.checked = response.mode === 'custom';
      renderModuleChoices();
      renderMode();
      save.disabled = false;
      reset.disabled = false;
    } catch (error) {
      if (sequence !== requestSequence) return;
      response = null;
      status.textContent = `Could not load app access: ${error?.message ?? 'request failed'}`;
    } finally {
      if (sequence === requestSequence) setBusy(false);
    }
  }

  function filteredUsers() {
    const query = search.value.trim().toLocaleLowerCase();
    return activeUsers.filter((user) =>
      !query || `${user.legal_name ?? ''} ${user.phone ?? ''}`.toLocaleLowerCase().includes(query));
  }

  function renderUsers(preserveSelection = true) {
    const previous = preserveSelection ? userPicker.value : '';
    userPicker.replaceChildren();
    userPicker.append(new Option('Choose a user', ''));
    for (const user of filteredUsers()) {
      const label = `${user.legal_name ?? user.phone ?? user.id} · ${roleLabel(user.role)}${user.active === false ? ' · inactive' : ''}`;
      userPicker.append(new Option(label, user.id));
    }
    userPicker.value = [...userPicker.options].some((option) => option.value === previous) ? previous : '';
    if (!userPicker.value) {
      requestSequence += 1;
      response = null;
      selectedRole.textContent = 'Select a user to review their app access.';
      status.textContent = '';
      modulesField.replaceChildren(el('legend', 'Allowed applications'));
      setBusy(false);
    }
  }

  search.addEventListener('input', () => renderUsers());
  userPicker.addEventListener('change', () => {
    if (!userPicker.value) {
      response = null;
      modulesField.replaceChildren(el('legend', 'Allowed applications'));
      selectedRole.textContent = 'Select a user to review their app access.';
      status.textContent = '';
      setBusy(false);
      return;
    }
    void loadUser(userPicker.value);
  });
  defaultMode.addEventListener('change', renderMode);
  customMode.addEventListener('change', renderMode);

  async function saveAccess(mode = selectedMode()) {
    if (!response || !userPicker.value) return;
    const availableIds = new Set(response.availableModules.map((module) => module.id));
    const modules = [...modulesField.querySelectorAll('input[type="checkbox"]:checked')]
      .map((checkbox) => checkbox.value);
    if (modules.some((module) => !availableIds.has(module))) {
      status.textContent = 'A selected application is outside the role’s available-app list. Reload before saving.';
      return;
    }
    let payload;
    try {
      payload = buildMiniAppAccessPayload(mode, modules);
    } catch (error) {
      status.textContent = error.message;
      return;
    }
    setBusy(true);
    status.textContent = 'Saving app access…';
    try {
      await api(`/users/${encodeURIComponent(userPicker.value)}/mini-app-access`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await loadUser(userPicker.value);
      status.textContent = mode === 'role_default'
        ? 'Role-default app access restored.'
        : 'Custom app access saved.';
    } catch (error) {
      status.textContent = `Could not save app access: ${error?.message ?? 'request failed'}`;
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveAccess();
  });
  reset.addEventListener('click', () => {
    defaultMode.checked = true;
    customMode.checked = false;
    renderMode();
    void saveAccess('role_default');
  });

  renderUsers(false);
  return section;
}

export function createAdminRoleAccessEditor(api, currentUser, users = []) {
  const section = el('section', undefined, 'panel mini-app-access-editor');
  section.append(
    el('h2', 'Administrator access'),
    el('p', 'Assign administrator modes, service access and Super Admin tenant scope. These grants are enforced on the server for each session.', 'muted'),
  );
  if (currentUser?.role !== 'global_admin') {
    section.append(el('p', 'Only a Global Admin can manage administrator access.', 'muted'));
    return section;
  }
  const targets = users.filter((user) => user && typeof user.id === 'string' && user.id !== currentUser.id);
  const toolbar = el('div', undefined, 'mini-app-access-toolbar');
  const userLabel = el('label', 'User account');
  const picker = el('select');
  picker.setAttribute('aria-label', 'User account to configure');
  picker.append(new Option('Choose a user', ''));
  for (const user of targets) {
    picker.append(new Option(
      `${user.legal_name ?? user.phone ?? user.id} · ${roleLabel(user.role)}${user.active === false ? ' · inactive' : ''}`,
      user.id,
    ));
  }
  userLabel.append(picker);
  toolbar.append(userLabel);

  const status = el('p', 'Select a user to configure administrator access.', 'mini-app-access-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const form = el('form', undefined, 'mini-app-access-form');
  const roleFields = el('div');
  const save = el('button', 'Save administrator access', 'button button-primary');
  save.type = 'submit';
  const actions = el('div', undefined, 'mini-app-access-actions');
  actions.append(save);
  form.append(roleFields, actions);
  section.append(toolbar, status, form);

  let response = null;
  let sequence = 0;
  const roleInputs = new Map();

  function renderGrantFields() {
    roleFields.replaceChildren();
    roleInputs.clear();
    const grants = new Map((response?.grants ?? []).map((grant) => [grant.role_name, grant]));
    for (const role of ['global_admin', 'super_admin']) {
      const current = grants.get(role);
      const isPrimary = response?.primaryRole === role;
      const roleGrant = current ?? {
        role_name: role,
        module_keys: response?.availableModules
          .filter((module) => role === 'global_admin' || module.id !== 'global-bi')
          .map((module) => module.id) ?? [],
        all_tenants: false,
      };
      const fieldset = el('fieldset', undefined, 'mini-app-access-modules');
      const moduleInputs = [];
      fieldset.append(el('legend', roleLabel(role)));
      const enabledLabel = el('label', undefined, 'mini-app-access-choice');
      const enabled = el('input');
      enabled.type = 'checkbox';
      enabled.checked = isPrimary || Boolean(current);
      enabled.disabled = isPrimary || !['global_admin', 'super_admin'].includes(response?.primaryRole);
      enabledLabel.append(enabled, el('span', isPrimary ? 'Primary role' : 'Allow this access mode'));
      fieldset.append(enabledLabel);
      const modules = new Set(roleGrant.module_keys ?? []);
      for (const module of response?.availableModules ?? []) {
        const label = el('label', undefined, 'mini-app-access-choice');
        const checkbox = el('input');
        checkbox.type = 'checkbox';
        checkbox.value = module.id;
        checkbox.checked = modules.has(module.id);
        checkbox.disabled = !enabled.checked;
        moduleInputs.push(checkbox);
        const copy = el('span');
        copy.append(el('strong', module.label), el('small', module.id));
        label.append(checkbox, copy);
        fieldset.append(label);
      }
      let allTenants = null;
      if (role === 'super_admin') {
        const scopeLabel = el('label', undefined, 'mini-app-access-choice');
        allTenants = el('input');
        allTenants.type = 'checkbox';
        allTenants.checked = roleGrant.all_tenants === true;
        allTenants.disabled = !enabled.checked;
        scopeLabel.append(allTenants, el('span', 'Allow access across all platform tenants'));
        fieldset.append(scopeLabel);
      }
      enabled.addEventListener('change', () => {
        fieldset.querySelectorAll('input').forEach((input) => {
          if (input !== enabled) input.disabled = !enabled.checked;
        });
      });
      roleInputs.set(role, { enabled, moduleInputs, allTenants });
      roleFields.append(fieldset);
    }
  }

  async function loadUser(userId) {
    const currentSequence = ++sequence;
    response = null;
    roleFields.replaceChildren();
    status.textContent = 'Loading administrator access…';
    picker.disabled = true;
    save.disabled = true;
    try {
      const result = await api(`/users/${encodeURIComponent(userId)}/admin-access`);
      if (currentSequence !== sequence) return;
      if (!result || typeof result.primaryRole !== 'string'
          || !Array.isArray(result.grants) || !Array.isArray(result.availableModules)) {
        throw new Error('The access service returned an unexpected response.');
      }
      response = result;
      renderGrantFields();
      status.textContent = `Configure administrator modes for ${targets.find((user) => user.id === userId)?.legal_name ?? 'this user'}.`;
      save.disabled = false;
    } catch (error) {
      if (currentSequence !== sequence) return;
      status.textContent = `Could not load administrator access: ${error?.message ?? 'request failed'}`;
    } finally {
      if (currentSequence === sequence) picker.disabled = false;
    }
  }

  picker.addEventListener('change', () => {
    if (picker.value) void loadUser(picker.value);
    else {
      response = null;
      roleFields.replaceChildren();
      status.textContent = 'Select a user to configure administrator access.';
      save.disabled = true;
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!response || !picker.value) return;
    save.disabled = true;
    status.textContent = 'Saving administrator access…';
    const roles = [...roleInputs.entries()]
      .filter(([, controls]) => controls.enabled.checked)
      .map(([role, controls]) => ({
        role,
        modules: controls.moduleInputs.filter((input) => input.checked).map((input) => input.value),
        all_tenants: controls.allTenants?.checked === true,
      }));
    try {
      await api(`/users/${encodeURIComponent(picker.value)}/admin-access`, {
        method: 'PUT',
        body: JSON.stringify({ roles }),
      });
      await loadUser(picker.value);
      status.textContent = 'Administrator access saved.';
    } catch (error) {
      status.textContent = `Could not save administrator access: ${error?.message ?? 'request failed'}`;
      save.disabled = false;
    }
  });
  save.disabled = true;
  return section;
}
