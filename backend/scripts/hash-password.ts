// Prints a PBKDF2 hash for an admin password. The password is read from stdin.
// Usage: printf '%s' 'my-password' | npx tsx backend/scripts/hash-password.ts
// One trailing newline is stripped, so `echo` input works too.
import { hashPassword } from '../src/auth/pbkdf2';

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) {
  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
}
const password = Buffer.concat(chunks)
  .toString('utf8')
  .replace(/\r?\n$/, '');

if (password.length === 0) {
  console.error('No password on stdin.');
  process.exit(1);
}

console.log(await hashPassword(password));
