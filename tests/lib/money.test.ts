import { describe, expect, it } from 'vitest';
import { formatBRL, formatDecimalBR, lineTotal, parseBRLToCents, percentOf } from '@/lib/money';
import { formatMonthsInWords, moneyToWords, numberToWords } from '@/lib/money-words';

describe('formatBRL', () => {
  it('formata centavos em reais', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(5)).toBe('R$ 0,05');
    expect(formatBRL(null)).toBe('R$ 0,00');
  });
  it('formata negativos', () => {
    expect(formatBRL(-2500)).toBe('-R$ 25,00');
  });
  it('formata decimal sem símbolo', () => {
    expect(formatDecimalBR(1050)).toBe('10,50');
  });
});

describe('parseBRLToCents', () => {
  it.each([
    ['R$ 1.234,56', 123456],
    ['1234,56', 123456],
    ['1234,5', 123450],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['12', 1200],
    ['0,99', 99],
    ['', null],
    ['abc', null],
    ['-10,00', -1000],
  ])('interpreta %s', (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });
  it('aceita número', () => {
    expect(parseBRLToCents(10.5)).toBe(1050);
  });
});

describe('cálculos', () => {
  it('lineTotal arredonda para inteiro', () => {
    expect(lineTotal(3, 1050)).toBe(3150);
    expect(lineTotal(1, 0)).toBe(0);
  });
  it('percentOf trata divisão por zero', () => {
    expect(percentOf(1, 0)).toBe(0);
    expect(percentOf(1, 3)).toBe(33.3);
  });
});

describe('numberToWords / moneyToWords', () => {
  it.each([
    [0, 'zero'],
    [1, 'um'],
    [15, 'quinze'],
    [21, 'vinte e um'],
    [100, 'cem'],
    [101, 'cento e um'],
    [999, 'novecentos e noventa e nove'],
    [1000, 'mil'],
    [1001, 'mil e um'],
    [1100, 'mil e cem'],
    [1234, 'mil duzentos e trinta e quatro'],
    [2500, 'dois mil e quinhentos'],
    [12000, 'doze mil'],
    [101000, 'cento e um mil'],
    [1_000_000, 'um milhão'],
    [2_000_001, 'dois milhões e um'],
    [1_500_000, 'um milhão e quinhentos mil'],
  ])('%i → %s', (n, words) => {
    expect(numberToWords(n)).toBe(words);
  });

  it.each([
    [0, 'zero reais'],
    [100, 'um real'],
    [150, 'um real e cinquenta centavos'],
    [1, 'um centavo'],
    [99, 'noventa e nove centavos'],
    [25000, 'duzentos e cinquenta reais'],
    [123456, 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos'],
    [100_000_000, 'um milhão de reais'],
  ])('%i centavos → %s', (cents, words) => {
    expect(moneyToWords(cents)).toBe(words);
  });

  it('prazo de garantia', () => {
    expect(formatMonthsInWords(3)).toBe('3 (três) meses');
    expect(formatMonthsInWords(1)).toBe('1 (um) mês');
    expect(formatMonthsInWords(12)).toBe('12 (doze) meses');
  });

  it('rejeita valores inválidos', () => {
    expect(() => numberToWords(-1)).toThrow();
    expect(() => moneyToWords(1.5)).toThrow();
  });
});
