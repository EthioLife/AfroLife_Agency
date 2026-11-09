const DATABASE_NAME = 'afrosherik-offline-inspections';
const DATABASE_VERSION = 1;
const KEY_STORE = 'keys';
const DRAFT_STORE = 'drafts';
const MAX_DRAFTS_PER_USER = 25;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUserId(userId) {
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
    throw new Error('A valid signed-in user is required for offline inspection storage.');
  }
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateDraft(draft) {
  if (!draft || typeof draft !== 'object'
    || !UUID_PATTERN.test(draft.tenant_system_id ?? '')
    || !UUID_PATTERN.test(draft.lease_id ?? '')
    || !UUID_PATTERN.test(draft.client_submission_id ?? '')
    || typeof draft.enqueued_at !== 'string'
    || Number.isNaN(Date.parse(draft.enqueued_at))
    || !draft.payload || typeof draft.payload !== 'object'
    || !validDate(draft.payload.actual_vacated_on)
    || !validDate(draft.payload.inspected_on)
    || typeof draft.payload.condition_notes !== 'string'
    || draft.payload.condition_notes.trim().length < 10
    || draft.payload.condition_notes.length > 4000
    || typeof draft.payload.keys_returned !== 'boolean'
    || typeof draft.payload.deposit_deduction !== 'string'
    || !/^\d{1,12}(?:\.\d{1,2})?$/.test(draft.payload.deposit_deduction)
    || (draft.payload.deduction_reason !== undefined
      && (typeof draft.payload.deduction_reason !== 'string'
        || draft.payload.deduction_reason.trim().length < 10
        || draft.payload.deduction_reason.length > 1000))) {
    throw new Error('The saved move-out inspection draft is invalid and was not changed.');
  }
  return draft;
}

function validateDrafts(drafts) {
  if (!Array.isArray(drafts) || drafts.length > MAX_DRAFTS_PER_USER) {
    throw new Error(`Offline inspection storage is limited to ${MAX_DRAFTS_PER_USER} drafts per user.`);
  }
  return drafts.map(validateDraft);
}

function cryptoApiOrThrow(cryptoApi) {
  if (!cryptoApi?.subtle?.encrypt || !cryptoApi?.subtle?.decrypt || !cryptoApi?.getRandomValues) {
    throw new Error('Secure offline inspection storage is unavailable in this browser.');
  }
  return cryptoApi;
}

export async function encryptInspectionDraft(userId, drafts, key, cryptoApi = globalThis.crypto) {
  assertUserId(userId);
  validateDrafts(drafts);
  cryptoApi = cryptoApiOrThrow(cryptoApi);
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(drafts));
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
    key,
    plaintext,
  );
  return { version: 1, iv: iv.buffer, ciphertext };
}

export async function decryptInspectionDraft(userId, record, key, cryptoApi = globalThis.crypto) {
  assertUserId(userId);
  cryptoApi = cryptoApiOrThrow(cryptoApi);
  if (!record || record.version !== 1 || !(record.iv instanceof ArrayBuffer)
    || !(record.ciphertext instanceof ArrayBuffer) || record.iv.byteLength !== 12) {
    throw new Error('The encrypted inspection draft cannot be read. It was preserved on this device.');
  }
  try {
    const plaintext = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(record.iv), additionalData: new TextEncoder().encode(userId) },
      key,
      record.ciphertext,
    );
    const drafts = JSON.parse(new TextDecoder().decode(plaintext));
    return validateDrafts(drafts);
  } catch (error) {
    throw new Error('The encrypted inspection draft could not be verified. It was preserved on this device.', { cause: error });
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline inspection storage request failed.'));
  });
}

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Offline inspection storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Offline inspection storage transaction was aborted.'));
  });
}

function openDatabase() {
  if (!globalThis.indexedDB) {
    throw new Error('Encrypted offline inspection storage is unavailable. The inspection was not saved.');
  }
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(KEY_STORE)) database.createObjectStore(KEY_STORE, { keyPath: 'user_id' });
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        const drafts = database.createObjectStore(DRAFT_STORE, { keyPath: ['user_id', 'client_submission_id'] });
        drafts.createIndex('by_user', 'user_id', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Encrypted offline inspection storage could not be opened.'));
    request.onblocked = () => reject(new Error('Offline inspection storage is blocked by another open app tab.'));
  });
}

async function readKey(database, userId) {
  const transaction = database.transaction(KEY_STORE, 'readonly');
  const done = transactionResult(transaction);
  const record = await requestResult(transaction.objectStore(KEY_STORE).get(userId));
  await done;
  return record?.key ?? null;
}

async function getOrCreateKey(database, userId) {
  const existing = await readKey(database, userId);
  if (existing) return existing;
  const cryptoApi = cryptoApiOrThrow(globalThis.crypto);
  const candidate = await cryptoApi.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const transaction = database.transaction(KEY_STORE, 'readwrite');
  const done = transactionResult(transaction);
  transaction.objectStore(KEY_STORE).add({ user_id: userId, key: candidate });
  try {
    await done;
    return candidate;
  } catch (error) {
    const winner = await readKey(database, userId);
    if (winner) return winner;
    throw error;
  }
}

export async function readMoveOutInspectionDrafts(userId) {
  assertUserId(userId);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DRAFT_STORE, 'readonly');
    const done = transactionResult(transaction);
    const records = await requestResult(transaction.objectStore(DRAFT_STORE).index('by_user').getAll(userId));
    await done;
    if (!records.length) return [];
    const key = await readKey(database, userId);
    if (!key) throw new Error('The encrypted inspection key is missing. Saved drafts were preserved.');
    const drafts = [];
    for (const record of records) {
      const [draft] = await decryptInspectionDraft(userId, record, key);
      if (!draft || draft.client_submission_id !== record.client_submission_id) {
        throw new Error('The encrypted inspection draft does not match its stored identifier. It was preserved.');
      }
      drafts.push(draft);
    }
    return drafts.sort((left, right) => left.enqueued_at.localeCompare(right.enqueued_at));
  } finally {
    database.close();
  }
}

export async function enqueueMoveOutInspectionDraft(userId, draft) {
  assertUserId(userId);
  validateDraft(draft);
  const current = await readMoveOutInspectionDrafts(userId);
  const existing = current.find((item) => item.client_submission_id === draft.client_submission_id);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(draft)) {
      throw new Error('This inspection draft identifier already belongs to different data.');
    }
    return current;
  }
  if (current.length >= MAX_DRAFTS_PER_USER) {
    throw new Error(`Offline inspection storage is limited to ${MAX_DRAFTS_PER_USER} drafts per user.`);
  }

  const database = await openDatabase();
  try {
    const key = await getOrCreateKey(database, userId);
    const encrypted = await encryptInspectionDraft(userId, [draft], key);
    const transaction = database.transaction(DRAFT_STORE, 'readwrite');
    const done = transactionResult(transaction);
    transaction.objectStore(DRAFT_STORE).add({
      user_id: userId,
      client_submission_id: draft.client_submission_id,
      ...encrypted,
    });
    try {
      await done;
    } catch (error) {
      const saved = (await readMoveOutInspectionDrafts(userId))
        .find((item) => item.client_submission_id === draft.client_submission_id);
      if (saved && JSON.stringify(saved) === JSON.stringify(draft)) return current.concat(saved);
      throw error;
    }
    return current.concat(draft).sort((left, right) => left.enqueued_at.localeCompare(right.enqueued_at));
  } finally {
    database.close();
  }
}

export async function removeMoveOutInspectionDraft(userId, clientSubmissionId) {
  assertUserId(userId);
  if (typeof clientSubmissionId !== 'string' || !UUID_PATTERN.test(clientSubmissionId)) {
    throw new Error('A valid inspection draft identifier is required.');
  }
  const database = await openDatabase();
  try {
    const transaction = database.transaction(DRAFT_STORE, 'readwrite');
    const done = transactionResult(transaction);
    transaction.objectStore(DRAFT_STORE).delete([userId, clientSubmissionId]);
    await done;
  } finally {
    database.close();
  }
}
