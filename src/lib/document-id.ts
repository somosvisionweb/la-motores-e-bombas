import { onlyDigits } from './text';

/** Máscara progressiva para CPF (11 dígitos) ou CNPJ (14 dígitos). */
export function formatCpfCnpj(input: string | null | undefined): string {
  const d = onlyDigits(input).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

function allEqual(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

export function isValidCpf(input: string): boolean {
  const d = onlyDigits(input);
  if (d.length !== 11 || allEqual(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(input: string): boolean {
  const d = onlyDigits(input);
  if (d.length !== 14 || allEqual(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i]!;
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** CPF ou CNPJ válido (11 ou 14 dígitos). */
export function isValidCpfOrCnpj(input: string | null | undefined): boolean {
  const d = onlyDigits(input);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}
