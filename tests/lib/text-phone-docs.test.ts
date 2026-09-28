import { describe, expect, it } from 'vitest';
import { applyTemplate, escapeLike, initials, normalizeSearch, onlyDigits, slugify } from '@/lib/text';
import { buildWhatsAppUrl, displayPhone, formatPhoneBR, isValidPhoneBR, toWhatsAppNumber } from '@/lib/phone';
import { formatCpfCnpj, isValidCnpj, isValidCpf, isValidCpfOrCnpj } from '@/lib/document-id';
import { formatOrderCode, parseOrderCode, parseSaleCode } from '@/lib/codes';

describe('texto', () => {
  it('normaliza busca sem acento', () => {
    expect(normalizeSearch('  João   da SILVA ')).toBe('joao da silva');
    expect(normalizeSearch('Manutenção de Bomba Centrífuga')).toBe('manutencao de bomba centrifuga');
    expect(normalizeSearch(null)).toBe('');
  });
  it('extrai dígitos e escapa LIKE', () => {
    expect(onlyDigits('(81) 99640-5805')).toBe('81996405805');
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
  it('slug e iniciais', () => {
    expect(slugify('Rebobinamento de Motores Elétricos')).toBe('rebobinamento-de-motores-eletricos');
    expect(initials('Ewerton Nunes')).toBe('EN');
    expect(initials('Mario')).toBe('MA');
  });
  it('template com placeholders', () => {
    expect(applyTemplate('Olá, {{nome}}! {{empresa}}', { nome: 'Ana', empresa: 'LA' })).toBe('Olá, Ana! LA');
    expect(applyTemplate('{{x}}|{{ y }}', { y: 2 })).toBe('|2');
  });
});

describe('telefone e WhatsApp', () => {
  it('aplica máscara progressiva', () => {
    expect(formatPhoneBR('8')).toBe('(8');
    expect(formatPhoneBR('81')).toBe('(81');
    expect(formatPhoneBR('81996')).toBe('(81) 996');
    expect(formatPhoneBR('81996405805')).toBe('(81) 99640-5805');
    expect(formatPhoneBR('8133334444')).toBe('(81) 3333-4444');
    expect(formatPhoneBR('5581996405805')).toBe('+55 (81) 99640-5805');
    expect(formatPhoneBR('')).toBe('');
  });
  it('valida telefones', () => {
    expect(isValidPhoneBR('(81) 99640-5805')).toBe(true);
    expect(isValidPhoneBR('(81) 3333-4444')).toBe(true);
    expect(isValidPhoneBR('(81) 89640-5805')).toBe(false); // celular precisa começar com 9
    expect(isValidPhoneBR('123')).toBe(false);
  });
  it('exibe somente números completos formatados', () => {
    expect(displayPhone('81996405805')).toBe('(81) 99640-5805');
    expect(displayPhone('ramal 12')).toBe('ramal 12');
  });
  it('gera número e link do WhatsApp', () => {
    expect(toWhatsAppNumber('(81) 99640-5805')).toBe('5581996405805');
    expect(toWhatsAppNumber('5581996405805')).toBe('5581996405805');
    expect(toWhatsAppNumber('123')).toBeNull();
    expect(buildWhatsAppUrl('5581996405805', 'Olá! Gostaria de solicitar um atendimento.')).toBe(
      'https://wa.me/5581996405805?text=Ol%C3%A1!%20Gostaria%20de%20solicitar%20um%20atendimento.',
    );
    expect(buildWhatsAppUrl('+55 (81) 99640-5805')).toBe('https://wa.me/5581996405805');
  });
});

describe('CPF / CNPJ', () => {
  it('valida CPF', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
  });
  it('valida CNPJ (inclusive o da empresa)', () => {
    expect(isValidCnpj('31.127.662/0001-50')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
  });
  it('detecta tipo pelo tamanho', () => {
    expect(isValidCpfOrCnpj('52998224725')).toBe(true);
    expect(isValidCpfOrCnpj('123')).toBe(false);
  });
  it('aplica máscara', () => {
    expect(formatCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(formatCpfCnpj('31127662000150')).toBe('31.127.662/0001-50');
    expect(formatCpfCnpj('5299')).toBe('529.9');
  });
});

describe('códigos', () => {
  it('formata e interpreta código de OS', () => {
    expect(formatOrderCode(123)).toBe('OS-000123');
    expect(parseOrderCode('OS-000123')).toBe(123);
    expect(parseOrderCode('os123')).toBe(123);
    expect(parseOrderCode('#45')).toBe(45);
    expect(parseOrderCode('123')).toBe(123);
    expect(parseOrderCode('João')).toBeNull();
    expect(parseOrderCode('0')).toBeNull();
    expect(parseSaleCode('VD-000010')).toBe(10);
    expect(parseSaleCode('123')).toBeNull();
  });
});
