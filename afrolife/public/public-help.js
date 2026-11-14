const stopWords = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'does', 'for', 'how', 'i', 'in',
  'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'what', 'when',
  'where', 'which', 'who', 'why', 'with',
]);

function normalizeText(value) {
  return String(value ?? '').toLocaleLowerCase().normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\bsign\s+in\b/g, 'signin')
    .replace(/\b(log[\s-]?in)\b/g, 'signin')
    .replace(/\b(two[\s-]?factor|2fa)\b/g, 'mfa')
    .replace(/[^\p{L}\p{N}+]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return normalizeText(value).split(' ').filter((word) => word.length > 1 && !stopWords.has(word));
}

function scoreFaq(query, item) {
  const queryText = normalizeText(query);
  const queryTokens = new Set(tokens(query));
  if (queryTokens.size < 2) return 0;
  const question = normalizeText(item.question);
  if (queryText === question) return 100;

  let score = question.includes(queryText) && queryText.length >= 8 ? 12 : 0;
  for (const keyword of Array.isArray(item.keywords) ? item.keywords : []) {
    const phrase = normalizeText(keyword);
    const words = tokens(keyword);
    if (!phrase || !words.length) continue;
    if (` ${queryText} `.includes(` ${phrase} `)) {
      score += words.length > 1 ? 8 + Math.min(words.length - 2, 2) : 3;
    } else if (words.length > 1 && words.every((word) => queryTokens.has(word))) {
      score += 6;
    }
  }

  for (const word of new Set(tokens(item.question))) {
    if (word.length > 3 && queryTokens.has(word)) score += 2;
  }
  return score;
}

export function matchPublicFaq(query, faq) {
  if (!Array.isArray(faq) || !faq.length) return null;
  const ranked = faq
    .filter((item) => item && typeof item.question === 'string' && typeof item.answer === 'string')
    .map((item) => ({ item, score: scoreFaq(query, item) }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best || best.score < 6 || (runnerUp && best.score - runnerUp.score < 2)) return null;
  return best.item;
}
