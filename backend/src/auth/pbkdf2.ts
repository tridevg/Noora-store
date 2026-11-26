import { constantTimeEqualBytes } from './compare';

/** Workers ceiling for PBKDF2 in Web Crypto (R4). */
export const PBKDF2_ITERATIONS = 100_000;

const ALGORITHM_TAG = 'pbkdf2-sha256';
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
  byteLength: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    byteLength * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Returns `pbkdf2-sha256$<iterations>$<saltB64>$<hashB64>` for a new random 16-byte salt.
 * Production uses the default (100000). The count is stored in the hash, so verifyPassword
 * honours whatever count a stored hash was made with. Only tests pass a lower count.
 */
export async function hashPassword(
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await derive(password, salt, iterations, KEY_BYTES);
  return `${ALGORITHM_TAG}$${iterations}$${toBase64(salt)}$${toBase64(key)}`;
}

/**
 * Verifies a password against a stored hash in constant time.
 * Malformed input, unsupported iteration counts and decode errors return false; never throws.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== ALGORITHM_TAG) return false;
    if (!/^[1-9]\d*$/.test(parts[1] ?? '')) return false;
    const iterations = Number(parts[1]);
    // Refuse counts above the production default so a bad stored value cannot trigger huge work.
    if (iterations > PBKDF2_ITERATIONS) return false;
    const salt = fromBase64(parts[2] ?? '');
    const expected = fromBase64(parts[3] ?? '');
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = await derive(password, salt, iterations, expected.length);
    return constantTimeEqualBytes(actual, expected);
  } catch {
    return false;
  }
}
