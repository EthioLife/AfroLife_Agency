import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getMessagingStatus, getWhatsAppRecoveryStatus } from '../src/auth-integrations.js';
import { SUPPORT_FAQ, supportFaqReply } from '../src/support-faq.js';

test('public support contacts use the configured support phone and only expose configured bot links', () => {
  const status = getMessagingStatus({
    AFROLIFE_SUPPORT_PHONE: '+251708076113',
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
    WHATSAPP_ACCESS_TOKEN: 'token',
    WHATSAPP_GRAPH_API_VERSION: 'v23.0',
    WHATSAPP_APP_SECRET: 'app-secret',
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-token',
    TELEGRAM_BOT_TOKEN: 'token',
    TELEGRAM_BOT_USERNAME: '@afrolife_support_bot',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
  });
  assert.equal(status.supportPhone, '+251708076113');
  assert.equal(status.whatsappChatUrl, 'https://wa.me/251708076113');
  assert.equal(status.telegramChatUrl, 'https://t.me/afrolife_support_bot');
  assert.equal(status.whatsapp, 'available');
  assert.equal(status.telegram, 'available');
});

test('WhatsApp password recovery requires explicit enablement and provider configuration', () => {
  assert.equal(getWhatsAppRecoveryStatus({ WHATSAPP_RECOVERY_ENABLED: '1' }).enabled, false);
  assert.equal(getWhatsAppRecoveryStatus({
    WHATSAPP_RECOVERY_ENABLED: '1',
    WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
    WHATSAPP_ACCESS_TOKEN: 'token',
    WHATSAPP_RECOVERY_TEMPLATE: 'password_recovery',
    WHATSAPP_GRAPH_API_VERSION: 'v23.0',
  }).enabled, true);
});

test('bot FAQ is limited to user support and does not offer sales or buyer workflows', () => {
  assert.ok(SUPPORT_FAQ.length >= 7);
  const faq = supportFaqReply('/faq');
  assert.match(faq, /reset a forgotten password/i);
  assert.match(faq, /support call/i);
  assert.doesNotMatch(faq, /sales|buyer confirmation/i);
  assert.match(supportFaqReply('How do I request a call?'), /\+251 708 076 113/);
  assert.match(supportFaqReply('Can I link Telegram for support?'), /Telegram is for support guidance only/);
  assert.match(supportFaqReply('How do I change my password while signed in?'), /enter your current password/);
  assert.match(supportFaqReply('unknown question'), /do not share passwords or verification codes/i);
});

test('Telegram identity links are short-lived, hashed, and scoped by row-level security', async () => {
  const migration = await readFile(new URL('../migrations/139_messaging_channel_links.sql', import.meta.url), 'utf8');
  assert.match(migration, /token_hash bytea NOT NULL CHECK \(octet_length\(token_hash\) = 32\)/);
  assert.match(migration, /expires_at <= created_at \+ interval '10 minutes'/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
});
