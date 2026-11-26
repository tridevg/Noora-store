export interface SessionPayload {
  sub: string;
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('invalid base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  if (secret.length === 0) throw new Error('SESSION_SECRET is empty');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

/** Token: base64url(JSON payload) + "." + base64url(HMAC-SHA256 over the encoded payload). */
export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, 'sign');
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded)),
  );
  return `${encoded}.${toBase64Url(signature)}`;
}

/** Returns the payload when the MAC is valid and exp is in the future; otherwise null. Never throws. */
export async function verifySession(
  token: string,
  secret: string,
  nowSec: number,
): Promise<SessionPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, signaturePart] = parts as [string, string];
    const signature = fromBase64Url(signaturePart);
    const key = await hmacKey(secret, 'verify');
    // crypto.subtle.verify compares the MAC in constant time.
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(encoded),
    );
    if (!valid) return null;

    const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { sub, exp } = parsed as Record<string, unknown>;
    if (typeof sub !== 'string' || sub.length === 0) return null;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
    if (exp <= nowSec) return null;
    return { sub, exp };
  } catch {
    return null;
  }
}
