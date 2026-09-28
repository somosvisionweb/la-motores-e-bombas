import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClipboardList, History, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { deleteCustomerAction } from '@/actions/customers';
import { DemoBadge, StatusBadge } from '@/components/ui/Badge';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { formatOrderCode } from '@/lib/codes';
import { formatDateBR } from '@/lib/dates';
import { formatCpfCnpj } from '@/lib/document-id';
import { joinParts } from '@/lib/text';
import { buildWhatsAppUrl, displayPhone, toWhatsAppNumber } from '@/lib/phone';
import { formatInt } from '@/lib/money';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getCustomerDetail } from '@/server/services/customers';

export const metadata = { title: 'Cliente' };

const TIMELINE_TONE: Partial<Record<string, 'green' | 'amber' | 'red' | 'slate'>> = {
  ENTREGUE: 'green',
  PRONTO: 'green',
  CANCELADO: 'red',
  AGUARDANDO_AVALIACAO: 'slate',
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('customers.view');
  const { id } = await params;
  const detail = Number.isInteger(Number(id)) ? await getCustomerDetail(Number(id)) : null;
  if (!detail) notFound();

  const { customer, stats, lastService, timeline } = detail;
  const wa = toWhatsAppNumber(customer.whatsapp ?? customer.phone);
  const canCreateOrder = hasPermission(user, 'orders.create');
  const canViewOrders = hasPermission(user, 'orders.view');

  return (
    <>
      <PageHeader
        title={customer.name}
        badges={customer.isDemo ? <DemoBadge /> : undefined}
        crumbs={[{ label: 'Clientes', href: '/sistema/clientes' }, { label: customer.name }]}
        subtitle={`Cliente desde ${formatDateBR(customer.createdAt.toISOString().slice(0, 10))}`}
        actions={
          <>
            {canCreateOrder ? (
              <Link href={`/sistema/ordens/nova?clienteId=${customer.id}`} className="btn btn--primary">
                <Plus aria-hidden="true" /> Nova Ordem de Serviço
              </Link>
            ) : null}
            {wa ? (
              <a href={buildWhatsAppUrl(wa)} target="_blank" rel="noopener noreferrer" className="btn">
                <WhatsAppIcon style={{ color: 'var(--green-700)' }} /> WhatsApp
              </a>
            ) : null}
            {hasPermission(user, 'customers.edit') ? (
              <Link href={`/sistema/clientes/${customer.id}/editar`} className="btn">
                <Pencil aria-hidden="true" /> Editar
              </Link>
            ) : null}
            {hasPermission(user, 'customers.delete') ? (
              <ConfirmActionForm
                action={deleteCustomerAction}
                fields={{ id: customer.id }}
                title="Excluir cliente?"
                message={
                  <>
                    O cadastro de <strong>{customer.name}</strong> será removido. Esta ação não pode ser desfeita. Clientes com ordens, vendas ou
                    pagamentos não podem ser excluídos.
                  </>
                }
                confirmLabel="Excluir cliente"
                triggerLabel="Excluir"
                triggerIcon={<Trash2 aria-hidden="true" />}
                triggerSize="md"
              />
            ) : null}
          </>
        }
      />

      <div className="page-grid">
        <div className="stack" style={{ ['--gap' as string]: '20px' }}>
          <Card>
            <CardHeader title="Ficha do cliente" icon={<UserRound size={20} color="var(--navy-500)" aria-hidden="true" />} />
            <CardBody>
              <dl className="kv">
                <dt>Cliente</dt>
                <dd>{customer.name}</dd>
                <dt>Contato</dt>
                <dd>{displayPhone(customer.phone) || '—'}</dd>
                <dt>WhatsApp</dt>
                <dd>{displayPhone(customer.whatsapp) || '—'}</dd>
                <dt>Endereço</dt>
                <dd>{customer.address || '—'}</dd>
                {customer.document ? (
                  <>
                    <dt>CPF / CNPJ</dt>
                    <dd className="tabular">{formatCpfCnpj(customer.document)}</dd>
                  </>
                ) : null}
                {customer.email ? (
                  <>
                    <dt>E-mail</dt>
                    <dd>{customer.email}</dd>
                  </>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          <Card accent>
            <CardHeader title="Último serviço" icon={<ClipboardList size={20} color="var(--green-700)" aria-hidden="true" />} />
            <CardBody>
              {lastService ? (
                <dl className="kv">
                  <dt>Último serviço</dt>
                  <dd>{lastService.description}</dd>
                  <dt>Data</dt>
                  <dd>{formatDateBR(lastService.date)}</dd>
                  <dt>Valor</dt>
                  <dd>
                    <Money cents={lastService.cents} tone="positive" />
                  </dd>
                  <dt>Ordem</dt>
                  <dd>
                    {canViewOrders ? (
                      <Link href={`/sistema/ordens/${lastService.orderId}`} className="code-tag">
                        {formatOrderCode(lastService.number)}
                      </Link>
                    ) : (
                      <span className="code-tag">{formatOrderCode(lastService.number)}</span>
                    )}
                  </dd>
                </dl>
              ) : (
                <p className="text-muted">Nenhum serviço concluído ainda para este cliente.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Histórico de atendimentos"
              subtitle="Todas as ordens deste cliente, da mais recente para a mais antiga."
              icon={<History size={20} color="var(--navy-500)" aria-hidden="true" />}
            />
            <CardBody>
              {timeline.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList size={24} aria-hidden="true" />}
                  title="Sem atendimentos registrados"
                  action={
                    canCreateOrder ? (
                      <Link href={`/sistema/ordens/nova?clienteId=${customer.id}`} className="btn btn--primary">
                        <Plus aria-hidden="true" /> Criar a primeira OS
                      </Link>
                    ) : undefined
                  }
                >
                  As ordens de serviço deste cliente aparecerão aqui.
                </EmptyState>
              ) : (
                <ol className="timeline">
                  {timeline.map((item) => (
                    <li key={item.orderId} className={`timeline__item timeline__item--${TIMELINE_TONE[item.status] ?? 'amber'}`}>
                      <div className="timeline__head">
                        <span className="timeline__title">{formatDateBR(item.entryDate)}</span>
                        {canViewOrders ? (
                          <Link href={`/sistema/ordens/${item.orderId}`} className="code-tag">
                            {formatOrderCode(item.number)}
                          </Link>
                        ) : (
                          <span className="code-tag">{formatOrderCode(item.number)}</span>
                        )}
                        <StatusBadge status={item.status} />
                        <span className="push-right">
                          <Money cents={item.totalCents} />
                        </span>
                      </div>
                      <p className="timeline__body" style={{ fontWeight: 500 }}>
                        {item.description}
                      </p>
                      <p className="timeline__meta">
                        {joinParts([item.equipment, joinParts([item.brand, item.model], ' '), item.technicianName ? `Técnico: ${item.technicianName}` : ''], ' · ')}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="stack" style={{ ['--gap' as string]: '16px' }}>
          <StatCard label="Ordens de serviço" value={formatInt(stats.orders)} meta={`${stats.openOrders} em andamento`} accent="navy" />
          <StatCard label="Total recebido" value={<Money cents={stats.paidCents} />} meta={`${stats.salesCount} venda(s) de produtos`} accent="green" />
          {customer.notes ? (
            <Card>
              <CardHeader title="Observações" />
              <CardBody>
                <p style={{ whiteSpace: 'pre-wrap' }}>{customer.notes}</p>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
