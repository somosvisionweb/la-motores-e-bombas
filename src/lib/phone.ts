import { onlyDigits } from './text';

/**
 * Formata progressivamente um telefone brasileiro enquanto o usuário digita.
 * "81996405805" → "(81) 99640-5805" | "8133334444" → "(81) 3333-4444"
 * Números com DDI 55 (12–13 dígitos) são exibidos como "+55 (81) 99640-5805".
 */
export function formatPhoneBR(input: string | null | undefined): string {
  let digits = onlyDigits(input);
  if (!digits) return '';

  let prefix = '';
  if (digits.length > 11 && digits.startsWith('55')) {
    prefix = '+55 ';
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);

  if (digits.length <= 2) return `${prefix}(${digits}`;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `${prefix}(${ddd}) ${rest}`;
  if (digits.length <= 10) return `${prefix}(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `${prefix}(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

/** Retorna o telefone formatado apenas se estiver completo (10–11 dígitos); senão devolve o original. */
export function displayPhone(input: string | null | undefined): string {
  if (!input) return '';
  const digits = onlyDigits(input);
  const national = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11 ? formatPhoneBR(input) : input;
}

/** Telefone/celular brasileiro válido? (10 ou 11 dígitos, com DDD de 11 a 99). */
export function isValidPhoneBR(input: string | null | undefined): boolean {
  const digits = onlyDigits(input);
  const national = digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;
  if (national.length !== 10 && national.length !== 11) return false;
  const ddd = Number(national.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (national.length === 11 && national[2] !== '9') return false;
  return true;
}

/**
 * Converte um telefone para o formato do WhatsApp (somente dígitos, com DDI 55).
 * Retorna null se o número não parecer um telefone brasileiro utilizável.
 */
export function toWhatsAppNumber(input: string | null | undefined): string | null {
  const digits = onlyDigits(input);
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return null;
}

/** Link click-to-chat do WhatsApp (`wa.me`) com mensagem pré-preenchida. */
export function buildWhatsAppUrl(number: string, message?: string): string {
  const digits = onlyDigits(number);
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
