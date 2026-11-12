export const SUPPORT_FAQ = [
  {
    question: 'How do I reset a forgotten password?',
    answer: 'Use Password recovery on the AfroLife sign-in page and request a code. WhatsApp recovery works only when the service is configured, your account is active, and you opted in using the phone number registered on your account. The code expires after 5 minutes and is limited to 5 attempts. Telegram support cannot reset passwords. Never share your code.',
    keywords: ['password', 'reset', 'forgot', 'recovery', 'code'],
  },
  {
    question: 'How do I change my password while signed in?',
    answer: 'Open your account security settings, choose Change password, and enter your current password and a new password. Use at least 10 characters and do not use digits alone. A password recovery ends all active sessions; a signed-in password change replaces the current sign-in session.',
    keywords: ['change password', 'change my password', 'new password', 'current password', 'while signed in', 'security', 'sign out'],
  },
  {
    question: 'Why can I not sign in after registering?',
    answer: 'New applications remain inactive until the required identity and document review is complete and the account is approved for activation. Contact support if your application status needs review.',
    keywords: ['sign in', 'login', 'register', 'registration', 'inactive', 'application', 'approval'],
  },
  {
    question: 'How do I get human support or request a support call?',
    answer: 'Sign in and open AfroLife Support to start a private App/Web chat or request a support call back. You can also call the support line at +251 708 076 113. The chat bots provide guidance; they do not place automated calls.',
    keywords: ['person', 'agent', 'human', 'call', 'callback', 'call back', 'phone'],
  },
  {
    question: 'Is my support conversation private?',
    answer: 'App/Web support conversations are visible to you and the support staff member who claims your request. Do not send passwords, one-time codes, payment-card details, or national-ID numbers in chat or group messages.',
    keywords: ['private', 'privacy', 'secure', 'share', 'personal', 'group'],
  },
  {
    question: 'Can I use Telegram to recover my password?',
    answer: 'No. Telegram is for support guidance only. You may link Telegram from your signed-in account; the one-time link expires after 10 minutes. Password recovery must use the WhatsApp code sent to your registered, opted-in phone number when recovery is enabled.',
    keywords: ['telegram', 'link', 'bot', 'recover'],
  },
  {
    question: 'Do WhatsApp or Telegram support bots make calls?',
    answer: 'The bots can explain how to contact support and direct you to call +251 708 076 113. They do not place or receive automated calls. You can request a human support call back from the signed-in App/Web support assistant.',
    keywords: ['whatsapp', 'automated call', 'voice', 'make calls', 'bot call'],
  },
  {
    question: 'How do I enable two-factor sign-in?',
    answer: 'After signing in, open account security settings and set up an authenticator app. Administrative and other designated staff roles are required to enroll in MFA; other accounts may enable it voluntarily.',
    keywords: ['two factor', '2fa', 'mfa', 'authenticator', 'verification'],
  },
] as const;

export function supportFaqReply(message: string) {
  const normalized = message.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ');
  if (/^\s*\/?(start|help|faq|menu)\s*$/.test(normalized)) {
    return `AfroLife User Support FAQs\n\n${SUPPORT_FAQ.map((item, index) => `${index + 1}. ${item.question}`).join('\n')}\n\nAsk a question or call +251 708 076 113.`;
  }
  const match = SUPPORT_FAQ
    .map((item) => ({
      item,
      score: item.keywords.reduce(
        (score, keyword) => score + (normalized.includes(keyword) ? keyword.length : 0),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)[0]?.item;
  return match
    ? `${match.answer}\n\nMore help: call +251 708 076 113 or sign in to AfroLife App/Web Support.`
    : 'I can help with account access, password recovery, MFA, privacy, and contacting AfroLife User Support. Send /faq to see common questions, call +251 708 076 113, or sign in to open a private App/Web chat. Please do not share passwords or verification codes.';
}
