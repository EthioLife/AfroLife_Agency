import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getMessagingStatus, getWhatsAppRecoveryStatus, sendWhatsAppRecoveryCode } from '../src/auth-integrations.js';
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

test('WhatsApp recovery sends the code to both authentication-template components', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(null, { status: 200 });
  };

  try {
    await sendWhatsAppRecoveryCode('+251900000000', '123456', {
      WHATSAPP_RECOVERY_ENABLED: '1',
      WHATSAPP_PHONE_NUMBER_ID: 'phone-id',
      WHATSAPP_ACCESS_TOKEN: 'test-token',
      WHATSAPP_RECOVERY_TEMPLATE: 'afrolife_password_recovery',
      WHATSAPP_RECOVERY_LANGUAGE: 'en_US',
      WHATSAPP_GRAPH_API_VERSION: 'v27.0',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestUrl, 'https://graph.facebook.com/v27.0/phone-id/messages');
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '251900000000',
    type: 'template',
    template: {
      name: 'afrolife_password_recovery',
      language: { code: 'en_US' },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: '123456' }] },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: '123456' }],
        },
      ],
    },
  });
});

test('support library covers account, service, work, property, marketplace, and community journeys', () => {
  assert.ok(SUPPORT_FAQ.length >= 20);
  assert.deepEqual(new Set(SUPPORT_FAQ.map((item) => item.category)), new Set([
    'Getting started',
    'Account & security',
    'Services & payments',
    'Work, homes & marketplace',
    'Community & protection',
    'Support & technical help',
  ]));
  const faq = supportFaqReply('/faq');
  assert.match(faq, /reset a forgotten password/i);
  assert.match(faq, /How do I buy or sell through the marketplace safely/i);
  assert.match(faq, /Can I get a SACCO loan/i);
  assert.match(faq, /support call/i);
  assert.match(supportFaqReply('my application is pending after registration'), /remain pending/i);
  assert.match(supportFaqReply('I forgot my password'), /Choose Forgot password\?/i);
  assert.match(supportFaqReply('I paid and my subscription is still pending'), /confirmed manually by Finance/i);
  assert.match(supportFaqReply('Does registering as a worker guarantee a job?'), /not a job offer or placement guarantee/i);
  assert.match(supportFaqReply('Can I get an insurance payout?'), /Do not assume you have insurance coverage/i);
  assert.match(supportFaqReply('How do I request a call back?'), /\+251 708 076 113/);
  assert.match(supportFaqReply('Can Telegram reset my password?'), /Telegram support cannot reset passwords/i);
  assert.match(supportFaqReply('How do I change my password while signed in?'), /enter your current and new passwords/i);
  assert.match(supportFaqReply('password'), /could not confidently match/i);
  assert.match(supportFaqReply('unknown question'), /Never share passwords, one-time codes, or payment details/i);
});

test('Telegram identity links are short-lived, hashed, and scoped by row-level security', async () => {
  const migration = await readFile(new URL('../migrations/139_messaging_channel_links.sql', import.meta.url), 'utf8');
  assert.match(migration, /token_hash bytea NOT NULL CHECK \(octet_length\(token_hash\) = 32\)/);
  assert.match(migration, /expires_at <= created_at \+ interval '10 minutes'/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
});
