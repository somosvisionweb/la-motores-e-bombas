import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  addMonthsISO,
  bucketFor,
  bucketsBetween,
  bucketStart,
  dateOnlyInTimezone,
  diffDaysISO,
  eachDayISO,
  endOfMonthISO,
  formatDateBR,
  isISODate,
  resolvePeriod,
  startOfMonthISO,
  todayISO,
} from '@/lib/dates';

describe('datas ISO', () => {
  it('valida calendário', () => {
    expect(isISODate('2026-09-24')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('24/09/2026')).toBe(false);
    expect(isISODate(null)).toBe(false);
  });

  it('soma dias e meses respeitando fim de mês', () => {
    expect(addDaysISO('2026-09-24', 7)).toBe('2026-10-01');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2026-03-15', -3)).toBe('2025-12-15');
  });

  it('início e fim de mês', () => {
    expect(startOfMonthISO('2026-09-24')).toBe('2026-09-01');
    expect(endOfMonthISO('2026-09-24')).toBe('2026-09-30');
    expect(endOfMonthISO('2028-02-10')).toBe('2028-02-29');
  });

  it('diferença e lista de dias', () => {
    expect(diffDaysISO('2026-09-01', '2026-09-24')).toBe(23);
    expect(eachDayISO('2026-09-28', '2026-10-02')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it('formata no padrão brasileiro', () => {
    expect(formatDateBR('2026-09-24')).toBe('24/09/2026');
    expect(formatDateBR(null)).toBe('—');
  });
});

describe('fuso horário da empresa', () => {
  it('usa America/Recife (UTC-3) para "hoje"', () => {
    // 02:00 UTC de 25/09 ainda é 23:00 de 24/09 em Recife
    expect(dateOnlyInTimezone(new Date('2026-09-25T02:00:00Z'), 'America/Recife')).toBe('2026-09-24');
    expect(todayISO('America/Recife', new Date('2026-09-25T03:00:00Z'))).toBe('2026-09-25');
  });
});

describe('resolvePeriod', () => {
  const today = '2026-09-24';
  it('hoje / 7d / 30d', () => {
    expect(resolvePeriod('hoje', today)).toMatchObject({ from: '2026-09-24', to: '2026-09-24', days: 1 });
    expect(resolvePeriod('7d', today)).toMatchObject({ from: '2026-09-18', to: '2026-09-24', days: 7 });
    expect(resolvePeriod('30d', today)).toMatchObject({ from: '2026-08-26', to: '2026-09-24', days: 30 });
  });
  it('este mês e mês anterior', () => {
    expect(resolvePeriod('mes', today)).toMatchObject({ from: '2026-09-01', to: '2026-09-24' });
    expect(resolvePeriod('mes-anterior', today)).toMatchObject({ from: '2026-08-01', to: '2026-08-31', days: 31 });
    expect(resolvePeriod('mes-anterior', '2026-01-10')).toMatchObject({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('personalizado válido, invertido e inválido', () => {
    expect(resolvePeriod('personalizado', today, { from: '2026-09-01', to: '2026-09-10' })).toMatchObject({
      key: 'personalizado',
      from: '2026-09-01',
      to: '2026-09-10',
    });
    expect(resolvePeriod('personalizado', today, { from: '2026-09-10', to: '2026-09-01' })).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-10',
    });
    expect(resolvePeriod('personalizado', today, { from: 'x', to: 'y' }).key).toBe('30d');
  });
  it('chave desconhecida cai em 30 dias', () => {
    expect(resolvePeriod('qualquer', today).key).toBe('30d');
  });
});

describe('buckets de série temporal', () => {
  it('escolhe granularidade', () => {
    expect(bucketFor(7)).toBe('day');
    expect(bucketFor(90)).toBe('week');
    expect(bucketFor(365)).toBe('month');
  });
  it('início da semana é segunda-feira', () => {
    expect(bucketStart('2026-09-24', 'week')).toBe('2026-09-21'); // quinta → segunda
    expect(bucketStart('2026-09-27', 'week')).toBe('2026-09-21'); // domingo
    expect(bucketStart('2026-09-24', 'month')).toBe('2026-09-01');
  });
  it('lista contínua de buckets', () => {
    expect(bucketsBetween('2026-09-10', '2026-09-30', 'week')).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
    expect(bucketsBetween('2026-07-15', '2026-09-02', 'month')).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
  });
});
