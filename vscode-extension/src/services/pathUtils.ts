import { createHash } from 'crypto';

export function safePathToken(value: string): string {
  if (/^[A-Za-z0-9_-]+$/.test(value)) {
    return value;
  }

  const sanitized = value.replace(/[^A-Za-z0-9_-]/g, '-');
  const suffix = createHash('sha1').update(value).digest('hex').slice(0, 8);
  return `${sanitized}-${suffix}`;
}
