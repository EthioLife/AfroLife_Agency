import { z } from 'zod';

const money = z.string()
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0, 'Quote amount must be greater than zero');
const reason = z.string().trim().min(10).max(1000);

export const marketplaceServiceRequestInput = z.object({
  listing_id: z.string().uuid(),
  preferred_date: z.string().date().optional(),
  request_details: z.string().trim().min(20).max(2000),
}).strict();

export const marketplaceServiceQuoteInput = z.object({
  amount: money,
  expires_on: z.string().date(),
  terms: z.string().trim().min(10).max(2000),
}).strict();

export const marketplaceServiceDecisionInput = z.object({
  decision: z.enum(['accept', 'decline']),
  reason: reason.optional(),
}).strict().superRefine((value, context) => {
  if (value.decision === 'decline' && !value.reason) {
    context.addIssue({ code: 'custom', path: ['reason'], message: 'A reason is required to decline a quote' });
  }
});

export const marketplaceServiceScheduleInput = z.object({
  scheduled_for: z.string().date(),
}).strict();

export const marketplaceServiceCompletionInput = z.object({
  completion_note: z.string().trim().min(10).max(2000),
}).strict();

export const marketplaceServiceCancellationInput = z.object({
  reason,
}).strict();
