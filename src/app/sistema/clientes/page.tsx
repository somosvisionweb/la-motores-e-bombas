import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { DemoBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { SortHeader } from '@/components/ui/SortHeader';
import { FilterBar, SearchField } from '@/components/system/FilterBar';
import { formatDateBR } from '@/lib/dates';
import { buildWhatsAppUrl, displayPhone, toWhatsAppNumber } from '@/lib/phone';
import { param, parsePage, parseSort, type SearchParams } from '@/lib/query';
import { truncate } from '@/lib/text';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { CUSTOMER_SORT_KEYS, listCustomers } from '@/server/services/customers';

export const metadata = { title: 'Clientes' };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('customers.view');
  const params = await searchParams;
  const q = param(params, 'q');
  const page = parsePage(params);
  const sort = parseSort(params, CUSTOMER_SORT_KEYS, { key: 'name', dir: 'asc' });
  const { rows, total } = await listCustomers({ q, sort: sort.key, dir: sort.dir, page });
  const basePath = '/sistema/clientes';

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro, contatos e histórico de atendimentos."
        actions={
          hasPermission(user, 'customers.create') ? (
            <Link href={`${basePath}/novo`} className="btn btn--primary">
              <Plus aria-hidden="true" /> Novo cliente
            </Link>
          ) : null
        }
      />

      <Card>
        <FilterBar clearHref={basePath} hasFilters={Boolean(q)} keep={{ ordem: param(params, 'ordem'), dir: param(params, 'dir') }}>
          <SearchField defaultValue={q} placeholder="Nome, telefone, CPF/CNPJ…" />
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users size={26} aria-hidden="true" />}
            title={q ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            action={
              hasPermission(user, 'customers.create') && !q ? (
                <Link href={`${basePath}/novo`} className="btn btn--primary">
                  <Plus aria-hidden="true" /> Cadastrar primeiro cliente
                </Link>
              ) : undefined
            }
          >
            {q ? 'Tente outro nome ou parte do telefone.' : 'Cadastre os clientes para acompanhar o histórico de cada atendimento.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <SortHeader label="Cliente" sortKey="name" current={sort} basePath={basePath} params={params} />
                  <th scope="col">Contato</th>
                  <SortHeader label="Último serviço" sortKey="lastService" current={sort} basePath={basePath} params={params} />
                  <th scope="col" className="num">
                    Valor
                  </th>
                  <SortHeader label="OS" sortKey="orders" current={sort} basePath={basePath} params={params} numeric />
                  <SortHeader label="Cadastro" sortKey="created" current={sort} basePath={basePath} params={params} />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const wa = toWhatsAppNumber(c.whatsapp ?? c.phone);
                  return (
                    <tr key={c.id}>
                      <td className="cell-primary" data-label="">
                        <Link href={`${basePath}/${c.id}`}>{c.name}</Link> {c.isDemo ? <DemoBadge /> : null}
                        {c.address ? <span className="cell-sub">{truncate(c.address, 60)}</span> : null}
                      </td>
                      <td data-label="Contato">
                        <span className="cluster" style={{ gap: 8, justifyContent: 'flex-end' }}>
                          {displayPhone(c.phone || c.whatsapp) || <span className="text-subtle">—</span>}
                          {wa ? (
                            <a
                              href={buildWhatsAppUrl(wa)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn--ghost btn--icon btn--sm"
                              aria-label={`Abrir WhatsApp de ${c.name}`}
                              title="Abrir WhatsApp"
                              style={{ color: 'var(--green-700)' }}
                            >
                              <WhatsAppIcon />
                            </a>
                          ) : null}
                        </span>
                      </td>
                      <td data-label="Último serviço">
                        {c.lastServiceDate ? (
                          <>
                            {truncate(c.lastServiceDescription ?? '', 48)}
                            <span className="cell-sub">{formatDateBR(c.lastServiceDate)}</span>
                          </>
                        ) : (
                          <span className="text-subtle">{c.openOrders > 0 ? 'Em andamento' : 'Nenhum ainda'}</span>
                        )}
                      </td>
                      <td className="num" data-label="Valor">
                        {c.lastServiceCents !== null ? <Money cents={c.lastServiceCents} /> : <span className="text-subtle">—</span>}
                      </td>
                      <td className="num" data-label="OS">
                        {c.ordersCount}
                      </td>
                      <td data-label="Cadastro" className="text-muted">
                        {formatDateBR(c.createdAt.toISOString().slice(0, 10))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} basePath={basePath} params={params} noun="clientes" />
      </Card>
    </>
  );
}
