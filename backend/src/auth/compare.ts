/** Constant-time string equality (no early exit on content mismatch). */
export function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  return constantTimeEqualBytes(enc.encode(a), enc.encode(b));
}

/** Constant-time byte equality. Always scans the longer input. */
export function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
