import { Tabs } from '@/components/ui/Tabs';

export function FinanceTabs({
  active,
  canOverview,
  canIncome,
  canExpense,
}: {
  active: 'overview' | 'income' | 'expenses' | 'categories';
  canOverview: boolean;
  canIncome: boolean;
  canExpense: boolean;
}) {
  const items = [
    canOverview ? { href: '/sistema/financeiro', label: 'Visão geral', active: active === 'overview' } : null,
    canIncome ? { href: '/sistema/financeiro/entradas', label: 'Entradas', active: active === 'income' } : null,
    canExpense ? { href: '/sistema/financeiro/custos', label: 'Custos', active: active === 'expenses' } : null,
    canExpense ? { href: '/sistema/financeiro/categorias', label: 'Categorias de custo', active: active === 'categories' } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  return (
    <div style={{ marginBottom: 20 }}>
      <Tabs items={items} label="Seções do financeiro" />
    </div>
  );
}
