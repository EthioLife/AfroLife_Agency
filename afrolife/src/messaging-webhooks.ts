import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { sendTelegramMessage, sendWhatsAppText } from './auth-integrations.js';
import { withService } from './core.js';
import { supportFaqReply } from './support-faq.js';

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function telegramSecretIsValid(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  return Boolean(secret && safeEqual(req.get('x-telegram-bot-api-secret-token') ?? '', secret));
}

export const telegramWebhook: RequestHandler = (req, res, next) => {
  void (async () => {
    if (!telegramSecretIsValid(req)) {
      res.sendStatus(401);
      return;
    }
    const update = z.object({
      message: z.object({
        text: z.string().max(4000).optional(),
        from: z.object({ id: z.union([z.number(), z.string()]) }).optional(),
        chat: z.object({ id: z.union([z.number(), z.string()]), type: z.string().optional() }),
      }).optional(),
    }).safeParse(req.body);
    if (!update.success || !update.data.message?.text) {
      res.sendStatus(200);
      return;
    }
    if (update.data.message.chat.type && update.data.message.chat.type !== 'private') {
      res.sendStatus(200);
      return;
    }
    const text = update.data.message.text.trim().toLowerCase();
    const chatId = String(update.data.message.chat.id);
    const linkToken = update.data.message.text.trim().match(/^\/start\s+([a-f0-9]{64})$/i)?.[1];
    if (linkToken) {
      if (update.data.message.chat.type !== 'private' || !update.data.message.from) {
        await sendTelegramMessage(chatId, 'For your security, link your Telegram account in a private chat with this bot.');
        res.sendStatus(200);
        return;
      }
      const telegramUserId = String(update.data.message.from.id);
      const linked = await withService('messaging_webhook', async (client) => {
        const challenge = (await client.query(
          `SELECT id,user_id FROM telegram_link_challenges
           WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now()
           ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [createHash('sha256').update(linkToken).digest()],
        )).rows[0];
        if (!challenge) return false;
        await client.query('UPDATE telegram_link_challenges SET consumed_at=now() WHERE id=$1', [challenge.id]);
        await client.query(
          `INSERT INTO user_telegram_links (user_id,telegram_user_id)
           VALUES ($1,$2)
           ON CONFLICT (user_id) DO UPDATE SET telegram_user_id=EXCLUDED.telegram_user_id,linked_at=now()`,
          [challenge.user_id, telegramUserId],
        );
        return true;
      });
      await sendTelegramMessage(chatId, linked
        ? 'Your Telegram account is now securely linked. Password resets still require a code sent to your registered WhatsApp number.'
        : 'That link is invalid or expired. Sign in to AfroLife and request a new Telegram link.');
      res.sendStatus(200);
      return;
    }
    await sendTelegramMessage(chatId, supportFaqReply(text));
    res.sendStatus(200);
  })().catch(next);
};

export const whatsappWebhookVerify: RequestHandler = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === 'subscribe' && typeof token === 'string' && expected && safeEqual(token, expected)
      && typeof challenge === 'string') {
    res.type('text/plain').send(challenge);
    return;
  }
  res.sendStatus(403);
};

export const whatsappWebhook: RequestHandler = (req, res, next) => {
  void (async () => {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret || !Buffer.isBuffer(req.body)) {
      res.sendStatus(503);
      return;
    }
    const supplied = req.get('x-hub-signature-256') ?? '';
    const expected = `sha256=${createHmac('sha256', appSecret).update(req.body).digest('hex')}`;
    if (!safeEqual(supplied, expected)) {
      res.sendStatus(401);
      return;
    }
    let payload: {
      entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from?: string; text?: { body?: string } }> } }> }>;
    };
    try {
      payload = JSON.parse(req.body.toString('utf8')) as typeof payload;
    } catch {
      res.sendStatus(400);
      return;
    }
    const messages = payload.entry?.flatMap((entry) => entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? []) ?? [];
    for (const message of messages) {
      if (!message.from || !message.text?.body) continue;
      await sendWhatsAppText(
        `+${message.from}`,
        supportFaqReply(message.text.body),
      );
    }
    res.sendStatus(200);
  })().catch(next);
};
