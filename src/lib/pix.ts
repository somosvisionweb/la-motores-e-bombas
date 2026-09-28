/**
 * PIX "copia e cola" / QR Code estático (BR Code, padrão EMV QRCPS-MPM do Banco Central).
 *
 * O código é gerado localmente com a chave PIX cadastrada pela empresa: nenhum dado sai do servidor e
 * nenhuma taxa/intermediário é envolvido. O pagamento cai direto na conta da chave; a confirmação é
 * feita manualmente pela equipe (não há como o sistema "ouvir" o banco sem um provedor de pagamentos).
 */
import type { PixKeyType } from '@/config/store';

/** CRC-16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF) em hexadecimal maiúsculo com 4 dígitos. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Campo EMV: identificador (2 dígitos) + tamanho (2 dígitos) + valor. */
export function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Campo PIX ${id} muito longo.`);
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** Texto aceito nos campos de nome/cidade: maiúsculas ASCII, sem acentos, sem símbolos. */
export function sanitizePixText(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * weights[i]!;
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/**
 * Converte a chave digitada para o formato do BR Code (ou null se for inválida para o tipo escolhido):
 * CPF/CNPJ só dígitos · telefone "+55DDDNÚMERO" · e-mail minúsculo · chave aleatória (UUID) minúscula.
 */
export function normalizePixKey(type: PixKeyType, raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  switch (type) {
    case 'CPF': {
      const digits = value.replace(/\D/g, '');
      return isValidCpf(digits) ? digits : null;
    }
    case 'CNPJ': {
      const digits = value.replace(/\D/g, '');
      return isValidCnpj(digits) ? digits : null;
    }
    case 'PHONE': {
      let digits = value.replace(/\D/g, '');
      if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
      return /^\d{10,11}$/.test(digits) ? `+55${digits}` : null;
    }
    case 'EMAIL': {
      const email = value.toLowerCase();
      return EMAIL_RE.test(email) && email.length <= 77 ? email : null;
    }
    case 'RANDOM':
      return UUID_RE.test(value) ? value.toLowerCase() : null;
  }
}

export interface PixPayloadInput {
  /** Chave já normalizada (ver `normalizePixKey`). */
  key: string;
  /** Nome do recebedor (até 25 caracteres, é sanitizado). */
  name: string;
  /** Cidade do recebedor (até 15 caracteres, é sanitizada). */
  city: string;
  /** Valor em centavos. Omitido/zero = o cliente digita o valor. */
  amountCents?: number | null;
  /** Identificador da cobrança (letras e números, até 25). */
  txid?: string | null;
}

/** Monta o "copia e cola" completo (com CRC). */
export function buildPixPayload(input: PixPayloadInput): string {
  const name = sanitizePixText(input.name, 25) || 'RECEBEDOR';
  const city = sanitizePixText(input.city, 15) || 'BRASIL';
  const txid = (input.txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  const merchantAccount = tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', input.key));
  const amount = input.amountCents && input.amountCents > 0 ? tlv('54', (input.amountCents / 100).toFixed(2)) : '';

  const body =
    tlv('00', '01') +
    tlv('01', '11') +
    merchantAccount +
    tlv('52', '0000') +
    tlv('53', '986') +
    amount +
    tlv('58', 'BR') +
    tlv('59', name) +
    tlv('60', city) +
    tlv('62', tlv('05', txid)) +
    '6304';
  return body + crc16(body);
}

/** Confere o CRC de um código (usado em testes e para validar payloads guardados). */
export function isValidPixPayload(payload: string): boolean {
  if (payload.length < 8 || !payload.startsWith('000201')) return false;
  const body = payload.slice(0, -4);
  return body.endsWith('6304') && crc16(body) === payload.slice(-4).toUpperCase();
}
