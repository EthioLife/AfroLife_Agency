export interface SmsRecoveryProvider {
  sendRecoveryCode(phone: string, code: string): Promise<void>;
}

export interface FaydaVerificationAdapter {
  verifyIdentity(input: unknown): Promise<unknown>;
}

const smsRecoveryProvider: SmsRecoveryProvider | null = null;
const faydaVerificationAdapter: FaydaVerificationAdapter | null = null;

function whatsappConfiguration(env: NodeJS.ProcessEnv) {
  return {
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    template: env.WHATSAPP_RECOVERY_TEMPLATE,
    language: env.WHATSAPP_RECOVERY_LANGUAGE ?? 'en',
    graphVersion: env.WHATSAPP_GRAPH_API_VERSION,
  };
}

export function getWhatsAppRecoveryStatus(env: NodeJS.ProcessEnv = process.env) {
  const config = whatsappConfiguration(env);
  const enabled = env.WHATSAPP_RECOVERY_ENABLED === '1'
    && Boolean(config.phoneNumberId && config.accessToken && config.template
      && config.graphVersion && /^v\d+\.\d+$/.test(config.graphVersion));
  return {
    enabled,
    status: enabled ? 'available' : 'unavailable',
    message: 'WhatsApp password recovery is unavailable because delivery is not configured. Contact AfroLife support to recover your account.',
  };
}

export async function sendWhatsAppRecoveryCode(phone: string, code: string, env: NodeJS.ProcessEnv = process.env) {
  const config = whatsappConfiguration(env);
  if (!getWhatsAppRecoveryStatus(env).enabled) throw new Error('WhatsApp password recovery is not configured');
  const response = await fetch(
    `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: config.template,
          language: { code: config.language },
          components: [{
            type: 'body',
            parameters: [{ type: 'text', text: code }],
          }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`WhatsApp recovery delivery failed (HTTP ${response.status})`);
  }
}

export function getSmsRecoveryStatus(env: NodeJS.ProcessEnv = process.env) {
  const enabled = env.SMS_RECOVERY_ENABLED === '1' && smsRecoveryProvider !== null;
  return {
    enabled,
    status: enabled ? 'available' : 'unavailable',
    message: 'SMS password recovery is unavailable because delivery is not configured. No code was sent. Contact AfroLife support to recover your account.',
  };
}

export interface MessagingStatus {
  whatsapp: 'available' | 'unavailable';
  telegram: 'available' | 'unavailable';
  supportPhone: string;
  whatsappChatUrl: string;
  telegramChatUrl: string | null;
}

export function getMessagingStatus(env: NodeJS.ProcessEnv = process.env): MessagingStatus {
  const supportPhone = env.AFROLIFE_SUPPORT_PHONE ?? '+251708076113';
  const telegramUsername = env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '');
  const graphVersion = env.WHATSAPP_GRAPH_API_VERSION;
  return {
    whatsapp: env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN && graphVersion
      && /^v\d+\.\d+$/.test(graphVersion) && env.WHATSAPP_APP_SECRET && env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
      ? 'available' : 'unavailable',
    telegram: env.TELEGRAM_BOT_TOKEN && telegramUsername && env.TELEGRAM_WEBHOOK_SECRET ? 'available' : 'unavailable',
    supportPhone,
    whatsappChatUrl: `https://wa.me/${supportPhone.replace(/\D/g, '')}`,
    telegramChatUrl: telegramUsername ? `https://t.me/${telegramUsername}` : null,
  };
}

export async function sendTelegramMessage(chatId: string, text: string, env: NodeJS.ProcessEnv = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram bot is not configured');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Telegram delivery failed (HTTP ${response.status})`);
  const result = await response.json() as { ok?: boolean };
  if (!result.ok) throw new Error('Telegram rejected the message');
}

export async function sendWhatsAppText(phone: string, text: string, env: NodeJS.ProcessEnv = process.env) {
  const config = whatsappConfiguration(env);
  if (!config.phoneNumberId || !config.accessToken || !config.graphVersion
      || !/^v\d+\.\d+$/.test(config.graphVersion)) {
    throw new Error('WhatsApp is not configured');
  }
  const response = await fetch(
    `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone.replace(/^\+/, ''),
        type: 'text',
        text: { body: text },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error(`WhatsApp delivery failed (HTTP ${response.status})`);
}

export function getFaydaVerificationStatus(env: NodeJS.ProcessEnv = process.env) {
  const requested = env.FAYDA_VERIFICATION_ENABLED === '1';
  const enabled = requested && faydaVerificationAdapter !== null;
  return {
    enabled,
    status: enabled ? 'available' : requested ? 'unavailable' : 'disabled',
    message: 'Fayda verification is unavailable until AfroLife receives approved access and configures a verified integration.',
  };
}
