import { createHmac, timingSafeEqual } from 'node:crypto';
type Ticket = { kind: 'job'; id: string } | { kind: 'audio'; url: string };
function secret() { const key = process.env.PIXAZO_API_KEY; if (!key) throw new Error('Add PIXAZO_API_KEY to your Vercel environment variables to generate music.'); return key; }
export function signTicket(value: Ticket): string {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}
export function verifyTicket(value: string, kind: Ticket['kind']): Ticket {
  if (value.length > 16000) throw new Error('Invalid track reference.');
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) throw new Error('Invalid track reference.');
  const expected = createHmac('sha256', secret()).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid track reference.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Ticket;
  if (decoded.kind !== kind || (decoded.kind === 'job' && !/^[a-zA-Z0-9_-]{1,200}$/.test(decoded.id)) || (decoded.kind === 'audio' && !validMediaUrl(decoded.url))) throw new Error('Invalid track reference.');
  return decoded;
}
export function validMediaUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && (u.hostname.endsWith('.r2.dev') || u.hostname.endsWith('.pixazo.ai') || u.hostname.endsWith('.r2.cloudflarestorage.com'));
  } catch { return false; }
}
