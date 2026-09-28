import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Ban, CalendarClock, ClipboardList, History, Pencil, Trash2, User, Wallet, Wrench } from 'lucide-react';
import { cancelOrderAction, deleteOrderAction, voidPaymentAction } from '@/actions/orders';
import { OrderDocumentsMenu } from '@/components/system/documents/OrderDocumentsMenu';
import { AdvanceStatusButton, OrderNoteForm, PaymentDialog, StatusDialog } from '@/components/system/orders/OrderActions';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { DemoBadge, MethodBadge, PaymentStateBadge, StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { OrderStepper } from '@/components/ui/Stepper';
import { Alert } from '@/components/ui/Alert';
import { isOpenStatus, nextSuggestedStatus, ORDER_STATUS } from '@/config/order-status';
import { isPaymentMethod, PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/config/payment-methods';
import { formatOrderCode } from '@/lib/codes';
import { formatDateBR, formatDateTimeBR, todayISO } from '@/lib/dates';
import { computeOrderTotals } from '@/lib/order-totals';
import { applyTemplate, joinParts } from '@/lib/text';
import { buildWhatsAppUrl, displayPhone, toWhatsAppNumber } from '@/lib/phone';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getOrderDetail } from '@/server/services/orders';
import { getCompanySettings, getPublicBaseUrl, isLocalBaseUrl } from '@/server/services/settings';

export const metadata = { title: 'Ordem de serviço' };

const EVENT_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = { CREATED: 'green', STATUS: 'amber', NOTE: 'slate', PAYMENT: 'green', DOCUMENT: 'slate', EDIT: 'slate' };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('orders.view');
  const { id } = await params;
  const detail = Number.isInteger(Number(id)) ? await getOrderDetail(Number(id)) : null;
  if (!detail) notFound();

  const { order, customer, technician, creatorName, items, events, payments, paidCents, balanceCents } = detail;
  const company = await getCompanySettings();
  const today = todayISO(company.timezone);
  const code = formatOrderCode(order.number);
  const totals = computeOrderTotals(items, order.discountCents);

  const canEdit = hasPermission(user, 'orders.edit') && order.status !== 'CANCELADO';
  const canChangeStatus = hasPermission(user, 'orders.status');
  const canPay = hasPermission(user, 'payments.create') && balanceCents > 0 && order.status !== 'CANCELADO';
  const canSeePayments = hasPermission(user, 'payments.view');
  const canVoid = hasPermission(user, 'payments.void');
  const canPrint = hasPermission(user, 'documents.print');
  const next = canChangeStatus ? nextSuggestedStatus(order.status) : null;
  const methods = company.paymentMethods.filter(isPaymentMethod) as PaymentMethod[];

  const whatsappNumber = toWhatsAppNumber(customer.whatsapp ?? customer.phone);
  const baseUrl = getPublicBaseUrl(company);
  const shareMessage = applyTemplate(company.whatsappTemplates.orderShare, { nome: customer.name.split(' ')[0], empresa: company.name, codigo: code, link: '' }).replace(/\s+$/, '');

  return (
    <>
      <PageHeader
        title={code}
        badges={
          <>
            <StatusBadge status={order.status} /> {order.isDemo ? <DemoBadge /> : null}
          </>
        }
        crumbs={[{ label: 'Ordens de Serviço', href: '/sistema/ordens' }, { label: code }]}
        subtitle={
          <>
            <Link href={`/sistema/clientes/${customer.id}`}>{customer.name}</Link> · {order.equipment}
            {joinParts([order.brand, order.model], ' ') ? ` (${joinParts([order.brand, order.model], ' ')})` : ''}
          </>
        }
        actions={
          <>
            {next ? <AdvanceStatusButton orderId={order.id} next={next} /> : null}
            {canPay ? <PaymentDialog orderId={order.id} balanceCents={balanceCents} defaultMethod={order.paymentMethod} methods={methods} today={today} /> : null}
            {canChangeStatus ? <StatusDialog orderId={order.id} current={order.status} balanceCents={balanceCents} paidCents={paidCents} /> : null}
            {canEdit ? (
              <Link href={`/sistema/ordens/${order.id}/editar`} className="btn">
                <Pencil aria-hidden="true" /> Editar
              </Link>
            ) : null}
            {canPrint ? (
              <OrderDocumentsMenu
                orderId={order.id}
                code={code}
                customerName={customer.name}
                whatsappNumber={whatsappNumber}
                message={shareMessage}
                baseUrl={baseUrl}
                baseUrlIsLocal={isLocalBaseUrl(baseUrl)}
                companyName={company.name}
              />
            ) : null}
          </>
        }
      />

      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        {order.status === 'CANCELADO' ? (
          <Alert variant="danger" title="Ordem cancelada">
            {order.cancelReason ? `Motivo: ${order.cancelReason}. ` : ''}As peças vinculadas ao estoque foram devolvidas. Para retomar o atendimento, altere o status.
          </Alert>
        ) : (
          <Card>
            <CardBody>
              <OrderStepper status={order.status} />
            </CardBody>
          </Card>
        )}

        <div className="page-grid">
          <div className="stack" style={{ ['--gap' as string]: '20px' }}>
            <Card>
              <CardHeader title="Equipamento e atendimento" icon={<Wrench size={20} color="var(--navy-500)" aria-hidden="true" />} />
              <CardBody>
                <dl className="kv">
                  <dt>Equipamento</dt>
                  <dd>{order.equipment}</dd>
                  <dt>Marca / modelo</dt>
                  <dd>{joinParts([order.brand, order.model], ' · ') || '—'}</dd>
                  <dt>Problema relatado</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{order.problemDescription || '—'}</dd>
                  <dt>Diagnóstico</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{order.diagnosis || '—'}</dd>
                  <dt>Serviço realizado</dt>
                  <dd style={{ whiteSpace: 'pre-wrap' }}>{order.serviceDescription || '—'}</dd>
                  {order.notes ? (
                    <>
                      <dt>Observações</dt>
                      <dd style={{ whiteSpace: 'pre-wrap' }}>{order.notes}</dd>
                    </>
                  ) : null}
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Serviços e peças" icon={<ClipboardList size={20} color="var(--navy-500)" aria-hidden="true" />} />
              {items.length === 0 ? (
                <CardBody>
                  <p className="text-muted">Nenhum item lançado. {canEdit ? 'Use “Editar” para adicionar serviços e peças.' : ''}</p>
                </CardBody>
              ) : (
                <div className="table-wrap">
                  <table className="table table--stack">
                    <thead>
                      <tr>
                        <th scope="col">Tipo</th>
                        <th scope="col">Descrição</th>
                        <th scope="col" className="num">
                          Qtd.
                        </th>
                        <th scope="col" className="num">
                          Unitário
                        </th>
                        <th scope="col" className="num">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td data-label="Tipo" className="text-muted">
                            {item.kind === 'SERVICE' ? 'Serviço' : 'Peça'}
                          </td>
                          <td className="cell-primary" data-label="">
                            {item.description}
                          </td>
                          <td className="num" data-label="Qtd.">
                            {item.quantity}
                          </td>
                          <td className="num" data-label="Unitário">
                            <Money cents={item.unitPriceCents} tone="muted" />
                          </td>
                          <td className="num" data-label="Total">
                            <Money cents={item.totalCents} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="num">
                          Peças
                        </td>
                        <td className="num">
                          <Money cents={totals.partsTotalCents} />
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="num">
                          Mão de obra / serviços
                        </td>
                        <td className="num">
                          <Money cents={totals.laborTotalCents} />
                        </td>
                      </tr>
                      {order.discountCents > 0 ? (
                        <tr>
                          <td colSpan={4} className="num">
                            Desconto
                          </td>
                          <td className="num">
                            <Money cents={-order.discountCents} tone="negative" />
                          </td>
                        </tr>
                      ) : null}
                      <tr>
                        <td colSpan={4} className="num">
                          Valor total
                        </td>
                        <td className="num">
                          <Money cents={order.totalCents} tone="positive" />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            {canSeePayments ? (
              <Card>
                <CardHeader
                  title="Pagamentos"
                  icon={<Wallet size={20} color="var(--green-700)" aria-hidden="true" />}
                  actions={canPay ? <PaymentDialog orderId={order.id} balanceCents={balanceCents} defaultMethod={order.paymentMethod} methods={methods} today={today} label="Novo pagamento" /> : null}
                />
                {payments.length === 0 ? (
                  <CardBody>
                    <p className="text-muted">Nenhum pagamento registrado para esta ordem.</p>
                  </CardBody>
                ) : (
                  <div className="table-wrap">
                    <table className="table table--stack table--compact">
                      <thead>
                        <tr>
                          <th scope="col">Data</th>
                          <th scope="col">Forma</th>
                          <th scope="col">Observação</th>
                          <th scope="col" className="num">
                            Valor
                          </th>
                          <th scope="col" className="actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} style={p.status === 'VOIDED' ? { opacity: 0.55 } : undefined}>
                            <td data-label="Data" className="nowrap">
                              {formatDateBR(p.paidDate)}
                            </td>
                            <td data-label="Forma">
                              <MethodBadge method={p.method} />
                            </td>
                            <td data-label="Observação" className="text-muted">
                              {p.status === 'VOIDED' ? `Estornado: ${p.voidReason ?? ''}` : p.notes || '—'}
                            </td>
                            <td className="num" data-label="Valor">
                              <span style={p.status === 'VOIDED' ? { textDecoration: 'line-through' } : undefined}>
                                <Money cents={p.amountCents} tone={p.status === 'VOIDED' ? 'muted' : 'positive'} />
                              </span>
                            </td>
                            <td className="actions" data-label="">
                              <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                {p.status === 'PAID' && canPrint ? (
                                  <Link href={`/imprimir/recibo/${p.id}`} className="btn btn--sm">
                                    Recibo
                                  </Link>
                                ) : null}
                                {p.status === 'PAID' && canVoid ? (
                                  <ConfirmActionForm
                                    action={voidPaymentAction}
                                    fields={{ id: p.id }}
                                    title="Estornar pagamento?"
                                    message="O valor deixará de contar nas entradas do financeiro. O registro permanece no histórico como estornado."
                                    confirmLabel="Estornar"
                                    triggerLabel="Estornar"
                                    reasonLabel="Motivo do estorno"
                                    reasonRequired
                                  />
                                ) : null}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Histórico da ordem" subtitle="Mudanças de status, pagamentos e comentários." icon={<History size={20} color="var(--navy-500)" aria-hidden="true" />} />
              <CardBody>
                <div className="stack" style={{ ['--gap' as string]: '20px' }}>
                  <OrderNoteForm orderId={order.id} />
                  <ol className="timeline">
                    {events.map((e) => (
                      <li key={e.id} className={`timeline__item timeline__item--${EVENT_TONE[e.type] ?? 'slate'}`}>
                        <div className="timeline__head">
                          <span className="timeline__title">
                            {e.type === 'STATUS' && e.toStatus ? (
                              <>
                                {e.fromStatus ? `${ORDER_STATUS[e.fromStatus].label} → ` : ''}
                                {ORDER_STATUS[e.toStatus].label}
                              </>
                            ) : e.type === 'CREATED' ? (
                              'Ordem criada'
                            ) : e.type === 'NOTE' ? (
                              'Comentário'
                            ) : e.type === 'PAYMENT' ? (
                              'Pagamento'
                            ) : e.type === 'DOCUMENT' ? (
                              'Documento'
                            ) : (
                              'Edição'
                            )}
                          </span>
                          <span className="timeline__meta">
                            {formatDateTimeBR(e.createdAt, company.timezone)}
                            {e.userName ? ` · ${e.userName}` : ''}
                          </span>
                        </div>
                        {e.message ? <p className="timeline__body">{e.message}</p> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              </CardBody>
            </Card>
          </div>

          <aside className="stack" style={{ ['--gap' as string]: '16px' }}>
            <Card accent>
              <CardHeader title="Valores" />
              <CardBody>
                <dl className="kv" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <dt>Total da ordem</dt>
                  <dd className="text-right">
                    <Money cents={order.totalCents} />
                  </dd>
                  {canSeePayments ? (
                    <>
                      <dt>Recebido</dt>
                      <dd className="text-right">
                        <Money cents={paidCents} tone="positive" />
                      </dd>
                      <dt>Saldo a receber</dt>
                      <dd className="text-right">
                        <Money cents={balanceCents} tone={balanceCents > 0 ? 'negative' : 'muted'} />
                      </dd>
                      <dt>Situação</dt>
                      <dd className="text-right">
                        <PaymentStateBadge total={order.totalCents} paid={paidCents} />
                      </dd>
                    </>
                  ) : null}
                  <dt>Forma combinada</dt>
                  <dd className="text-right">{order.paymentMethod ? PAYMENT_METHOD_LABEL[order.paymentMethod] : '—'}</dd>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Datas" icon={<CalendarClock size={20} color="var(--navy-500)" aria-hidden="true" />} />
              <CardBody>
                <dl className="kv" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <dt>Entrada</dt>
                  <dd className="text-right">{formatDateBR(order.entryDate)}</dd>
                  <dt>Previsão de entrega</dt>
                  <dd className="text-right" style={order.expectedDeliveryDate && order.expectedDeliveryDate < today && isOpenStatus(order.status) && order.status !== 'PRONTO' ? { color: 'var(--color-danger)' } : undefined}>
                    {formatDateBR(order.expectedDeliveryDate)}
                  </dd>
                  <dt>Serviço concluído</dt>
                  <dd className="text-right">{formatDateBR(order.completedDate)}</dd>
                  <dt>Entrega</dt>
                  <dd className="text-right">{formatDateBR(order.deliveredDate)}</dd>
                  <dt>Próximo serviço</dt>
                  <dd className="text-right">{formatDateBR(order.nextServiceDate)}</dd>
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Responsáveis" icon={<User size={20} color="var(--navy-500)" aria-hidden="true" />} />
              <CardBody>
                <dl className="kv" style={{ gridTemplateColumns: 'auto 1fr' }}>
                  <dt>Técnico</dt>
                  <dd className="text-right">{technician?.name ?? '—'}</dd>
                  <dt>Criada por</dt>
                  <dd className="text-right">{creatorName ?? '—'}</dd>
                  <dt>Cliente</dt>
                  <dd className="text-right">{displayPhone(customer.whatsapp ?? customer.phone) || '—'}</dd>
                </dl>
                {whatsappNumber ? (
                  <a href={buildWhatsAppUrl(whatsappNumber)} target="_blank" rel="noopener noreferrer" className="btn btn--sm btn--block" style={{ marginTop: 12 }}>
                    <WhatsAppIcon style={{ color: 'var(--green-700)' }} /> Conversar no WhatsApp
                  </a>
                ) : null}
              </CardBody>
            </Card>

            {(hasPermission(user, 'orders.status') && order.status !== 'CANCELADO' && order.status !== 'ENTREGUE') || hasPermission(user, 'orders.delete') ? (
              <Card>
                <CardHeader title="Mais ações" />
                <CardBody>
                  <div className="stack" style={{ ['--gap' as string]: '10px' }}>
                    {hasPermission(user, 'orders.status') && order.status !== 'CANCELADO' && order.status !== 'ENTREGUE' ? (
                      <ConfirmActionForm
                        action={cancelOrderAction}
                        fields={{ id: order.id }}
                        title="Cancelar esta ordem?"
                        message="A ordem será marcada como cancelada e as peças vinculadas voltarão ao estoque. Ordens com pagamentos precisam ter os pagamentos estornados antes."
                        confirmLabel="Cancelar ordem"
                        triggerLabel="Cancelar ordem"
                        triggerIcon={<Ban aria-hidden="true" />}
                        reasonLabel="Motivo do cancelamento (opcional)"
                        className="block"
                        triggerClassName="btn--block"
                      />
                    ) : null}
                    {hasPermission(user, 'orders.delete') ? (
                      <ConfirmActionForm
                        action={deleteOrderAction}
                        fields={{ id: order.id }}
                        title="Excluir definitivamente?"
                        message={
                          <>
                            A ordem <strong>{code}</strong> e todo o seu histórico serão apagados. Só é possível excluir ordens sem pagamentos; caso contrário, prefira cancelar.
                          </>
                        }
                        confirmLabel="Excluir ordem"
                        triggerLabel="Excluir ordem"
                        triggerIcon={<Trash2 aria-hidden="true" />}
                        triggerVariant="secondary"
                        triggerClassName="btn--block"
                        className="block"
                      />
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
