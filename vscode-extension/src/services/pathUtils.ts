import { createHash } from 'crypto';

export function safePathToken(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_-]/g, '-');
  if (/[A-Za-z0-9_]/.test(sanitized)) {
    return sanitized;
  }

  const suffix = createHash('sha1').update(value).digest('hex').slice(0, 8);
  return `project-${suffix}`;
}
