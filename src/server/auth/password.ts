/**
 * Senhas: hash com scrypt (nativo do Node, memory-hard) + salt aleatório por usuário.
 * Formato armazenado: `scrypt$N$r$p$saltBase64$hashBase64`. Nunca se guarda a senha em texto.
 */
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * 1024 * 1024;

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, keyLength, options, (error, derived) =>
      error ? reject(error) : resolve(derived),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEMORY });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

interface ParsedHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  // Limites de sanidade: impedem que um hash adulterado force custo absurdo de CPU/memória.
  if (!Number.isInteger(n) || n < 2 ** 12 || n > 2 ** 20 || (n & (n - 1)) !== 0) return null;
  if (!Number.isInteger(r) || r < 1 || r > 16 || !Number.isInteger(p) || p < 1 || p > 4) return null;
  if (128 * n * r > MAX_MEMORY) return null;
  const salt = Buffer.from(parts[4]!, 'base64');
  const hash = Buffer.from(parts[5]!, 'base64');
  if (salt.length < 8 || hash.length < 16) return null;
  return { n, r, p, salt, hash };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const derived = await scrypt(password, parsed.salt, parsed.hash.length, {
    N: parsed.n,
    r: parsed.r,
    p: parsed.p,
    maxmem: MAX_MEMORY,
  });
  return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
}

/** Hash com custo padrão, usado para igualar o tempo de resposta quando o usuário não existe. */
let dummyHashPromise: Promise<string> | null = null;
export async function verifyDummyPassword(password: string): Promise<void> {
  dummyHashPromise ??= hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(password, await dummyHashPromise);
}

/** Retorna a mensagem de erro (em português) ou null se a senha for aceitável. */
export function validatePasswordStrength(password: string, context: { username?: string; name?: string } = {}): string | null {
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (password.length > 128) return 'A senha deve ter no máximo 128 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return 'Use letras e números na senha.';
  const lower = password.toLowerCase();
  if (context.username && lower.includes(context.username.toLowerCase())) return 'A senha não pode conter o nome de usuário.';
  if (/^(12345678|123456789|1234567890|senha123|password1|qwerty123)$/i.test(password)) return 'Escolha uma senha menos previsível.';
  return null;
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Senha temporária legível (sem caracteres ambíguos), ex.: "Kx7m-Qp4v-Ht9d". */
export function generateTemporaryPassword(): string {
  const chunk = () =>
    Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('');
  return `${chunk()}-${chunk()}-${chunk()}`;
}
