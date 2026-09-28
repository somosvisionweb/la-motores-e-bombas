import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';
import { DemoBadge, PaymentStateBadge, StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { SortHeader } from '@/components/ui/SortHeader';
import { Segmented } from '@/components/ui/Tabs';
import { FilterBar, FilterSelect, SearchField } from '@/components/system/FilterBar';
import { IN_PROGRESS_ORDER_STATUSES, ORDER_STATUS, ORDER_STATUS_KEYS } from '@/config/order-status';
import { formatOrderCode } from '@/lib/codes';
import { formatDateBR, isISODate, todayISO } from '@/lib/dates';
import { buildHref, param, parsePage, parseSort, type SearchParams } from '@/lib/query';
import { joinParts } from '@/lib/text';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listOrders, ORDER_SORT_KEYS } from '@/server/services/orders';
import { getCompanySettings } from '@/server/services/settings';
import { listTechnicianOptions } from '@/server/services/users';

export const metadata = { title: 'Ordens de Serviço' };

const DEADLINE_LABEL = { atrasadas: 'Prazo vencido', proximas: 'Prazo próximo', retorno: 'Retorno previsto' } as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('orders.view');
  const params = await searchParams;
  const company = await getCompanySettings();
  const today = todayISO(company.timezone);

  const q = param(params, 'q');
  const status = param(params, 'status');
  const technician = Number(param(params, 'tecnico')) || undefined;
  const payment = param(params, 'pagamento') as 'pendente' | 'parcial' | 'pago' | '';
  const deadline = param(params, 'prazo') as keyof typeof DEADLINE_LABEL | '';
  const from = param(params, 'de');
  const to = param(params, 'ate');
  const page = parsePage(params);
  const sort = parseSort(params, ORDER_SORT_KEYS, { key: 'number', dir: 'desc' });
  const canSeePayments = hasPermission(user, 'payments.view');

  const [{ rows, total }, technicians] = await Promise.all([
    listOrders({
      q,
      status: status || undefined,
      technicianId: technician,
      payment: canSeePayments && ['pendente', 'parcial', 'pago'].includes(payment) ? (payment as 'pendente') : undefined,
      deadline: deadline in DEADLINE_LABEL ? (deadline as keyof typeof DEADLINE_LABEL) : undefined,
      from: isISODate(from) ? from : undefined,
      to: isISODate(to) ? to : undefined,
      today,
      sort: sort.key,
      dir: sort.dir,
      page,
    }),
    listTechnicianOptions(),
  ]);

  const basePath = '/sistema/ordens';
  const hasFilters = Boolean(q || status || technician || payment || deadline || from || to);
  const quick = [
    { label: 'Todas', value: '' },
    { label: 'Em andamento', value: 'abertas' },
    { label: 'Aguardando aprovação', value: 'AGUARDANDO_APROVACAO' },
    { label: 'Prontas', value: 'PRONTO' },
    { label: 'Encerradas', value: 'encerradas' },
  ];

  return (
    <>
      <PageHeader
        title="Ordens de Serviço"
        subtitle="Acompanhe cada atendimento, do recebimento do equipamento à entrega."
        actions={
          hasPermission(user, 'orders.create') ? (
            <Link href={`${basePath}/nova`} className="btn btn--primary">
              <Plus aria-hidden="true" /> Nova OS
            </Link>
          ) : null
        }
      />

      <div style={{ marginBottom: 16 }} className="cluster">
        <Segmented
          label="Filtro rápido por situação"
          items={quick.map((item) => ({
            href: buildHref(basePath, params, { status: item.value, pagina: null }),
            label: item.label,
            active: status === item.value,
          }))}
        />
        {deadline in DEADLINE_LABEL ? (
          <Link href={buildHref(basePath, params, { prazo: null })} className="badge badge--tone-amber" title="Remover filtro">
            {DEADLINE_LABEL[deadline as keyof typeof DEADLINE_LABEL]} ✕
          </Link>
        ) : null}
      </div>

      <Card>
        <FilterBar clearHref={basePath} hasFilters={hasFilters} keep={{ ordem: param(params, 'ordem'), dir: param(params, 'dir'), prazo: deadline || undefined }}>
          <SearchField defaultValue={q} placeholder="OS-000123, cliente, telefone, equipamento…" />
          <FilterSelect
            name="status"
            label="Status"
            defaultValue={status}
            options={[
              { value: 'abertas', label: 'Em andamento (todas)' },
              { value: 'encerradas', label: 'Encerradas' },
              ...ORDER_STATUS_KEYS.map((s) => ({ value: s, label: ORDER_STATUS[s].label })),
            ]}
          />
          <FilterSelect name="tecnico" label="Técnico" defaultValue={technician ? String(technician) : ''} options={technicians.map((t) => ({ value: String(t.id), label: t.name }))} />
          {canSeePayments ? (
            <FilterSelect
              name="pagamento"
              label="Pagamento"
              defaultValue={payment}
              options={[
                { value: 'pendente', label: 'Pendente' },
                { value: 'parcial', label: 'Parcial' },
                { value: 'pago', label: 'Pago' },
              ]}
            />
          ) : null}
          <div className="field">
            <label className="field__label" htmlFor="f-de">
              Entrada de
            </label>
            <input id="f-de" name="de" type="date" className="input" defaultValue={isISODate(from) ? from : ''} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="f-ate">
              até
            </label>
            <input id="f-ate" name="ate" type="date" className="input" defaultValue={isISODate(to) ? to : ''} />
          </div>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={26} aria-hidden="true" />}
            title={hasFilters ? 'Nenhuma ordem encontrada' : 'Nenhuma ordem de serviço ainda'}
            action={
              hasPermission(user, 'orders.create') && !hasFilters ? (
                <Link href={`${basePath}/nova`} className="btn btn--primary">
                  <Plus aria-hidden="true" /> Criar a primeira OS
                </Link>
              ) : undefined
            }
          >
            {hasFilters ? 'Ajuste ou limpe os filtros para ver mais resultados.' : 'As ordens criadas aparecerão aqui.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <SortHeader label="OS" sortKey="number" current={sort} basePath={basePath} params={params} />
                  <SortHeader label="Cliente" sortKey="customer" current={sort} basePath={basePath} params={params} />
                  <th scope="col">Equipamento</th>
                  <SortHeader label="Entrada" sortKey="entry" current={sort} basePath={basePath} params={params} className="col-hide-md" />
                  <SortHeader label="Previsão" sortKey="expected" current={sort} basePath={basePath} params={params} />
                  <SortHeader label="Status" sortKey="status" current={sort} basePath={basePath} params={params} />
                  <SortHeader label="Total" sortKey="total" current={sort} basePath={basePath} params={params} numeric />
                  {canSeePayments ? (
                    <th scope="col" className="col-hide-md">
                      Pagamento
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const overdue = o.expectedDeliveryDate && o.expectedDeliveryDate < today && (IN_PROGRESS_ORDER_STATUSES as string[]).includes(o.status);
                  return (
                    <tr key={o.id}>
                      <td className="cell-primary" data-label="">
                        <Link href={`${basePath}/${o.id}`} className="code-tag">
                          {formatOrderCode(o.number)}
                        </Link>{' '}
                        {o.isDemo ? <DemoBadge /> : null}
                      </td>
                      <td data-label="Cliente">
                        <Link href={`/sistema/clientes/${o.customerId}`} style={{ color: 'var(--navy-900)', fontWeight: 600 }}>
                          {o.customerName}
                        </Link>
                        {o.technicianName ? <span className="cell-sub">Técnico: {o.technicianName}</span> : null}
                      </td>
                      <td data-label="Equipamento">
                        {o.equipment}
                        {joinParts([o.brand, o.model], ' ') ? <span className="cell-sub">{joinParts([o.brand, o.model], ' ')}</span> : null}
                      </td>
                      <td data-label="Entrada" className="text-muted nowrap col-hide-md">
                        {formatDateBR(o.entryDate)}
                      </td>
                      <td data-label="Previsão" className="nowrap" style={overdue ? { color: 'var(--color-danger)', fontWeight: 600 } : undefined}>
                        {o.expectedDeliveryDate ? formatDateBR(o.expectedDeliveryDate) : <span className="text-subtle">—</span>}
                        {overdue ? <span className="cell-sub" style={{ color: 'var(--color-danger)' }}>vencido</span> : null}
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="num" data-label="Total">
                        <Money cents={o.totalCents} />
                      </td>
                      {canSeePayments ? (
                        <td data-label="Pagamento" className="col-hide-md">
                          <PaymentStateBadge total={o.totalCents} paid={o.paidCents} />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} basePath={basePath} params={params} noun="ordens" />
      </Card>
    </>
  );
}
