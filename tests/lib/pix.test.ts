import { describe, expect, it } from 'vitest';
import { buildPixPayload, crc16, isValidPixPayload, normalizePixKey, sanitizePixText, tlv } from '@/lib/pix';

/** Leitor mínimo de campos EMV (ID de 2 dígitos + tamanho de 2 dígitos + valor). */
function parseTlv(payload: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let index = 0;
  while (index < payload.length) {
    const id = payload.slice(index, index + 2);
    const length = Number(payload.slice(index + 2, index + 4));
    if (!Number.isInteger(length)) throw new Error(`Tamanho inválido em ${index}`);
    fields[id] = payload.slice(index + 4, index + 4 + length);
    index += 4 + length;
  }
  return fields;
}

describe('PIX — CRC e campos', () => {
  it('CRC-16/CCITT-FALSE confere com o valor de referência do padrão ("123456789" → 29B1)', () => {
    expect(crc16('123456789')).toBe('29B1');
    expect(crc16('')).toBe('FFFF');
  });

  it('monta campos com identificador + tamanho + valor e recusa valores longos demais', () => {
    expect(tlv('59', 'ABC')).toBe('5903ABC');
    expect(tlv('00', '01')).toBe('000201');
    expect(() => tlv('59', 'x'.repeat(100))).toThrow();
  });

  it('nome e cidade viram texto simples: maiúsculas, sem acento nem símbolos, com limite de tamanho', () => {
    expect(sanitizePixText('LA Motores e Bombas', 25)).toBe('LA MOTORES E BOMBAS');
    expect(sanitizePixText('Jaboatão dos Guararapes', 15)).toBe('JABOATAO DOS GU');
    expect(sanitizePixText('  José & Filhos — Ltda.  ', 25)).toBe('JOSE FILHOS LTDA');
    expect(sanitizePixText('', 25)).toBe('');
  });
});

describe('PIX — chave', () => {
  it('CPF e CNPJ: só dígitos e dígitos verificadores válidos', () => {
    expect(normalizePixKey('CPF', '529.982.247-25')).toBe('52998224725');
    expect(normalizePixKey('CPF', '111.111.111-11')).toBeNull();
    expect(normalizePixKey('CPF', '529.982.247-26')).toBeNull();
    expect(normalizePixKey('CNPJ', '31.127.662/0001-50')).toBe('31127662000150');
    expect(normalizePixKey('CNPJ', '31.127.662/0001-51')).toBeNull();
  });

  it('telefone vira +55DDDNÚMERO (com ou sem o 55) e e-mail/chave aleatória ficam em minúsculas', () => {
    expect(normalizePixKey('PHONE', '(81) 99640-5805')).toBe('+5581996405805');
    expect(normalizePixKey('PHONE', '5581996405805')).toBe('+5581996405805');
    expect(normalizePixKey('PHONE', '+55 81 99640-5805')).toBe('+5581996405805');
    expect(normalizePixKey('PHONE', '12345')).toBeNull();
    expect(normalizePixKey('EMAIL', ' Contato@Empresa.com.br ')).toBe('contato@empresa.com.br');
    expect(normalizePixKey('EMAIL', 'sem-arroba')).toBeNull();
    expect(normalizePixKey('RANDOM', '123E4567-E89B-12D3-A456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(normalizePixKey('RANDOM', 'nao-e-uuid')).toBeNull();
    expect(normalizePixKey('CPF', '   ')).toBeNull();
  });
});

describe('PIX — código "copia e cola"', () => {
  const payload = buildPixPayload({ key: '+5581996405805', name: 'LA Motores e Bombas', city: 'Jaboatão dos Guararapes', amountCents: 12345, txid: 'LJ000012' });

  it('tem a estrutura EMV do BR Code: formato, chave PIX, valor, país, recebedor, cidade e identificador', () => {
    const fields = parseTlv(payload);
    expect(fields['00']).toBe('01');
    expect(fields['01']).toBe('11');
    expect(parseTlv(fields['26']!)).toEqual({ '00': 'br.gov.bcb.pix', '01': '+5581996405805' });
    expect(fields['52']).toBe('0000');
    expect(fields['53']).toBe('986');
    expect(fields['54']).toBe('123.45');
    expect(fields['58']).toBe('BR');
    expect(fields['59']).toBe('LA MOTORES E BOMBAS');
    expect(fields['60']).toBe('JABOATAO DOS GU');
    expect(parseTlv(fields['62']!)).toEqual({ '05': 'LJ000012' });
    expect(fields['63']).toMatch(/^[0-9A-F]{4}$/);
  });

  it('o CRC final confere e qualquer alteração no código o invalida', () => {
    expect(isValidPixPayload(payload)).toBe(true);
    expect(payload.startsWith('000201')).toBe(true);
    const tampered = payload.replace('123.45', '923.45');
    expect(isValidPixPayload(tampered)).toBe(false);
    expect(isValidPixPayload(payload.slice(0, -1))).toBe(false);
    expect(isValidPixPayload('')).toBe(false);
  });

  it('sem valor o campo 54 é omitido; sem identificador usa "***"; identificador só com letras e números', () => {
    const open = parseTlv(buildPixPayload({ key: 'a@b.co', name: 'X', city: 'Y' }));
    expect(open['54']).toBeUndefined();
    expect(parseTlv(open['62']!)).toEqual({ '05': '***' });
    const cleaned = parseTlv(buildPixPayload({ key: 'a@b.co', name: 'X', city: 'Y', txid: 'LJ-00 12!' }));
    expect(parseTlv(cleaned['62']!)).toEqual({ '05': 'LJ0012' });
  });

  it('valores em centavos viram reais com ponto e 2 casas (sem erro de ponto flutuante)', () => {
    for (const [cents, text] of [[1, '0.01'], [10, '0.10'], [100, '1.00'], [1999, '19.99'], [123456789, '1234567.89']] as const) {
      expect(parseTlv(buildPixPayload({ key: 'k@k.co', name: 'N', city: 'C', amountCents: cents }))['54']).toBe(text);
    }
  });
});
