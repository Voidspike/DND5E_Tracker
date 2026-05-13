/**
 * Simple XSS sanitization middleware.
 * Strips HTML tags from string fields in req.body to prevent stored XSS.
 * Applied to chat messages, token names, character names, etc.
 */

const HTML_TAG_RE = /<[^>]*>/g;

function sanitizeValue(val: unknown): unknown {
  if (typeof val === 'string') {
    return val.replace(HTML_TAG_RE, '');
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val && typeof val === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      sanitized[k] = sanitizeValue(v);
    }
    return sanitized;
  }
  return val;
}

export function sanitizeBody(req: { body?: unknown }, _res: unknown, next: () => void): void {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  next();
}
