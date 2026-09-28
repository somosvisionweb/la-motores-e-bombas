import { describe, expect, it } from 'vitest';
import { computeOrderTotals, paymentSummary } from '@/lib/order-totals';
import { statusChangeDates } from '@/lib/order-flow';
import { nextSuggestedStatus, ORDER_FLOW, ORDER_STATUS, ORDER_STATUS_KEYS } from '@/config/order-status';
import { parseTermsMarkup } from '@/lib/terms-markup';
import { DEFAULT_TERMS_CONTENT } from '@/config/guarantee-terms-default';
import { groupBusinessHours } from '@/lib/company';
import { OFFICIAL_HOURS } from '@/config/company-defaults';

describe('totais da OS', () => {
  it('separa peças e mão de obra e aplica desconto', () => {
    const totals = computeOrderTotals(
      [
        { kind: 'SERVICE', quantity: 1, unitPriceCents: 18000 },
        { kind: 'PART', quantity: 2, unitPriceCents: 3500 },
        { kind: 'PART', quantity: 1, unitPriceCents: 1250 },
      ],
      1000,
    );
    expect(totals).toEqual({ partsTotalCents: 8250, laborTotalCents: 18000, subtotalCents: 26250, discountCents: 1000, totalCents: 25250 });
  });
  it('desconto nunca passa do subtotal e nunca é negativo', () => {
    const items = [{ kind: 'SERVICE' as const, quantity: 1, unitPriceCents: 5000 }];
    expect(computeOrderTotals(items, 999999).totalCents).toBe(0);
    expect(computeOrderTotals(items, -50).totalCents).toBe(5000);
  });
  it('sem itens o total é zero', () => {
    expect(computeOrderTotals([], 0).totalCents).toBe(0);
  });
  it('resumo de pagamento', () => {
    expect(paymentSummary(10000, 0)).toMatchObject({ state: 'PENDING', balanceCents: 10000 });
    expect(paymentSummary(10000, 4000)).toMatchObject({ state: 'PARTIAL', balanceCents: 6000 });
    expect(paymentSummary(10000, 10000)).toMatchObject({ state: 'PAID', balanceCents: 0 });
    expect(paymentSummary(0, 0).state).toBe('NONE');
  });
});

describe('fluxo de status', () => {
  const today = '2026-09-24';
  it('Pronto registra a conclusão', () => {
    expect(statusChangeDates('PRONTO', { completedDate: null, deliveredDate: null }, today)).toEqual({ completedDate: today, deliveredDate: null });
  });
  it('Entregue registra conclusão e entrega, preservando datas existentes', () => {
    expect(statusChangeDates('ENTREGUE', { completedDate: '2026-09-20', deliveredDate: null }, today)).toEqual({ completedDate: '2026-09-20', deliveredDate: today });
  });
  it('voltar para manutenção limpa as datas', () => {
    expect(statusChangeDates('EM_MANUTENCAO', { completedDate: '2026-09-20', deliveredDate: today }, today)).toEqual({ completedDate: null, deliveredDate: null });
  });
  it('cancelar não altera as datas', () => {
    expect(statusChangeDates('CANCELADO', { completedDate: null, deliveredDate: null }, today)).toEqual({ completedDate: null, deliveredDate: null });
  });
  it('próxima etapa sugerida segue o fluxo', () => {
    expect(nextSuggestedStatus('AGUARDANDO_AVALIACAO')).toBe('EM_ANALISE');
    expect(nextSuggestedStatus('AGUARDANDO_PECA')).toBe('EM_MANUTENCAO');
    expect(nextSuggestedStatus('PRONTO')).toBe('ENTREGUE');
    expect(nextSuggestedStatus('ENTREGUE')).toBeNull();
  });
  it('todos os status têm rótulo e o fluxo é subconjunto dos status', () => {
    for (const key of ORDER_STATUS_KEYS) expect(ORDER_STATUS[key].label).toBeTruthy();
    for (const step of ORDER_FLOW) expect(ORDER_STATUS_KEYS).toContain(step);
  });
});

describe('termos de garantia', () => {
  it('interpreta o texto oficial e aplica o prazo', () => {
    const blocks = parseTermsMarkup(DEFAULT_TERMS_CONTENT, 3);
    const clauses = blocks.filter((b) => b.type === 'clause');
    expect(clauses).toHaveLength(5);
    expect(clauses[0]).toMatchObject({ text: '1. Prazo de garantia' });
    const first = blocks.find((b) => b.type === 'paragraph');
    expect(first && 'text' in first && first.text).toContain('garantia de 3 (três) meses, contados a partir da data de realização do serviço');
    const bullets = blocks.find((b) => b.type === 'bullets');
    expect(bullets && 'items' in bullets && bullets.items).toHaveLength(8);
    expect(blocks[blocks.length - 1]).toEqual({ type: 'highlight', text: 'Garantia: 3 (três) meses.' });
    expect(blocks.some((b) => b.type === 'subheading' && b.text === 'Declaração do cliente')).toBe(true);
  });
  it('o prazo configurado altera o texto', () => {
    const blocks = parseTermsMarkup(DEFAULT_TERMS_CONTENT, 6);
    expect(blocks[blocks.length - 1]).toEqual({ type: 'highlight', text: 'Garantia: 6 (seis) meses.' });
  });
});

describe('horário de funcionamento', () => {
  it('agrupa dias consecutivos como no briefing', () => {
    const groups = groupBusinessHours(OFFICIAL_HOURS);
    expect(groups.map((g) => `${g.label}: ${g.value}`)).toEqual([
      'Segunda a sexta: 08:00 às 17:00',
      'Sábado: 08:00 às 12:00',
      'Domingo: Fechado',
    ]);
  });
});
