function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = String(text);
  if (className) item.className = className;
  return item;
}

function checklist(title, steps) {
  const section = element('section', undefined, 'panel tenant-data-checklist');
  section.append(element('h3', title));
  const list = element('ol');
  for (const step of steps) list.append(element('li', step));
  section.append(list);
  return section;
}

export function createTenantDataAdminWorkspace(
  api,
  assignments,
  selectedTenantId,
  workspace,
  analyticsStatus,
  migrationRuns = [],
  actorId = '',
  onTenantChange = () => {},
  onMigrationChange = async () => {},
) {
  const root = element('div', undefined, 'tenant-data-admin-workspace');
  const heading = element('div', undefined, 'section-heading');
  const title = element('div');
  title.append(element('h2', 'Tenant data administration'));
  title.append(element('p', 'Scoped operational metadata and review requests. Database operations remain with your tenant operator.'));
  heading.append(title);
  root.append(heading);

  const selectorLabel = element('label', 'Select an assigned tenant');
  selectorLabel.htmlFor = 'tenant-data-admin-tenant';
  const selector = element('select');
  selector.id = 'tenant-data-admin-tenant';
  selector.append(new Option('Choose a tenant', ''));
  for (const assignment of assignments) {
    const option = new Option(
      `${assignment.display_name} · ${assignment.capabilities.join(', ').replaceAll('_', ' ')}`,
      assignment.tenant_id,
    );
    selector.append(option);
  }
  selector.value = selectedTenantId ?? '';
  selector.addEventListener('change', () => {
    if (assignments.some((assignment) => assignment.tenant_id === selector.value)) {
      void onTenantChange(selector.value);
    }
  });
  const scopeSelector = element('div', undefined, 'field tenant-data-tenant-select');
  scopeSelector.append(selectorLabel, selector);
  root.append(scopeSelector);

  const assignment = assignments.find((item) => item.tenant_id === selectedTenantId);
  if (!assignment) {
    const empty = element('section', undefined, 'panel');
    empty.append(element('p', assignments.length
      ? 'Choose one of your assigned tenants to open its scoped workspace.'
      : 'No active tenant data-administrator assignment is available for this account.'));
    root.append(empty);
    return root;
  }

  const scopeBanner = element('div', undefined, 'tenant-data-scope-banner');
  scopeBanner.setAttribute('role', 'status');
  scopeBanner.append(
    element('span', 'TENANT SCOPE'),
    element('strong', workspace?.tenant?.name ?? assignment.display_name),
    element('span', 'Only this selected tenant is in scope. Global BI and other tenants are not available here.'),
  );
  root.append(scopeBanner);

  if (!workspace) {
    const failed = element('section', undefined, 'panel');
    failed.append(element('p', 'Tenant workspace metadata could not be loaded. Use Refresh to retry.'));
    root.append(failed);
    return root;
  }

  const metadata = element('section', undefined, 'panel tenant-data-metadata');
  metadata.append(element('h3', 'Deployment metadata · read only'));
  const facts = element('dl');
  const details = [
    ['Hosting model', workspace.tenant.hosting_mode === 'on_premises' ? 'On-premises' : 'Cloud managed'],
    ['Region', workspace.tenant.region ?? 'Not reported'],
    ['Deployment status', workspace.tenant.deployment_status ?? 'Not reported'],
    ['Configuration version', workspace.tenant.config_version ?? 'Not reported'],
    ['Metadata updated', workspace.tenant.updated_at ? new Date(workspace.tenant.updated_at).toLocaleString() : 'Not reported'],
  ];
  for (const [label, value] of details) {
    facts.append(element('dt', label), element('dd', value));
  }
  metadata.append(facts, element('p', 'No database endpoints, credentials, raw records, or direct tenant database connection are provided.'));
  root.append(metadata);

  if (assignment.capabilities.includes('analytics_admin')) {
    const analytics = element('section', undefined, 'panel tenant-data-analytics');
    analytics.append(element('h3', 'Tenant-local analytics'));
    analytics.append(element('p', analyticsStatus?.message
      ?? 'Tenant-local analytics projector is not connected. No tenant analytics are available from the central platform.'));
    analytics.append(element('p', `Projection grain: ${analyticsStatus?.grain ?? '30 minutes'} · UTC. Status: ${analyticsStatus?.projector_status ?? 'not connected'}; health unconfirmed.`));
    analytics.append(element('p', 'This view does not query Global BI or expose cross-tenant totals.'));
    root.append(analytics);
  }

  if (assignment.capabilities.includes('database_admin')) {
    root.append(checklist('Migration preflight', [
      'Confirm tenant change approval, operator identity, and maintenance window.',
      'Compare the migration manifest and checksums with the tenant-approved baseline; investigate drift.',
      'Confirm a tenant-local backup and restore-tested recovery point before any approved change.',
    ]));
    root.append(checklist('Backup and restore review', [
      'Review tenant-local encryption, retention, recovery objectives, and the latest successful backup evidence.',
      'Have the tenant operator restore into an isolated environment and verify integrity and application checks.',
      'Record validation, RPO/RTO evidence, and operator sign-off in the tenant evidence store.',
    ]));

    const requestPanel = element('section', undefined, 'panel tenant-data-request');
    requestPanel.append(element('h3', 'Request operator review'));
    requestPanel.append(element('p', 'Submitting records a request only. No migration, SQL, backup, restore, or database change is executed.'));
    const form = element('form');
    form.className = 'tenant-data-request-form';
    const typeLabel = element('label', 'Review type');
    const type = element('select');
    type.name = 'request_type';
    for (const [value, label] of [
      ['migration_review', 'Migration review'],
      ['backup_restore_review', 'Backup / restore review'],
      ['database_change_review', 'Database change review'],
    ]) type.append(new Option(label, value));
    typeLabel.append(type);
    const summaryLabel = element('label', 'Request summary');
    const summary = element('textarea');
    summary.name = 'summary';
    summary.required = true;
    summary.minLength = 10;
    summary.maxLength = 1000;
    summary.placeholder = 'Describe the review needed; do not include SQL, credentials, or connection details.';
    summaryLabel.append(summary);
    const evidenceLabel = element('label', 'Non-secret evidence reference (optional)');
    const evidence = element('input');
    evidence.type = 'text';
    evidence.name = 'evidence_reference';
    evidence.maxLength = 200;
    evidenceLabel.append(evidence);
    const submit = element('button', 'Create review request', 'button button-primary');
    submit.type = 'submit';
    const feedback = element('p');
    feedback.setAttribute('aria-live', 'polite');
    form.append(typeLabel, summaryLabel, evidenceLabel, submit, feedback);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      feedback.textContent = '';
      try {
        const body = {
          request_type: type.value,
          summary: summary.value,
          ...(evidence.value.trim() ? { evidence_reference: evidence.value.trim() } : {}),
        };
        const result = await api(`/platform/my-data/${encodeURIComponent(assignment.tenant_id)}/operator-requests`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        feedback.textContent = `Review request recorded (${result.id}). Execution: not performed.`;
        form.reset();
      } catch (error) {
        feedback.textContent = error?.message ?? 'The review request could not be recorded.';
      } finally {
        submit.disabled = false;
      }
    });
    requestPanel.append(form);
    root.append(requestPanel);

    const migrationPanel = element('section', undefined, 'panel tenant-data-migration');
    migrationPanel.append(
      element('h3', 'Staged property-data migration and cutover'),
      element('p', 'Evidence tracking only: AfroLife does not connect to, move, or modify tenant data. The tenant operator runs each approved step externally. Resolve dry-run issues and reconcile all records before independent cutover approval.'),
    );
    const startForm = element('form');
    startForm.className = 'tenant-data-migration-start-form';
    const startFields = [
      ['Source system reference', 'source_reference', 'text'],
      ['Target system reference', 'target_reference', 'text'],
      ['Migration summary', 'summary', 'textarea'],
      ['Manifest SHA-256 (lowercase hexadecimal)', 'manifest_sha256', 'text'],
      ['Approved change and verified backup evidence reference', 'evidence_reference', 'text'],
      ['Plan notes', 'notes', 'textarea'],
    ];
    for (const [label, name, type] of startFields) {
      const wrapper = element('label', label);
      const input = element(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') input.type = type;
      input.name = name;
      input.required = true;
      input.maxLength = name === 'manifest_sha256' ? 64 : name === 'source_reference' || name === 'target_reference' || name === 'evidence_reference' ? 200 : 1000;
      if (name === 'manifest_sha256') {
        input.minLength = 64;
        input.pattern = '[0-9a-f]{64}';
      }
      if (['summary','notes'].includes(name)) input.minLength = 10;
      wrapper.append(input);
      startForm.append(wrapper);
    }
    const startButton = element('button', 'Create migration plan', 'button button-primary');
    startButton.type = 'submit';
    const startFeedback = element('p');
    startFeedback.setAttribute('aria-live', 'polite');
    startForm.append(startButton, startFeedback);
    startForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      startButton.disabled = true;
      startFeedback.textContent = '';
      try {
        const values = Object.fromEntries(new FormData(startForm).entries());
        await api(`/platform/my-data/${encodeURIComponent(assignment.tenant_id)}/migration-runs`, {
          method: 'POST',
          body: JSON.stringify(values),
        });
        startForm.reset();
        await onMigrationChange();
      } catch (error) {
        startFeedback.textContent = error?.message ?? 'The migration plan could not be recorded.';
      } finally {
        startButton.disabled = false;
      }
    });
    migrationPanel.append(startForm);

    if (!migrationRuns?.length) {
      migrationPanel.append(element('p', 'No migration plans have been recorded for this tenant.'));
    }
    for (const run of migrationRuns ?? []) {
      const item = element('article', undefined, 'tenant-data-migration-run');
      item.append(
        element('h4', `${run.source_reference} → ${run.target_reference}`),
        element('p', `Stage: ${run.current_stage} · Planned by ${run.created_by}`),
        element('p', run.summary),
      );
      for (const migrationEvent of run.events) {
        item.append(element('p',
          `${migrationEvent.stage} · ${migrationEvent.created_at} · ${migrationEvent.notes}`));
      }
      const lastEvent = run.events[run.events.length - 1];
      const hasIssues = Number(lastEvent?.unresolved_count) > 0
        || Number(lastEvent?.validation_error_count) > 0;
      const nextStage = run.current_stage === 'dry_run' && hasIssues ? 'dry_run'
        : run.current_stage === 'staged' && hasIssues ? 'staged'
          : run.current_stage === 'reconciled' && hasIssues ? 'reconciled'
            : {
              planned: 'dry_run',
              dry_run: 'staged',
              staged: 'reconciled',
              reconciled: 'cutover_approved',
              cutover_approved: 'cutover_completed',
            }[run.current_stage];
      const canApprove = run.current_stage !== 'reconciled'
        || (run.created_by !== actorId
          && run.events[run.events.length - 1]?.actor_id !== actorId);
      const canComplete = run.created_by !== actorId
        && run.events[run.events.length - 1]?.actor_id !== actorId;
      const canRecordNextStage = nextStage
        && (nextStage !== 'cutover_approved' || canApprove)
        && (nextStage !== 'cutover_completed' || canComplete);
      if (canRecordNextStage) {
        const stageForm = element('form');
        stageForm.className = 'tenant-data-migration-stage-form';
        const hash = element('input');
        hash.type = 'text';
        hash.name = 'manifest_sha256';
        hash.maxLength = 64;
        hash.pattern = '[0-9a-f]{64}';
        hash.required = ['dry_run','staged','reconciled','cutover_completed'].includes(nextStage);
        hash.placeholder = 'Manifest SHA-256 when required';
        if (hash.required) stageForm.append(hash);
        const countFields = ['dry_run','staged','reconciled'].includes(nextStage);
        if (countFields) {
          for (const [name, label] of [
            ['source_record_count','Source record count'],
            ['staged_record_count','Staged record count'],
            ['unresolved_count','Unresolved records'],
            ['validation_error_count','Validation errors'],
          ]) {
            const wrapper = element('label', label);
            const input = element('input');
            input.type = 'number';
            input.name = name;
            input.min = '0';
            input.step = '1';
            input.required = true;
            if (name.endsWith('_count') && ['unresolved_count','validation_error_count'].includes(name)) input.value = '0';
            wrapper.append(input);
            stageForm.append(wrapper);
          }
        }
        const evidence = element('input');
        evidence.name = 'evidence_reference';
        evidence.type = 'text';
        evidence.maxLength = 200;
        evidence.required = true;
        evidence.placeholder = 'Non-secret evidence reference';
        const notes = element('textarea');
        notes.name = 'notes';
        notes.minLength = 10;
        notes.maxLength = 1000;
        notes.required = true;
        notes.placeholder = 'Evidence notes (minimum 10 characters)';
        const stageButton = element('button', `Record ${nextStage.replaceAll('_', ' ')}`, 'button button-outline');
        stageButton.type = 'submit';
        const feedback = element('p');
        feedback.setAttribute('aria-live', 'polite');
        stageForm.append(evidence, notes, stageButton, feedback);
        stageForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          stageButton.disabled = true;
          feedback.textContent = '';
          try {
            const values = Object.fromEntries(new FormData(stageForm).entries());
            const numericFields = ['source_record_count','staged_record_count','unresolved_count','validation_error_count'];
            for (const fieldName of numericFields) {
              if (values[fieldName] !== undefined) values[fieldName] = Number(values[fieldName]);
            }
            await api(`/platform/my-data/${encodeURIComponent(assignment.tenant_id)}/migration-runs/${encodeURIComponent(run.id)}/events`, {
              method: 'POST',
              body: JSON.stringify({ ...values, stage: nextStage }),
            });
            await onMigrationChange();
          } catch (error) {
            feedback.textContent = error?.message ?? 'The migration stage could not be recorded.';
          } finally {
            stageButton.disabled = false;
          }
        });
        item.append(stageForm);
      } else if (nextStage === 'cutover_approved' && !canApprove) {
        item.append(element('p', 'An independent tenant database administrator must approve cutover.'));
      } else if (nextStage === 'cutover_completed' && !canComplete) {
        item.append(element('p', 'Cutover completion must be recorded by an operator other than the plan creator and approver.'));
      }
      if (['planned','dry_run','staged','reconciled'].includes(run.current_stage)) {
        const abortForm = element('form');
        const evidence = element('input');
        evidence.name = 'evidence_reference';
        evidence.type = 'text';
        evidence.maxLength = 200;
        evidence.required = true;
        evidence.placeholder = 'Abort evidence reference';
        const notes = element('textarea');
        notes.name = 'notes';
        notes.minLength = 10;
        notes.maxLength = 1000;
        notes.required = true;
        notes.placeholder = 'Reason for aborting (minimum 10 characters)';
        const abortButton = element('button', 'Abort migration plan', 'button button-quiet');
        abortButton.type = 'submit';
        const feedback = element('p');
        feedback.setAttribute('aria-live', 'polite');
        abortForm.append(evidence, notes, abortButton, feedback);
        abortForm.addEventListener('submit', async (event) => {
          event.preventDefault();
          abortButton.disabled = true;
          feedback.textContent = '';
          try {
            const values = Object.fromEntries(new FormData(abortForm).entries());
            await api(`/platform/my-data/${encodeURIComponent(assignment.tenant_id)}/migration-runs/${encodeURIComponent(run.id)}/events`, {
              method: 'POST',
              body: JSON.stringify({ ...values, stage: 'aborted' }),
            });
            await onMigrationChange();
          } catch (error) {
            feedback.textContent = error?.message ?? 'The migration plan could not be aborted.';
          } finally {
            abortButton.disabled = false;
          }
        });
        item.append(abortForm);
      }
      migrationPanel.append(item);
    }
    root.append(migrationPanel);
  }
  return root;
}
