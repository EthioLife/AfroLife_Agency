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

function tokensMatch(left, right) {
  if (left === right) return true;
  const a = Array.from(left);
  const b = Array.from(right);
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;

  let mismatches = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < a.length && rightIndex < b.length) {
    if (a[leftIndex] === b[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    mismatches += 1;
    if (mismatches > 1) return false;
    if (a.length > b.length) leftIndex += 1;
    else if (b.length > a.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  if (leftIndex < a.length || rightIndex < b.length) mismatches += 1;
  return mismatches <= 1;
}

function hasTokenMatch(queryTokens, target) {
  return [...queryTokens].some((queryToken) => tokensMatch(queryToken, target));
}

function scoreFaq(query, item) {
  const queryText = normalizeText(query);
  const queryTokens = new Set(tokens(query));
  const question = normalizeText(item.question);
  if (queryText === question) return 100;

  let score = question.includes(queryText) && queryText.length >= 8 ? 12 : 0;
  for (const keyword of Array.isArray(item.keywords) ? item.keywords : []) {
    const phrase = normalizeText(keyword);
    const words = tokens(keyword);
    if (!phrase || !words.length) continue;
    if (` ${queryText} `.includes(` ${phrase} `)) {
      score += words.length > 1 ? 8 + Math.min(words.length - 2, 2) : 3;
    } else if (words.length > 1 && words.every((word) => hasTokenMatch(queryTokens, word))) {
      score += 6;
    }
  }

  for (const word of new Set(tokens(item.question))) {
    if (word.length > 3 && hasTokenMatch(queryTokens, word)) score += 2;
  }
  return score;
}

function rankPublicFaq(query, faq) {
  if (!Array.isArray(faq) || !faq.length) return [];
  return faq
    .filter((item) => item && typeof item.question === 'string' && typeof item.answer === 'string')
    .map((item) => ({ item, score: scoreFaq(query, item) }))
    .sort((left, right) => right.score - left.score);
}

export function matchPublicFaq(query, faq) {
  const ranked = rankPublicFaq(query, faq);
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (new Set(tokens(query)).size < 2 || !best || best.score < 6
      || (runnerUp && best.score - runnerUp.score < 2)) return null;
  return best.item;
}

export function suggestPublicFaqs(query, faq, limit = 2) {
  const seen = new Set();
  return rankPublicFaq(query, faq)
    .filter(({ score }) => score > 0)
    .filter(({ item }) => {
      const key = item.sourceQuestion ?? item.question;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit)
    .map(({ item }) => item);
}
