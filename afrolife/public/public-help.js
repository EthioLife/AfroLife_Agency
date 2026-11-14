const stopWords = new Set([
  'about', 'after', 'are', 'can', 'did', 'does', 'for', 'from', 'get', 'how',
  'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'please', 'the',
  'to', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'with',
]);

function normalizedWords(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\bsign\s+in\b/g, 'signin')
    .replace(/\b(log[\s-]?in)\b/g, 'signin')
    .replace(/\b(two[\s-]?factor|2fa)\b/g, 'mfa')
    .replace(/[^\p{L}\p{N}+ ]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

export function matchPublicFaq(query, faq) {
  if (!Array.isArray(faq) || !faq.length) return null;
  const words = normalizedWords(query);
  if (!words.length) return null;
  const normalizedQuery = words.join(' ');
  let bestMatch = null;
  let bestScore = 0;

  for (const item of faq) {
    if (!item || typeof item.question !== 'string' || typeof item.answer !== 'string') continue;
    const question = normalizedWords(item.question);
    const answer = normalizedWords(item.answer);
    const questionText = question.join(' ');
    const answerText = answer.join(' ');
    let score = 0;
    for (const word of new Set(words)) {
      if (question.includes(word)) score += 3;
      if (answer.includes(word)) score += 1;
    }
    if (normalizedQuery.length > 5 && questionText.includes(normalizedQuery)) score += 6;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}
